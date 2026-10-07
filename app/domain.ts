export const PERIODS = ['01–07', '07–13', '13–19', '19–01'];
export const WORK_PERIODS = ['06–18', '18–06'];
export const ALL_PERIODS = [...PERIODS, ...WORK_PERIODS];

export const CORE_TYPES = ['NAVIO', 'CAM', 'RS'];
export const SUPPORT_TYPES = ['GATE', 'REEFER', 'ARMAZÉM'];
export const TYPES = [...CORE_TYPES, ...SUPPORT_TYPES];

export type Settings = {
  tolerance: number;
  requirePhoto: boolean;
  requireSignature: boolean;
  core?: string[];
  support?: string[];
  rules?: {
    [type: string]: {
      quantity: number;
      group: 'core' | 'support';
    };
  };
};

export function config(settings?: Settings) {
  return {
    core: settings?.core || PERIODS,
    support: settings?.support || WORK_PERIODS,

    rules: Object.fromEntries(
      TYPES.map(t => [
        t,
        {
          quantity: settings?.rules?.[t]?.quantity ?? 1,
          group:
            settings?.rules?.[t]?.group ??
            (t === 'NAVIO' || !SUPPORT_TYPES.includes(t)
              ? 'core'
              : 'support'),
        },
      ])
    ) as NonNullable<Settings['rules']>,
  };
}

export function periodsFor(settings?: Settings) {
  const c = config(settings);
  return [...c.core, ...c.support];
}

/**
 * Regra original baseada apenas no grupo configurado.
 * Mantida para compatibilidade com outras partes da aplicação.
 */
export function typePeriods(type: string, settings?: Settings) {
  const c = config(settings);
  return c[c.rules[type]?.group || 'core'];
}

/**
 * Identifica sábado ou domingo usando somente a data operacional.
 * O uso de UTC evita alteração do dia causada por timezone.
 */
export function isWeekend(date: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const day = new Date(`${date}T12:00:00Z`).getUTCDay();

  return day === 0 || day === 6;
}

/**
 * Define os períodos válidos por equipe e por data.
 *
 * NAVIO:
 *   sempre 6h
 *
 * REEFER / ARMAZÉM:
 *   sempre 12h
 *
 * CAM / RS:
 *   segunda a sexta = 6h
 *   sábado e domingo = 12h
 *
 * Demais equipes, como GATE:
 *   seguem a configuração cadastrada.
 */
export function typePeriodsForDate(
  type: string,
  date: string,
  settings?: Settings
) {
  const c = config(settings);

  if (type === 'NAVIO') {
    return c.core;
  }

  if (type === 'REEFER' || type === 'ARMAZÉM') {
    return c.support;
  }

  if (type === 'CAM' || type === 'RS') {
    return isWeekend(date) ? c.support : c.core;
  }

  const group = c.rules[type]?.group || 'support';

  return c[group];
}

export function parsePeriod(p: string) {
  const m =
    /^(\d{2})(?::(\d{2}))?–(\d{2})(?::(\d{2}))?$/.exec(p);

  if (!m) {
    throw Error('Horário inválido: ' + p);
  }

  const a = +m[1] * 60 + +(m[2] || 0);
  const b = +m[3] * 60 + +(m[4] || 0);

  if (
    +m[1] > 23 ||
    +m[3] > 23 ||
    +(m[2] || 0) > 59 ||
    +(m[4] || 0) > 59 ||
    a === b
  ) {
    throw Error(
      'O início e o fim devem ser horários diferentes.'
    );
  }

  return [a, b];
}

export function validateSettings(v: Settings) {
  if (
    !Number.isInteger(v.tolerance) ||
    v.tolerance < 0 ||
    v.tolerance > 360
  ) {
    throw Error(
      'Tolerância: informe de 0 a 360 minutos.'
    );
  }

  const c = config(v);

  for (const group of ['core', 'support'] as const) {
    const list = c[group];

    if (
      !Array.isArray(list) ||
      !list.length ||
      list.length > 12
    ) {
      throw Error(
        'Use entre 1 e 12 períodos em cada grupo.'
      );
    }

    const occupied = new Set<number>();

    for (const p of list) {
      const [a, b] = parsePeriod(p);

      for (
        let n = a;
        n !== b;
        n = (n + 1) % 1440
      ) {
        if (occupied.has(n)) {
          throw Error(
            'Há horários sobrepostos no mesmo grupo.'
          );
        }

        occupied.add(n);
      }
    }

    if (occupied.size !== 1440) {
      throw Error(
        'Os períodos de cada grupo devem cobrir as 24 horas, sem lacunas.'
      );
    }
  }

  for (const t of TYPES) {
    const r = c.rules[t];

    if (
      !r ||
      !['core', 'support'].includes(r.group) ||
      !Number.isInteger(r.quantity) ||
      r.quantity < 0 ||
      r.quantity > 20
    ) {
      throw Error(
        'Quantidade de DDS: use de 0 a 20 por equipe.'
      );
    }
  }

  const canonical = (p: string) =>
    p
      .split('–')
      .map(x =>
        x.endsWith(':00')
          ? x.slice(0, 2)
          : x
      )
      .join('–');

  return {
    ...v,
    ...c,
    core: c.core.map(canonical),
    support: c.support.map(canonical),
  };
}

