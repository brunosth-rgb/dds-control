import {
  collection,
  doc,
  getDocs,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';

import seed from './seed.json';

import {
  type State,
  type RecordDDS,
  localNow,
  TYPES,
  typePeriodsForDate,
  obligations,
  norm,
  validateSettings,
  periodsFor,
  validRecord,
} from './domain';

import {
  mapRecord,
  mergeRecords,
  type Mapping,
} from './hashdata-map';

import {
  currentUser,
  requireDb,
} from './firebase-client';


export type HashdataInfo = {
  mapping?: Mapping;
  lastSuccess?: string;
  added?: number;
  updated?: number;
  total?: number;
  review?: number;
  auto?: boolean;
};


export type ExtendedState =
  State & {
    hashdata?: HashdataInfo;
  };


export type WorkspaceResult = {
  state: ExtendedState;
  revision: number;
};


/*
 * A partir da v2 do armazenamento,
 * "records" NÃO fica mais dentro
 * do documento ddsControl/main.
 */
type StoredState =
  Omit<
    ExtendedState,
    'records'
  >;


type WorkspaceDocument = {
  state: StoredState;
  revision: number;
  updatedAt: string;
  schemaVersion: 2;
};


/*
 * Compatibilidade temporária com a
 * estrutura antiga, onde records[]
 * ficava dentro do documento main.
 */
type LegacyWorkspaceDocument = {
  state:
    | ExtendedState
    | StoredState;

  revision: number;
  updatedAt: string;
  schemaVersion?: number;
};


const clean = <T,>(
  value: T
): T =>
  JSON.parse(
    JSON.stringify(value)
  );


function workspaceRef() {
  return doc(
    requireDb(),
    'ddsControl',
    'main'
  );
}


function recordsCollectionRef() {
  return collection(
    requireDb(),
    'ddsControl',
    'main',
    'records'
  );
}


function safeRecordId(
  id: string
) {
  const value =
    encodeURIComponent(
      String(
        id ||
        crypto.randomUUID()
      )
    );

  /*
   * IDs normais do Hashdata e UUIDs
   * ficam muito abaixo deste limite.
   */
  return value.slice(
    0,
    1200
  );
}


function recordRef(
  id: string
) {
  return doc(
    requireDb(),
    'ddsControl',
    'main',
    'records',
    safeRecordId(id)
  );
}


function coreFromState(
  state: ExtendedState
): StoredState {
  const {
    records: _records,
    ...core
  } = clean(state);

  return core;
}


function stateWithRecords(
  core: StoredState,
  records: RecordDDS[]
): ExtendedState {
  return {
    ...clean(core),
    records:
      clean(records),
  } as ExtendedState;
}


function cloneSeed():
ExtendedState {
  return clean(
    seed
  ) as ExtendedState;
}


async function loadRecordDocuments():
Promise<RecordDDS[]> {
  const snap =
    await getDocs(
      recordsCollectionRef()
    );

  return snap.docs
    .map(
      item => {
        const data =
          item.data() as
          Partial<RecordDDS>;

        return {
          ...data,

          id:
            String(
              data.id ||
              decodeURIComponent(
                item.id
              )
            ),
        } as RecordDDS;
      }
    )
    .filter(
      record =>
        !!record.id
    );
}


function recordsMap(
  records: RecordDDS[]
) {
  return new Map(
    records.map(
      record => [
        record.id,
        record,
      ]
    )
  );
}


function sameRecord(
  a: RecordDDS,
  b: RecordDDS
) {
  return (
    JSON.stringify(a) ===
    JSON.stringify(b)
  );
}


/*
 * Persiste somente registros que
 * realmente mudaram.
 *
 * As operações são quebradas em
 * lotes de 400 para não concentrar
 * centenas de gravações em um único
 * batch.
 */
async function persistRecordChanges(
  before: RecordDDS[],
  after: RecordDDS[]
) {
  const beforeMap =
    recordsMap(before);

  const afterMap =
    recordsMap(after);

  const operations:
    Array<
      {
        type: 'set';
        record: RecordDDS;
      }
      |
      {
        type: 'delete';
        id: string;
      }
    > = [];


  for (
    const record
    of after
  ) {
    const old =
      beforeMap.get(
        record.id
      );

    if (
      !old ||
      !sameRecord(
        old,
        record
      )
    ) {
      operations.push({
        type: 'set',
        record:
          clean(record),
      });
    }
  }


  for (
    const old
    of before
  ) {
    if (
      !afterMap.has(
        old.id
      )
    ) {
      operations.push({
        type: 'delete',
        id:
          old.id,
      });
    }
  }


  for (
    let start = 0;
    start < operations.length;
    start += 400
  ) {
    const batch =
      writeBatch(
        requireDb()
      );

    const chunk =
      operations.slice(
        start,
        start + 400
      );


    for (
      const operation
      of chunk
    ) {
      if (
        operation.type ===
        'set'
      ) {
        batch.set(
          recordRef(
            operation.record.id
          ),

          clean(
            operation.record
          )
        );
      } else {
        batch.delete(
          recordRef(
            operation.id
          )
        );
      }
    }


    await batch.commit();
  }
}


/*
 * Primeira abertura depois desta
 * atualização:
 *
 * 1. lê records[] do documento antigo;
 * 2. grava cada DDS na subcoleção;
 * 3. regrava main sem records[];
 * 4. reduz imediatamente o tamanho
 *    do documento principal.
 */
async function migrateLegacyRecords(
  row: LegacyWorkspaceDocument
): Promise<number> {
  const legacyState =
    row.state as
    ExtendedState;

  const legacyRecords =
    Array.isArray(
      legacyState?.records
    )
      ? legacyState.records
      : [];


  if (
    !legacyRecords.length
  ) {
    return row.revision;
  }


  const existingRecords =
    await loadRecordDocuments();


  const combined =
    mergeRecordLists(
      existingRecords,
      legacyRecords
    );


  await persistRecordChanges(
    existingRecords,
    combined
  );


  const core =
    coreFromState(
      legacyState
    );


  const result =
    await runTransaction(
      requireDb(),
      async tx => {
        const ref =
          workspaceRef();

        const snap =
          await tx.get(ref);

        if (
          !snap.exists()
        ) {
          throw new Error(
            'Workspace não encontrado durante a migração.'
          );
        }


        const current =
          snap.data() as
          LegacyWorkspaceDocument;


        /*
         * Se outro computador salvou
         * durante a migração,
         * interrompemos para não
         * sobrescrever alterações.
         */
        if (
          current.revision !==
          row.revision
        ) {
          throw new Error(
            'Os dados mudaram durante a migração. Atualize a página e tente novamente.'
          );
        }


        const revision =
          current.revision + 1;


        const next:
          WorkspaceDocument = {
            state:
              core,

            revision,

            updatedAt:
              core.updated,

            schemaVersion: 2,
          };


        tx.set(
          ref,
          next
        );


        return revision;
      }
    );


  return result;
}


function mergeRecordLists(
  first: RecordDDS[],
  second: RecordDDS[]
) {
  const map =
    new Map<
      string,
      RecordDDS
    >();


  for (
    const record
    of first
  ) {
    map.set(
      record.id,
      record
    );
  }


  for (
    const record
    of second
  ) {
    map.set(
      record.id,
      record
    );
  }


  return [
    ...map.values(),
  ];
}


export async function loadWorkspace():
Promise<WorkspaceResult> {
  const db =
    requireDb();

  const ref =
    workspaceRef();


  let loaded =
    await runTransaction(
      db,
      async tx => {
        const user =
          currentUser();


        const accessRef =
          doc(
            db,
            'ddsUsers',
            user.uid
          );


        const access =
          await tx.get(
            accessRef
          );


        if (
          !access.exists() ||
          access.data()?.active !==
            true
        ) {
          throw new Error(
            'Sua conta está autenticada, mas ainda não foi autorizada para o DDS Control.'
          );
        }


        const snap =
          await tx.get(ref);


        if (
          !snap.exists()
        ) {
          const initial =
            cloneSeed();

          const core =
            coreFromState(
              initial
            );


          const document:
            WorkspaceDocument = {
              state:
                core,

              revision: 1,

              updatedAt:
                core.updated,

              schemaVersion: 2,
            };


          tx.set(
            ref,
            document
          );


          return {
            row:
              document as
              LegacyWorkspaceDocument,

            created: true,
          };
        }


        const row =
          snap.data() as
          LegacyWorkspaceDocument;


        if (
          !row?.state ||
          !Number.isInteger(
            row.revision
          )
        ) {
          throw new Error(
            'Estrutura de dados inválida no Firestore.'
          );
        }


        return {
          row,
          created: false,
        };
      }
    );


  /*
   * Migração automática da versão
   * antiga do Firestore.
   */
  const legacyState =
    loaded.row.state as
    ExtendedState;


  if (
    Array.isArray(
      legacyState?.records
    ) &&
    legacyState.records.length
  ) {
    const revision =
      await migrateLegacyRecords(
        loaded.row
      );


    loaded = {
      row: {
        state:
          coreFromState(
            legacyState
          ),

        revision,

        updatedAt:
          legacyState.updated,

        schemaVersion: 2,
      },

      created:
        false,
    };
  }


  const records =
    await loadRecordDocuments();


  return {
    state:
      stateWithRecords(
        loaded.row.state as
        StoredState,

        records
      ),

    revision:
      loaded.row.revision,
  };
}


function mutateState(
  current: ExtendedState,
  body: any,
  user: string
): ExtendedState {
  const s =
    clean(current);

  const at =
    localNow();

  let detail = '';


  const str = (
    value: unknown,
    max = 4000
  ): string =>
    typeof value ===
    'string'
      ? value
          .trim()
          .slice(
            0,
            max
          )
      : '';


  if (
    body.action ===
    'import-files'
  ) {
    if (
      !Array.isArray(
        body.ships
      ) ||
      !body.ships.length ||
      body.ships.length > 100
    ) {
      throw new Error(
        'Selecione entre 1 e 100 navios.'
      );
    }


    let added = 0;
    let updated = 0;
    let skipped = 0;

    const changes:
      string[] = [];


    for (
      const p
      of body.ships
    ) {
      const name =
        str(
          p.name,
          120
        );

      const berth =
        str(
          p.berth,
          60
        );

      const start =
        str(
          p.start,
          19
        );

      const end =
        str(
          p.end,
          19
        );


      if (
        !name ||
        !berth ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(
          start
        ) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(
          end
        ) ||
        !Number.isFinite(
          Date.parse(
            start
          )
        ) ||
        !Number.isFinite(
          Date.parse(
            end
          )
        ) ||
        end <= start
      ) {
        throw new Error(
          'Complete a janela de operação de ' +
          name +
          '.'
        );
      }


      const old =
        p.existingId
          ? s.ships.find(
              vessel =>
                vessel.id ===
                  p.existingId &&
                !vessel.deleted &&
                vessel.status ===
                  'Ativo'
            )
          : undefined;


      if (
        p.existingId &&
        !old
      ) {
        throw new Error(
          'A operação mudou. Selecione o arquivo novamente.'
        );
      }


      if (
        old &&
        norm(old.name) !==
          norm(name)
      ) {
        throw new Error(
          'Para renomear um navio existente, use Gerenciar.'
        );
      }


      const overlap =
        s.ships.find(
          vessel =>
            vessel.id !==
              old?.id &&
            !vessel.deleted &&
            vessel.status !==
              'Cancelado' &&
            norm(
              vessel.name
            ) ===
              norm(name) &&
            vessel.start <
              end &&
            (
              vessel.actualEnd ||
              vessel.end
            ) >
              start
        );


      if (
        overlap
      ) {
        if (
          overlap.start.slice(
            0,
            16
          ) === start &&
          overlap.end.slice(
            0,
            16
          ) === end &&
          overlap.berth ===
            berth
        ) {
          skipped++;
          continue;
        }


        throw new Error(
          'Há uma operação sobreposta de ' +
          name +
          '. Reabra a importação para revisar.'
        );
      }


      const vessel = {
        ...old,

        id:
          old?.id ||
          crypto.randomUUID(),

        name,
        berth,
        start,
        end,

        status:
          'Ativo',

        source:
          str(
            p.source,
            300
          ),

        note:
          str(
            p.note
          ),

        startBasis:
          str(
            p.startBasis,
            100
          ),

        review:
          Array.isArray(
            p.review
          )
            ? p.review
                .slice(
                  0,
                  10
                )
                .map(
                  (
                    item:
                      unknown
                  ) =>
                    str(
                      item,
                      500
                    )
                )
            : [],
      };


      if (
        old
      ) {
        s.ships =
          s.ships.map(
            item =>
              item.id ===
                old.id
                ? vessel
                : item
          );

        updated++;

        changes.push(
          name +
          ': ' +
          old.start +
          ' / ' +
          old.end +
          ' → ' +
          start +
          ' / ' +
          end
        );
      } else {
        s.ships.push(
          vessel
        );

        added++;

        changes.push(
          name +
          ': ' +
          start +
          ' / ' +
          end
        );
      }
    }


    detail =
      `Importação de arquivo: ${added} novos, ` +
      `${updated} atualizados, ` +
      `${skipped} já cadastrados. ` +
      changes.join('; ');
  }


  else if (
    body.action ===
    'ship'
  ) {
    const p =
      body.ship;

    const name =
      str(
        p.name,
        120
      );

    const berth =
      str(
        p.berth,
        60
      );

    const start =
      str(
        p.start,
        19
      );

    const end =
      str(
        p.end,
        19
      );


    if (
      !name ||
      !berth ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(
        start
      ) ||
      !Number.isFinite(
        Date.parse(
          start
        )
      ) ||
      !Number.isFinite(
        Date.parse(
          end
        )
      ) ||
      end <= start
    ) {
      throw new Error(
        'Preencha nome, berço e uma janela válida.'
      );
    }


    const old =
      s.ships.find(
        item =>
          item.id ===
          p.id
      );


    if (
      s.ships.some(
        item =>
          item.id !==
            p.id &&
          !item.deleted &&
          item.status !==
            'Cancelado' &&
          item.name.toUpperCase() ===
            name.toUpperCase() &&
          item.start <
            end &&
          (
            item.actualEnd ||
            item.end
          ) >
            start
      )
    ) {
      throw new Error(
        'Já existe uma operação desse navio nesse intervalo.'
      );
    }


    if (
      old &&
      old.status !==
        'Ativo'
    ) {
      throw new Error(
        'Esta operação já foi encerrada.'
      );
    }


    const vessel = {
      ...old,

      id:
        old?.id ||
        crypto.randomUUID(),

      name,
      berth,
      start,
      end,

      note:
        str(
          p.note
        ),

      status:
        'Ativo',
    };


    s.ships =
      old
        ? s.ships.map(
            item =>
              item.id ===
                vessel.id
                ? vessel
                : item
          )
        : [
            ...s.ships,
            vessel,
          ];


    detail =
      old
        ? `${name}: ${old.start} / ${old.end} → ${start} / ${end}; berço ${old.berth} → ${berth}`
        : `${name}; berço ${berth}; ${start} / ${end}`;
  }


  else if (
    [
      'finish',
      'cancel',
      'delete',
    ].includes(
      body.action
    )
  ) {
    const vessel =
      s.ships.find(
        item =>
          item.id ===
          body.id
      );


    if (
      !vessel
    ) {
      throw new Error(
        'Navio não encontrado.'
      );
    }


    if (
      body.action ===
      'finish'
    ) {
      if (
        vessel.status !==
          'Ativo' ||
        vessel.start >
          at
      ) {
        throw new Error(
          'A operação ainda não começou ou já foi encerrada.'
        );
      }

      vessel.actualEnd =
        at;

      vessel.status =
        'Finalizado';
    }


    if (
      body.action ===
      'cancel'
    ) {
      vessel.status =
        'Cancelado';
    }


    if (
      body.action ===
      'delete'
    ) {
      vessel.deleted =
        true;
    }


    const labels:
      Record<
        string,
        string
      > = {
        finish:
          'Finalizado agora',

        cancel:
          'Operação cancelada',

        delete:
          'Cadastro excluído; histórico preservado',
      };


    detail =
      vessel.name +
      ' - ' +
      labels[
        body.action
      ];
  }


  else if (
    body.action ===
    'settings'
  ) {
    const before =
      JSON.stringify(
        s.settings
      );

    s.settings =
      validateSettings(
        body.settings
      );

    detail =
      'Configurações: ' +
      before +
      ' → ' +
      JSON.stringify(
        s.settings
      );
  }


  else if (
    body.action ===
    'record'
  ) {
    const record =
      body.record;

    const id =
      str(
        record.id,
        100
      ) ||
      crypto.randomUUID();


    if (
      !TYPES.includes(
        record.type
      ) ||
      !typePeriodsForDate(
        record.type,
        record.date,
        s.settings
      ).includes(
        record.period
      ) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        record.date
      ) ||
      !Number.isFinite(
        Date.parse(
          record.applied
        )
      ) ||
      (
        record.type ===
          'NAVIO' &&
        !str(
          record.ship
        )
      )
    ) {
      throw new Error(
        'Informe tipo, período, data, horário e navio quando necessário.'
      );
    }


    const value = {
      id,

      type:
        record.type,

      sector:
        str(
          record.sector,
          120
        ) ||
        'Operações',

      ship:
        str(
          record.ship,
          120
        ),

      date:
        record.date,

      period:
        record.period,

      applied:
        str(
          record.applied,
          40
        ),

      applicator:
        str(
          record.applicator,
          120
        ),

      supervisor:
        str(
          record.supervisor,
          120
        ),

      participants:
        str(
          record.participants
        ),

      topics:
        str(
          record.topics
        ),

      photo:
        !!record.photo,

      signature:
        !!record.signature,

      source:
        'Registro manual',
    } as RecordDDS;


    s.records =
      s.records
        .filter(
          item =>
            item.id !==
            id
        )
        .concat(
          value
        );


    detail =
      `${value.type} ${value.ship} • ${value.date} ${value.period}`;
  }


  /*
   * Botão "Limpar histórico".
   *
   * Remove os DDS e justificativas,
   * mas NÃO remove:
   * - navios
   * - configurações
   * - Hashdata mapping
   * - usuários
   */
  else if (
    body.action ===
      'clear-history' ||
    body.action ===
      'clear-records'
  ) {
    const count =
      s.records.length;


    s.records = [];

    s.justifications =
      [];


    detail =
      `Histórico de DDS limpo: ${count} registro(s) removido(s).`;
  }


  else if (
    body.action ===
    'cleanup-test-data'
  ) {
    const before =
      s.records.length;


    s.records =
      s.records.filter(
        record =>
          !/^Excel de teste(?:\s*•|$)/i.test(
            record.source ||
            ''
          ) &&
          (
            record.source ||
            ''
          ) !==
            'Registro manual de teste'
      );


    const removed =
      before -
      s.records.length;


    s.audit =
      s.audit.filter(
        audit =>
          audit.action !==
            'import-hashdata-tests' &&
          !/Excel de teste/i.test(
            audit.detail ||
            ''
          )
      );


    detail =
      `Limpeza de produção: ${removed} registro(s) legado(s) de teste removido(s).`;
  }


  else if (
    body.action ===
    'justify'
  ) {
    const [
      date,
      period,
    ] =
      str(
        body.key
      ).split('|');


    if (
      !periodsFor(
        s.settings
      ).includes(
        period
      )
    ) {
      throw new Error(
        'Período inválido.'
      );
    }


    const item =
      obligations(
        s,
        date,
        periodsFor(
          s.settings
        ).indexOf(
          period
        )
      ).find(
        value =>
          value.key ===
          body.key
      );


    if (
      !item ||
      item.record
    ) {
      throw new Error(
        'Obrigação não disponível para justificativa.'
      );
    }


    const reason =
      str(
        body.reason,
        1000
      );


    if (
      reason.length <
      5
    ) {
      throw new Error(
        'Descreva o motivo da justificativa.'
      );
    }


    s.justifications =
      s.justifications
        .filter(
          item =>
            item.key !==
            body.key
        )
        .concat({
          key:
            body.key,

          reason,

          at,
        });


    detail =
      `${item.reference} ${date} ${period}: ${reason}`;
  }


  else if (
    body.action ===
    'unjustify'
  ) {
    s.justifications =
      s.justifications.filter(
        item =>
          item.key !==
          body.key
      );


    detail =
      'Justificativa removida: ' +
      str(
        body.key
      );
  }


  else {
    throw new Error(
      'Ação não reconhecida.'
    );
  }


  s.updated =
    at;


  s.audit.unshift({
    at,

    action:
      body.action,

    detail,

    user,
  });


  /*
   * Evita que a própria auditoria
   * cresça indefinidamente dentro
   * do documento main.
   */
  s.audit =
    s.audit.slice(
      0,
      250
    );


  return clean(
    s
  );
}


