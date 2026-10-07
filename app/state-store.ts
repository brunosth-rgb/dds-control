import {
  doc,
  runTransaction
} from 'firebase/firestore';

import seed from './seed.json';

import {
  type State,
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
  type Mapping
} from './hashdata-map';

import {
  currentUser,
  requireDb
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
    hashdata?: HashdataInfo
  };

export type WorkspaceResult = {
  state: ExtendedState;
  revision: number
};

type WorkspaceDocument = {
  state: ExtendedState;
  revision: number;
  updatedAt: string;
};

const workspaceRef =
  () =>
    doc(
      requireDb(),
      'ddsControl',
      'main'
    );

const clean =
  <T,>(
    value:T
  ):T =>
    JSON.parse(
      JSON.stringify(
        value
      )
    );

const cloneSeed =
  ():ExtendedState =>
    clean(
      seed
    ) as ExtendedState;

export async function loadWorkspace():
Promise<WorkspaceResult>{

  const ref=
    workspaceRef();

  return runTransaction(
    requireDb(),
    async tx=>{

      const access=
        await tx.get(
          doc(
            requireDb(),
            'ddsUsers',
            currentUser().uid
          )
        );

      if(
        !access.exists() ||
        access.data()?.active !== true
      ){
        throw new Error(
          'Sua conta está autenticada, mas ainda não foi autorizada para o DDS Control.'
        );
      }

      const snap=
        await tx.get(ref);

      if(
        !snap.exists()
      ){
        const state=
          cloneSeed();

        tx.set(
          ref,
          {
            state,
            revision:1,
            updatedAt:
              state.updated
          } satisfies WorkspaceDocument
        );

        return {
          state,
          revision:1
        };
      }

      const row=
        snap.data()
        as WorkspaceDocument;

      if(
        !row?.state ||
        !Number.isInteger(
          row.revision
        )
      ){
        throw new Error(
          'Estrutura de dados inválida no Firestore.'
        );
      }

      return {
        state:
          clean(row.state),
        revision:
          row.revision
      };
    }
  );
}