export function currentSelection(
  settings: Settings | undefined,
  group: 'core' | 'support',
  now = localNow()
) {
  const c = config(settings);
  const date = now.slice(0, 10);
  const instant = epoch(now);

  for (const d of [date, shiftDate(date, -1)]) {
    for (let i = 0; i < c[group].length; i++) {
      const index =
        i +
        (group === 'support'
          ? c.core.length
          : 0);

      const w = windowOf(
        d,
        index,
        settings
      );

      if (
        w.start <= instant &&
        instant < w.end
      ) {
        return {
          date: d,
          index,
        };
      }
    }
  }

  return {
    date,
    index: 0,
  };
}

export type RecordDDS = {
  id: string;
  type: string;
  ship: string;
  date: string;
  period: string;
  applied: string;
  applicator: string;
  supervisor: string;
  participants: string;
  topics: string;
  photo: boolean;
  signature: boolean;
  source: string;
};

export type Ship = {
  id: string;
  name: string;
  berth: string;
  start: string;
  end: string;
  actualEnd?: string;
  status: string;
  note: string;
  deleted?: boolean;
  source?: string;
  startBasis?: string;
  review?: string[];
  importKey?: string;
};

export type Audit = {
  at: string;
  action: string;
  detail: string;
  user: string;
};

export type State = {
  ships: Ship[];
  records: RecordDDS[];
  justifications: {
    key: string;
    reason: string;
    at: string;
  }[];
  audit: Audit[];
  settings: Settings;
  updated: string;
};

export type Obligation = {
  key: string;
  type: string;
  reference: string;
  date: string;
  period: string;
  due: number;
  start: number;
  status: string;
  record?: RecordDDS;
  count: number;
  reason?: string;
  entityId: string;
  slot: number;
  quantity: number;
};

export function localNow() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace(' ', 'T');
}

export function epoch(s: string) {
  return Date.parse(
    s.length === 16
      ? s + ':00-03:00'
      : s + '-03:00'
  );
}

export function shiftDate(
  d: string,
  n: number
) {
  return new Date(
    Date.parse(d + 'T12:00:00Z') +
      n * 86400000
  )
    .toISOString()
    .slice(0, 10);
}

export function currentPeriod(
  now = localNow()
) {
  const h = +now.slice(11, 13);

  return h < 1
    ? 3
    : h < 7
      ? 0
      : h < 13
        ? 1
        : h < 19
          ? 2
          : 3;
}

export function operationalDate(
  now = localNow()
) {
  return +now.slice(11, 13) < 1
    ? shiftDate(
        now.slice(0, 10),
        -1
      )
    : now.slice(0, 10);
}

export function supportOperationalDate(
  now = localNow()
) {
  return +now.slice(11, 13) < 6
    ? shiftDate(
        now.slice(0, 10),
        -1
      )
    : now.slice(0, 10);
}

export function currentSupportPeriod(
  now = localNow()
) {
  const h = +now.slice(11, 13);

  return h >= 6 && h < 18
    ? 4
    : 5;
}