async function updateWorkspace(
  expectedRevision:
    number,

  mutator:
    (
      state:
        ExtendedState
    ) =>
      ExtendedState
): Promise<WorkspaceResult> {
  const db =
    requireDb();

  const ref =
    workspaceRef();


  /*
   * Histórico agora vem da
   * subcoleção.
   */
  const beforeRecords =
    await loadRecordDocuments();


  const result =
    await runTransaction(
      db,
      async tx => {
        const snap =
          await tx.get(
            ref
          );


        if (
          !snap.exists()
        ) {
          throw new Error(
            'Dados ainda não inicializados. Atualize a página.'
          );
        }


        const row =
          snap.data() as
          LegacyWorkspaceDocument;


        if (
          row.revision !==
          expectedRevision
        ) {
          throw new Error(
            'Os dados mudaram em outra aba ou computador. Atualize a página antes de salvar.'
          );
        }


        /*
         * Compatibilidade adicional
         * durante a migração.
         */
        const legacy =
          row.state as
          ExtendedState;


        const legacyRecords =
          Array.isArray(
            legacy?.records
          )
            ? legacy.records
            : [];


        const allRecords =
          mergeRecordLists(
            beforeRecords,
            legacyRecords
          );


        const current =
          stateWithRecords(
            coreFromState(
              legacy
            ),

            allRecords
          );


        const state =
          clean(
            mutator(
              clean(
                current
              )
            )
          );


        const revision =
          row.revision +
          1;


        const core =
          coreFromState(
            state
          );


        const next:
          WorkspaceDocument = {
            state:
              core,

            revision,

            updatedAt:
              core.updated,

            schemaVersion: 2,
          };


        /*
         * O documento gravado aqui
         * NÃO contém records[].
         */
        tx.set(
          ref,
          next
        );


        return {
          state,
          revision,

          beforeRecords:
            allRecords,
        };
      }
    );


  /*
   * Só depois da validação de revisão
   * persistimos as diferenças do
   * histórico na subcoleção.
   */
  await persistRecordChanges(
    result.beforeRecords,
    result.state.records
  );


  return {
    state:
      result.state,

    revision:
      result.revision,
  };
}