function mutateState(
  current:ExtendedState,
  body:any,
  user:string
):ExtendedState{

  const s=
    clean(current);

  const at=
    localNow();

  let detail='';

  const str=
    (
      v:unknown,
      max=4000
    ) =>
      typeof v==='string'
        ? v
            .trim()
            .slice(
              0,
              max
            )
        : '';

  if(
    body.action ===
    'import-files'
  ){

    if(
      !Array.isArray(
        body.ships
      ) ||
      !body.ships.length ||
      body.ships.length>100
    ){
      throw new Error(
        'Selecione entre 1 e 100 navios.'
      );
    }

    let added=0;
    let updated=0;
    let skipped=0;

    const changes:string[]=[];

    for(
      const p of body.ships
    ){

      const name=
        str(
          p.name,
          120
        );

      const berth=
        str(
          p.berth,
          60
        );

      const start=
        str(
          p.start,
          19
        );

      const end=
        str(
          p.end,
          19
        );

      if(
        !name ||
        !berth ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(end) ||
        !Number.isFinite(
          Date.parse(start)
        ) ||
        !Number.isFinite(
          Date.parse(end)
        ) ||
        end<=start
      ){
        throw new Error(
          'Complete a janela de operação de '+
          name+
          '.'
        );
      }

      const old=
        p.existingId
          ?
            s.ships.find(
              v=>
                v.id===p.existingId &&
                !v.deleted &&
                v.status==='Ativo'
            )
          : undefined;

      if(
        p.existingId &&
        !old
      ){
        throw new Error(
          'A operação mudou. Selecione o arquivo novamente.'
        );
      }

      if(
        old &&
        norm(old.name)!==
          norm(name)
      ){
        throw new Error(
          'Para renomear um navio existente, use Gerenciar.'
        );
      }

      const overlap=
        s.ships.find(
          v=>
            v.id!==old?.id &&
            !v.deleted &&
            v.status!=='Cancelado' &&
            norm(v.name)===norm(name) &&
            v.start<end &&
            (
              v.actualEnd ||
              v.end
            )>start
        );

      if(
        overlap
      ){

        if(
          overlap.start.slice(
            0,
            16
          )===start &&
          overlap.end.slice(
            0,
            16
          )===end &&
          overlap.berth===berth
        ){
          skipped++;
          continue;
        }

        throw new Error(
          'Há uma operação sobreposta de '+
          name+
          '. Reabra a importação para revisar.'
        );
      }

      const v={
        ...old,

        id:
          old?.id ||
          crypto.randomUUID(),

        name,
        berth,
        start,
        end,

        status:'Ativo',

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
            ?
              p.review
                .slice(
                  0,
                  10
                )
                .map(
                  (
                    x:unknown
                  )=>
                    str(
                      x,
                      500
                    )
                )
            : []
      };

      if(
        old
      ){
        s.ships=
          s.ships.map(
            x=>
              x.id===old.id
                ? v
                : x
          );

        updated++;

        changes.push(
          name+
          ': '+
          old.start+
          ' / '+
          old.end+
          ' → '+
          start+
          ' / '+
          end
        );
      }else{
        s.ships.push(v);

        added++;

        changes.push(
          name+
          ': '+
          start+
          ' / '+
          end
        );
      }
    }

    detail=
      `Importação de arquivo: ${added} novos, `+
      `${updated} atualizados, `+
      `${skipped} já cadastrados. `+
      changes.join('; ');

  }else if(
    body.action==='ship'
  ){

    const p=
      body.ship;

    const name=
      str(
        p.name,
        120
      );

    const berth=
      str(
        p.berth,
        60
      );

    const start=
      str(
        p.start,
        19
      );

    const end=
      str(
        p.end,
        19
      );

    if(
      !name ||
      !berth ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(start) ||
      !Number.isFinite(
        Date.parse(start)
      ) ||
      !Number.isFinite(
        Date.parse(end)
      ) ||
      end<=start
    ){
      throw new Error(
        'Preencha nome, berço e uma janela válida.'
      );
    }

    const old=
      s.ships.find(
        x=>
          x.id===p.id
      );

    if(
      s.ships.some(
        x=>
          x.id!==p.id &&
          !x.deleted &&
          x.status!=='Cancelado' &&
          x.name.toUpperCase()===
            name.toUpperCase() &&
          x.start<end &&
          (
            x.actualEnd ||
            x.end
          )>start
      )
    ){
      throw new Error(
        'Já existe uma operação desse navio nesse intervalo.'
      );
    }

    if(
      old &&
      old.status!=='Ativo'
    ){
      throw new Error(
        'Esta operação já foi encerrada.'
      );
    }

    const v={
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

      status:'Ativo'
    };

    s.ships=
      old
        ?
          s.ships.map(
            x=>
              x.id===v.id
                ? v
                : x
          )
        :
          [
            ...s.ships,
            v
          ];

    detail=
      old
        ?
          `${name}: ${old.start} / ${old.end} → ${start} / ${end}; berço ${old.berth} → ${berth}`
        :
          `${name}; berço ${berth}; ${start} / ${end}`;

  }else if(
    [
      'finish',
      'cancel',
      'delete'
    ].includes(
      body.action
    )
  ){

    const v=
      s.ships.find(
        x=>
          x.id===body.id
      );

    if(
      !v
    ){
      throw new Error(
        'Navio não encontrado.'
      );
    }

    if(
      body.action==='finish'
    ){
      if(
        v.status!=='Ativo' ||
        v.start>at
      ){
        throw new Error(
          'A operação ainda não começou ou já foi encerrada.'
        );
      }

      v.actualEnd=at;
      v.status='Finalizado';
    }

    if(
      body.action==='cancel'
    ){
      v.status='Cancelado';
    }

    if(
      body.action==='delete'
    ){
      v.deleted=true;
    }

    detail=
      v.name+
      ' - '+
      (
        {
          finish:'Finalizado agora',
          cancel:'Operação cancelada',
          delete:'Cadastro excluído; histórico preservado'
        } as any
      )[body.action];

  }else if(
    body.action==='settings'
  ){

    const before=
      JSON.stringify(
        s.settings
      );

    s.settings=
      validateSettings(
        body.settings
      );

    detail=
      'Configurações: '+
      before+
      ' → '+
      JSON.stringify(
        s.settings
      );

  }else if(
    body.action==='record'
  ){

    const r=
      body.record;

    const id=
      str(
        r.id,
        100
      ) ||
      crypto.randomUUID();

    if(
      !TYPES.includes(
        r.type
      ) ||
      !typePeriodsForDate(
        r.type,
        r.date,
        s.settings
      ).includes(
        r.period
      ) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        r.date
      ) ||
      !Number.isFinite(
        Date.parse(
          r.applied
        )
      ) ||
      (
        r.type==='NAVIO' &&
        !str(
          r.ship
        )
      )
    ){
      throw new Error(
        'Informe tipo, período, data, horário e navio quando necessário.'
      );
    }

    const v={
      id,

      type:
        r.type,

      ship:
        str(
          r.ship,
          120
        ),

      date:
        r.date,

      period:
        r.period,

      applied:
        str(
          r.applied,
          19
        ),

      applicator:
        str(
          r.applicator,
          120
        ),

      supervisor:
        str(
          r.supervisor,
          120
        ),

      participants:
        str(
          r.participants
        ),

      topics:
        str(
          r.topics
        ),

      photo:
        !!r.photo,

      signature:
        !!r.signature,

      source:
        'Registro manual'
    };

    s.records=
      s.records
        .filter(
          x=>
            x.id!==id
        )
        .concat(v);

    detail=
      `${v.type} ${v.ship} • ${v.date} ${v.period}`;

  }else if(
    body.action==='cleanup-test-data'
  ){

    const before=
      s.records.length;

    s.records=
      s.records.filter(
        r=>
          !/^Excel de teste(?:\s*•|$)/i.test(
            r.source||''
          ) &&
          (
            r.source||''
          )!=='Registro manual de teste'
      );

    const removed=
      before -
      s.records.length;

    s.audit=
      s.audit.filter(
        a=>
          a.action!=='import-hashdata-tests' &&
          !/Excel de teste/i.test(
            a.detail||''
          )
      );

    detail=
      `Limpeza de produção: ${removed} registro(s) legado(s) de teste removido(s).`;

  }else if(
    body.action==='justify'
  ){

    const [
      date,
      period
    ]=
      str(
        body.key
      ).split('|');

    if(
      !periodsFor(
        s.settings
      ).includes(
        period
      )
    ){
      throw new Error(
        'Período inválido.'
      );
    }

    const item=
      obligations(
        s,
        date,
        periodsFor(
          s.settings
        ).indexOf(
          period
        )
      )
      .find(
        x=>
          x.key===body.key
      );

    if(
      !item ||
      item.record
    ){
      throw new Error(
        'Obrigação não disponível para justificativa.'
      );
    }

    const reason=
      str(
        body.reason,
        1000
      );

    if(
      reason.length<5
    ){
      throw new Error(
        'Descreva o motivo da justificativa.'
      );
    }

    s.justifications=
      s.justifications
        .filter(
          x=>
            x.key!==body.key
        )
        .concat({
          key:body.key,
          reason,
          at
        });

    detail=
      `${item.reference} ${date} ${period}: ${reason}`;

  }else if(
    body.action==='unjustify'
  ){

    s.justifications=
      s.justifications.filter(
        x=>
          x.key!==body.key
      );

    detail=
      'Justificativa removida: '+
      str(
        body.key
      );

  }else{

    throw new Error(
      'Ação não reconhecida.'
    );
  }

  s.updated=at;

  s.audit.unshift({
    at,
    action:
      body.action,
    detail,
    user
  });

  return clean(s);
}