export function norm(s: string) {
  return s
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function normalizePeriod(
  s: string
) {
  const a = s.match(/\d+/g) || [];

  const nums = a
    .filter(
      (_, i) =>
        i === 0 ||
        a.length === 2 ||
        i === 2
    )
    .map(Number);

  return (
    ALL_PERIODS.find(p => {
      const b = p
        .match(/\d+/g)!
        .map(Number);

      return (
        b[0] === nums[0] &&
        b[1] === nums[1]
      );
    }) || s
  );
}

export function windowOf(
  date: string,
  index: number,
  settings?: Settings
) {
  const p =
    periodsFor(settings)[index];

  if (!p) {
    throw Error('Período inválido');
  }

  const [start, end] =
    parsePeriod(p);

  const time = (n: number) =>
    String(
      Math.floor(n / 60)
    ).padStart(2, '0') +
    ':' +
    String(n % 60).padStart(
      2,
      '0'
    );

  return {
    start: epoch(
      date +
        'T' +
        time(start)
    ),

    end: epoch(
      (end < start
        ? shiftDate(date, 1)
        : date) +
        'T' +
        time(end)
    ),
  };
}

export function issues(
  r: RecordDDS,
  s: State
) {
  const x: string[] = [];

  if (!r.applicator.trim()) {
    x.push('Aplicador');
  }

  if (!r.supervisor.trim()) {
    x.push('Supervisor');
  }

  if (!r.participants.trim()) {
    x.push('Participantes');
  }

  if (!r.topics.trim()) {
    x.push('Temas');
  }

  if (
    s.settings.requirePhoto &&
    !r.photo
  ) {
    x.push('Foto');
  }

  if (
    s.settings.requireSignature &&
    !r.signature
  ) {
    x.push('Assinatura');
  }

  return x;
}

export function validRecord(
  r: RecordDDS,
  settings?: Settings
) {
  if (!TYPES.includes(r.type)) {
    return false;
  }

  if (!r.date) {
    return false;
  }

  if (
    !typePeriodsForDate(
      r.type,
      r.date,
      settings
    ).includes(r.period)
  ) {
    return false;
  }

  if (
    r.type === 'NAVIO' &&
    !r.ship.trim()
  ) {
    return false;
  }

  return true;
}

export function obligations(
  state: State,
  date: string,
  index: number,
  now = Date.now()
): Obligation[] {
  const cfg = config(
    state.settings
  );

  const period =
    periodsFor(
      state.settings
    )[index];

  const w = windowOf(
    date,
    index,
    state.settings
  );

  /**
   * Aqui está a principal alteração.
   *
   * Em vez de decidir as equipes apenas pelo grupo
   * "core/support", verificamos se aquele período é
   * válido para cada equipe naquela data.
   *
   * Isso permite:
   *
   * CAM/RS:
   * seg-sex = 6h
   * sáb-dom = 12h
   *
   * NAVIO:
   * sempre 6h
   *
   * REEFER/ARMAZÉM:
   * sempre 12h
   */
  const items = TYPES
    .filter(
      t =>
        cfg.rules[t].quantity >
          0 &&
        typePeriodsForDate(
          t,
          date,
          state.settings
        ).includes(period)
    )
    .flatMap(type =>
      type === 'NAVIO'
        ? state.ships
            .filter(
              s =>
                s.status !==
                  'Cancelado' &&
                !s.deleted &&
                epoch(s.start) <
                  w.end &&
                epoch(
                  s.actualEnd ||
                    s.end
                ) > w.start
            )
            .map(s => ({
              type,
              reference: s.name,
              start: Math.max(
                w.start,
                epoch(s.start)
              ),
              id: s.id,
            }))
        : [
            {
              type,
              reference:
                type === 'CAM'
                  ? 'Equipe Caminhão'
                  : type === 'RS'
                    ? 'Equipe RS'
                    : type,
              start: w.start,
              id: type,
            },
          ]
    );

  return items.flatMap(i => {
    const quantity =
      cfg.rules[i.type].quantity;

    const matching =
      state.records
        .filter(
          r =>
            validRecord(
              r,
              state.settings
            ) &&
            r.type === i.type &&
            r.date === date &&
            r.period === period &&
            (
              i.type !== 'NAVIO' ||
              norm(r.ship) ===
                norm(i.reference)
            )
        )
        .sort(
          (a, b) =>
            issues(
              a,
              state
            ).length -
              issues(
                b,
                state
              ).length ||
            epoch(a.applied) -
              epoch(b.applied)
        );

    return Array.from(
      {
        length: quantity,
      },
      (_, slot) => {
        const key =
          [
            date,
            period,
            i.id,
          ].join('|') +
          (
            slot
              ? '#' +
                (slot + 1)
              : ''
          );

        const record =
          matching[slot];

        const just =
          state.justifications.find(
            j =>
              j.key === key
          );

        const due =
          i.start +
          state.settings
            .tolerance *
            60000;

        const status = record
          ? issues(
              record,
              state
            ).length
            ? 'Realizado com pendência'
            : 'Realizado'
          : just
            ? 'Justificado'
            : now < i.start
              ? 'Não iniciado'
              : now <= due
                ? 'Aguardando'
                : 'Atrasado';

        return {
          key,
          entityId: i.id,
          slot: slot + 1,
          quantity,
          type: i.type,
          reference:
            i.reference,
          date,
          period,
          start: i.start,
          due,
          status,
          record,
          count:
            matching.length,
          reason:
            just?.reason,
        };
      }
    );
  });
}

export function score(
  rows: Obligation[]
) {
  const done =
    rows.filter(
      r => !!r.record
    ).length;

  return {
    done,
    total: rows.length,
    pct: rows.length
      ? Math.round(
          (done /
            rows.length) *
            100
        )
      : 0,
  };
}

export function fmtTime(
  t: number | string
) {
  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      timeZone:
        'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(
    new Date(
      typeof t === 'string'
        ? epoch(t)
        : t
    )
  );
}

export function fmtDate(
  d: string
) {
  return (
    d.slice(8, 10) +
    '/' +
    d.slice(5, 7) +
    '/' +
    d.slice(0, 4)
  );
}