export async function saveWorkspaceAction(
  body: any,
  revision: number,
  user: string
): Promise<WorkspaceResult> {
  return updateWorkspace(
    revision,

    state =>
      mutateState(
        state,
        body,
        user
      )
  );
}


export async function saveHashdataSync(
  rows:
    Record<
      string,
      unknown
    >[],

  mapping:
    Mapping,

  auto:
    boolean,

  revision:
    number,

  user:
    string
): Promise<
  WorkspaceResult & {
    summary:
      HashdataInfo;
  }
> {
  for (
    const required
    of [
      'applied',
      'period',
      'type',
    ] as const
  ) {
    if (
      typeof mapping?.[
        required
      ] !==
        'string' ||
      !mapping[
        required
      ]
    ) {
      throw new Error(
        'Confira os campos de data, período e tipo antes de importar.'
      );
    }
  }


  let summary:
    HashdataInfo = {};


  const result =
    await updateWorkspace(
      revision,

      state => {
        const incoming:
          RecordDDS[] = [];

        const rejected: {
          id: string;
          reason: string;
        }[] = [];


        for (
          const row
          of rows
        ) {
          try {
            incoming.push(
              mapRecord(
                row,
                mapping
              )
            );
          } catch (
            error
          ) {
            rejected.push({
              id:
                String(
                  row.col_id ||
                  ''
                ),

              reason:
                error instanceof
                Error
                  ? error.message
                  : 'Registro inválido',
            });
          }
        }


        if (
          rejected.length
        ) {
          throw new Error(
            `${rejected.length} registros têm data inválida ou ID ausente. ` +
            'Confira o campo da aplicação. Nenhuma alteração foi salva.'
          );
        }


        const merged =
          mergeRecords(
            state.records,
            incoming
          );


        state.records =
          merged.records;


        const review =
          incoming.filter(
            record =>
              !validRecord(
                record,
                state.settings
              )
          ).length;


        const at =
          localNow();


        summary = {
          mapping,

          lastSuccess:
            at,

          added:
            merged.added,

          updated:
            merged.updated,

          total:
            rows.length,

          review,

          auto,
        };


        state.hashdata =
          summary;


        state.updated =
          at;


        state.audit.unshift({
          at,

          action:
            'hashdata-sync',

          user,

          detail:
            `Hashdata: ${merged.added} novos, ` +
            `${merged.updated} atualizados, ` +
            `${review} para revisão. ` +
            'Janela de 30 dias.',
        });


        state.audit =
          state.audit.slice(
            0,
            250
          );


        return state;
      }
    );


  return {
    ...result,
    summary,
  };
}