async function updateWorkspace(
  expectedRevision:number,
  mutator:
    (
      state:ExtendedState
    )=>ExtendedState
):Promise<WorkspaceResult>{

  const ref=
    workspaceRef();

  return runTransaction(
    requireDb(),
    async tx=>{

      const snap=
        await tx.get(ref);

      if(
        !snap.exists()
      ){
        throw new Error(
          'Dados ainda não inicializados. Atualize a página.'
        );
      }

      const row=
        snap.data()
        as WorkspaceDocument;

      if(
        row.revision !==
        expectedRevision
      ){
        throw new Error(
          'Os dados mudaram em outra aba ou computador. Atualize a página antes de salvar.'
        );
      }

      const state=
        clean(
          mutator(
            clean(
              row.state
            )
          )
        );

      const revision=
        row.revision+1;

      tx.set(
        ref,
        {
          state,
          revision,
          updatedAt:
            state.updated
        } satisfies WorkspaceDocument
      );

      return {
        state,
        revision
      };
    }
  );
}

export async function saveWorkspaceAction(
  body:any,
  revision:number,
  user:string
):Promise<WorkspaceResult>{

  return updateWorkspace(
    revision,
    state=>
      mutateState(
        state,
        body,
        user
      )
  );
}

export async function saveHashdataSync(
  rows:Record<string,unknown>[],
  mapping:Mapping,
  auto:boolean,
  revision:number,
  user:string
):Promise<
  WorkspaceResult & {
    summary:HashdataInfo
  }
>{

  for(
    const required of [
      'applied',
      'period',
      'type'
    ] as const
  ){
    if(
      typeof mapping?.[required]!=='string' ||
      !mapping[required]
    ){
      throw new Error(
        'Confira os campos de data, período e tipo antes de importar.'
      );
    }
  }

  let summary:
    HashdataInfo={};

  const result=
    await updateWorkspace(
      revision,
      state=>{

        const incoming=[];

        const rejected:{
          id:string;
          reason:string
        }[]=[];

        for(
          const record of rows
        ){
          try{
            incoming.push(
              mapRecord(
                record,
                mapping
              )
            );
          }catch(e){
            rejected.push({
              id:
                String(
                  record.col_id||''
                ),

              reason:
                e instanceof Error
                  ? e.message
                  : 'Registro inválido'
            });
          }
        }

        if(
          rejected.length
        ){
          throw new Error(
            `${rejected.length} registros têm data inválida ou ID ausente. Confira o campo da aplicação. Nenhuma alteração foi salva.`
          );
        }

        const merged=
          mergeRecords(
            state.records,
            incoming
          );

        state.records=
          merged.records;

        const review=
          incoming.filter(
            r=>
              !validRecord(
                r,
                state.settings
              )
          ).length;

        const at=
          localNow();

        summary={
          mapping,
          lastSuccess:at,
          added:
            merged.added,
          updated:
            merged.updated,
          total:
            rows.length,
          review,
          auto
        };

        state.hashdata=
          summary;

        state.updated=
          at;

        state.audit.unshift({
          at,
          action:
            'hashdata-sync',
          user,
          detail:
            `Hashdata: ${merged.added} novos, `+
            `${merged.updated} atualizados, `+
            `${review} para revisão. `+
            'Janela de 30 dias.'
        });

        return state;
      }
    );

  return {
    ...result,
    summary
  };
}
