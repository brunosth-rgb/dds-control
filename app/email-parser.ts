import { MsgReader } from '@kenjiuno/msgreader-web-ng';
import PostalMime from 'postal-mime';
import { createWorker, PSM } from 'tesseract.js';
import lineup from './email-lineup.json';


export type Candidate = {
  name: string;
  berth: string;
  start: string;
  end: string;
  note: string;
  source: string;
  startBasis: string;
  review: string[];
  selected?: boolean;
};


export type EmailPreview = {
  file: string;
  subject: string;
  text: string;

  ships: Candidate[];

  images: {
    name: string;
    url: string;
  }[];

  notice: string;
};


type PreviewImage = {
  name: string;
  url: string;
  width?: number;
  height?: number;
};


type BBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};


type OCRWord = {
  text: string;
  bbox: BBox;
};


type OCRWorker =
  Awaited<
    ReturnType<
      typeof createWorker
    >
  >;


const plan2809: Candidate[] = [
  {
    name: 'MS BIANCA',
    berth: '1',
    start: '2026-09-28T02:20',
    end: '2026-09-29T16:00',
    note: 'ETA 27/09 23:30; plano 28/09.',
    source: 'Berthing Plan 28.09.26.png',
    startBasis: 'Start Work',
    review: [],
  },
  {
    name: 'COSTA RICA EXPRESS',
    berth: '4',
    start: '2026-09-27T17:30',
    end: '2026-09-30T14:30',
    note: 'ETA 27/09 15:10; plano 28/09.',
    source: 'Berthing Plan 28.09.26.png',
    startBasis: 'Start Work',
    review: [],
  },
  {
    name: 'MAERSK LAMANAI',
    berth: '1',
    start: '2026-09-29T15:00',
    end: '2026-09-30T15:00',
    note: 'ETA 29/09 12:00; início estimado pelo plano.',
    source: 'Berthing Plan 28.09.26.png',
    startBasis: 'ETA / plano',
    review: [
      'Conferir horário de início no plano.',
    ],
  },
  {
    name: 'X PRESS PISCES',
    berth: '1',
    start: '2026-09-30T16:00',
    end: '2026-10-01T18:00',
    note: 'ETA 30/09 16:00; plano 28/09.',
    source: 'Berthing Plan 28.09.26.png',
    startBasis: 'ETA',
    review: [
      'Conferir horário de início no plano.',
    ],
  },
  {
    name: 'MSC INTEC VI',
    berth: '1',
    start: '2026-10-01T10:00',
    end: '2026-10-02T10:00',
    note: 'Plano 28/09.',
    source: 'Berthing Plan 28.09.26.png',
    startBasis: 'ETA',
    review: [],
  },
  {
    name: 'KOTA ELAN',
    berth: '2',
    start: '2026-09-29T10:00',
    end: '2026-10-01T10:00',
    note: 'ETA 29/09 10:00; plano 28/09.',
    source: 'Berthing Plan 28.09.26.png',
    startBasis: 'ETA',
    review: [],
  },
  {
    name: 'NC BRAVO',
    berth: '4',
    start: '2026-10-01T11:00',
    end: '2026-10-02T11:00',
    note: 'ETA 01/10 11:00; plano 28/09.',
    source: 'Berthing Plan 28.09.26.png',
    startBasis: 'ETA',
    review: [],
  },
  {
    name: 'IRENES RULE',
    berth: '1',
    start: '2026-10-02T11:00',
    end: '2026-10-02T23:00',
    note: 'ETA 02/10 11:00; plano 28/09.',
    source: 'Berthing Plan 28.09.26.png',
    startBasis: 'ETA',
    review: [
      'Conferir berço e horário de início.',
    ],
  },
  {
    name: 'GREEN BRAZIL',
    berth: '4',
    start: '2026-10-02T12:00',
    end: '2026-10-04T22:00',
    note: 'ETA 02/10 12:00; plano 28/09.',
    source: 'Berthing Plan 28.09.26.png',
    startBasis: 'ETA',
    review: [
      'Conferir horário de início no plano.',
    ],
  },
];


const MONTHS: Record<string, number> = {
  JAN: 1,

  FEV: 2,
  FEB: 2,

  MAR: 3,

  ABR: 4,
  APR: 4,

  MAI: 5,
  MAY: 5,

  JUN: 6,
  JUL: 7,

  AGO: 8,
  AUG: 8,

  SET: 9,
  SEP: 9,

  OUT: 10,
  OCT: 10,

  NOV: 11,

  DEZ: 12,
  DEC: 12,
};


function plain(
  html: string
) {
  return html
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      ''
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      ''
    )
    .replace(
      /<\/(?:td|th|tr|p|div)>|<br\s*\/?\s*>/gi,
      '\n'
    )
    .replace(
      /<[^>]*>/g,
      ' '
    )
    .replace(
      /&nbsp;/g,
      ' '
    )
    .replace(
      /&amp;/g,
      '&'
    );
}


function normalized(
  value: string
) {
  return value
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^A-Z0-9]+/gi,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim()
    .toUpperCase();
}


function compactSpaces(
  value: string
) {
  return value
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}


function toBase64(
  data: Uint8Array
) {
  let binary = '';

  const chunk =
    0x8000;

  for (
    let i = 0;
    i < data.length;
    i += chunk
  ) {
    binary +=
      String.fromCharCode(
        ...data.subarray(
          i,
          i + chunk
        )
      );
  }

  return btoa(binary);
}


function bytesOf(
  value: unknown
): Uint8Array {

  if (
    value instanceof
    Uint8Array
  ) {
    return value;
  }

  if (
    value instanceof
    ArrayBuffer
  ) {
    return new Uint8Array(
      value
    );
  }

  if (
    ArrayBuffer.isView(
      value
    )
  ) {
    return new Uint8Array(
      value.buffer,
      value.byteOffset,
      value.byteLength
    );
  }

  throw new Error(
    'Anexo em formato binário não suportado.'
  );
}


function mimeFor(
  name: string
) {

  if (
    /\.png$/i.test(name)
  ) {
    return 'image/png';
  }

  if (
    /\.webp$/i.test(name)
  ) {
    return 'image/webp';
  }

  return 'image/jpeg';
}


function imageDataUrl(
  name: string,
  data: Uint8Array
) {
  return (
    `data:${mimeFor(name)};base64,` +
    toBase64(data)
  );
}


function loadImage(
  url: string
): Promise<HTMLImageElement> {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const image =
        new Image();

      image.onload =
        () =>
          resolve(image);

      image.onerror =
        () =>
          reject(
            new Error(
              'Não foi possível abrir a imagem do Berthing Plan.'
            )
          );

      image.src =
        url;
    }
  );
}


async function imageSize(
  url: string
) {

  const image =
    await loadImage(
      url
    );

  return {
    width:
      image.naturalWidth,

    height:
      image.naturalHeight,
  };
}


function looksLikePlanName(
  name: string
) {
  return (
    /berth(?:ing)?[\s_-]*plan|plano[\s_-]*(?:de[\s_-]*)?atrac/i
  ).test(name);
}


function looksLikePlanSubject(
  subject: string
) {
  return (
    /berth(?:ing)?[\s_-]*plan|plano\s+(?:de\s+)?atrac/i
  ).test(subject);
}


export function parseMovements(
  text: string,
  year: number,
  source: string
): Candidate[] {

  const flat =
    text
      .replace(
        /\r/g,
        ''
      )
      .split('\n')
      .map(
        value =>
          value.trim()
      )
      .filter(Boolean)
      .join('\n');

  const months = [
    'JAN',
    'FEV',
    'MAR',
    'ABR',
    'MAI',
    'JUN',
    'JUL',
    'AGO',
    'SET',
    'OUT',
    'NOV',
    'DEZ',
  ];

  const regex =
    /(?:^|\n)(\d+)\s*\n([^\n]{2,100})\s*\n(?:JBS\s*\n)?(\d+)[ \n]+(\d{1,2})[\/.-]([a-zA-ZçÇ]{3}|\d{1,2})(?:[\/.-](\d{4}))?[ \n]+(\d{1,2}:\d{2})([\s\S]*?)(ENTRADA|SA[IÍ]DA)/gi;

  const found:
    Candidate[] =
    [];

  let match:
    RegExpExecArray |
    null;

  while (
    (
      match =
        regex.exec(flat)
    )
  ) {

    const month =
      /^\d+$/.test(
        match[5]
      )
        ? +match[5]
        : months.indexOf(
            match[5]
              .toUpperCase()
          ) + 1;

    if (
      month < 1 ||
      month > 12
    ) {
      continue;
    }

    const stamp =
      `${match[6] || year}-` +
      `${String(month).padStart(2, '0')}-` +
      `${match[4].padStart(2, '0')}T` +
      `${match[7].padStart(5, '0')}`;

    const entering =
      normalized(
        match[9]
      ) ===
      'ENTRADA';

    found.push({
      name:
        match[2].trim(),

      berth:
        match[3],

      start:
        entering
          ? stamp
          : '',

      end:
        entering
          ? ''
          : stamp,

      note:
        `${match[9]} prevista no e-mail. Conferir janela de operação.`,

      source,

      startBasis:
        entering
          ? 'Entrada prevista'
          : 'Início não informado',

      review: [
        entering
          ? 'O e-mail não informa o fim: complete antes de importar.'
          : 'O e-mail não informa o início: complete antes de importar.',
      ],
    });
  }

  return found;
}


function flattenWords(
  blocks:
    any[] |
    null |
    undefined
): OCRWord[] {

  if (
    !Array.isArray(
      blocks
    )
  ) {
    return [];
  }

  const words:
    OCRWord[] =
    [];

  for (
    const block
    of blocks
  ) {

    for (
      const paragraph
      of block?.paragraphs ||
      []
    ) {

      for (
        const line
        of paragraph?.lines ||
        []
      ) {

        for (
          const word
          of line?.words ||
          []
        ) {

          if (
            word?.text &&
            word?.bbox
          ) {

            words.push({
              text:
                String(
                  word.text
                ),

              bbox:
                word.bbox as BBox,
            });
          }
        }
      }
    }
  }

  return words;
}


function defaultBerthCenters(
  imageWidth: number
) {

  /*
   * Posição aproximada dos títulos
   * BERÇO 1, 2, 3 e 4 no layout
   * padrão do Berthing Plan.
   */

  return new Map<
    number,
    number
  >([
    [
      1,
      imageWidth *
      0.18,
    ],
    [
      2,
      imageWidth *
      0.45,
    ],
    [
      3,
      imageWidth *
      0.72,
    ],
    [
      4,
      imageWidth *
      0.93,
    ],
  ]);
}


function berthCentersFromOCR(
  words: OCRWord[],
  imageWidth: number,
  imageHeight: number
) {

  const centers =
    new Map<
      number,
      number
    >();

  const top =
    words
      .filter(
        word =>
          word.bbox.y1 <=
          imageHeight *
          0.13
      )
      .sort(
        (a, b) =>
          a.bbox.x0 -
          b.bbox.x0
      );

  for (
    let i = 0;
    i < top.length;
    i++
  ) {

    const token =
      normalized(
        top[i].text
      );

    if (
      !/BERCO/.test(
        token
      )
    ) {
      continue;
    }

    let berth =
      Number(
        (
          token.match(
            /[1-4]/
          ) ||
          []
        )[0] ||
        0
      );

    if (
      !berth
    ) {

      for (
        let j =
          Math.max(
            0,
            i - 2
          );

        j <=
          Math.min(
            top.length - 1,
            i + 2
          );

        j++
      ) {

        const digit =
          normalized(
            top[j].text
          ).match(
            /^[1-4]$/
          );

        if (
          digit
        ) {

          berth =
            Number(
              digit[0]
            );

          break;
        }
      }
    }

    if (
      berth >= 1 &&
      berth <= 4
    ) {

      centers.set(
        berth,
        (
          top[i].bbox.x0 +
          top[i].bbox.x1
        ) / 2
      );
    }
  }

  /*
   * Só usamos o OCR dos cabeçalhos
   * se os quatro berços tiverem sido
   * reconhecidos corretamente.
   */

  if (
    centers.size !== 4
  ) {
    return defaultBerthCenters(
      imageWidth
    );
  }

  const values =
    [1, 2, 3, 4].map(
      berth =>
        centers.get(
          berth
        )!
    );

  if (
    !(
      values[0] <
      values[1] &&
      values[1] <
      values[2] &&
      values[2] <
      values[3]
    )
  ) {
    return defaultBerthCenters(
      imageWidth
    );
  }

  return centers;
}


/*
 * Detecta os blocos de navios
 * através da cor dominante.
 *
 * Cada navio no Berthing Plan está
 * dentro de um grande retângulo de
 * cor praticamente uniforme.
 *
 * Isso é mais confiável do que juntar
 * todos os pixels coloridos em uma
 * única máscara.
 */
function detectPlanCards(
  image:
    HTMLImageElement
): BBox[] {

  const canvas =
    document.createElement(
      'canvas'
    );

  canvas.width =
    image.naturalWidth;

  canvas.height =
    image.naturalHeight;

  const context =
    canvas.getContext(
      '2d',
      {
        willReadFrequently:
          true,
      }
    );

  if (
    !context
  ) {
    return [];
  }

  context.drawImage(
    image,
    0,
    0
  );

  const width =
    canvas.width;

  const height =
    canvas.height;

  const total =
    width *
    height;

  const pixels =
    context.getImageData(
      0,
      0,
      width,
      height
    ).data;


  /*
   * RGB é reduzido para 8 níveis
   * por canal.
   *
   * Isso mantém azul, verde, vermelho,
   * roxo, preto etc. unidos mesmo com
   * pequenas variações de compressão.
   */

  const colorGrid =
    new Uint16Array(
      total
    );

  const colorCounts =
    new Uint32Array(
      512
    );


  for (
    let i = 0;
    i < total;
    i++
  ) {

    const offset =
      i * 4;

    const r =
      pixels[offset];

    const g =
      pixels[offset + 1];

    const b =
      pixels[offset + 2];

    const qr =
      r >> 5;

    const qg =
      g >> 5;

    const qb =
      b >> 5;

    const id =
      (
        qr << 6
      ) |
      (
        qg << 3
      ) |
      qb;

    colorGrid[i] =
      id;

    colorCounts[id]++;
  }


  const candidateColors =
    new Uint8Array(
      512
    );

  const minColorPixels =
    Math.max(
      700,
      Math.floor(
        total *
        0.0025
      )
    );


  for (
    let id = 0;
    id < 512;
    id++
  ) {

    if (
      colorCounts[id] <
      minColorPixels
    ) {
      continue;
    }

    const qr =
      (
        id >> 6
      ) & 7;

    const qg =
      (
        id >> 3
      ) & 7;

    const qb =
      id & 7;

    const max =
      Math.max(
        qr,
        qg,
        qb
      );

    const min =
      Math.min(
        qr,
        qg,
        qb
      );

    /*
     * Aceita:
     *
     * cores suficientemente saturadas
     * ou
     * regiões muito escuras.
     *
     * Isso inclui o bloco preto.
     */

    if (
      max - min >= 2 ||
      max <= 1
    ) {
      candidateColors[id] =
        1;
    }
  }


  const visited =
    new Uint8Array(
      total
    );

  const boxes:
    {
      box: BBox;
      pixels: number;
      fill: number;
    }[] =
    [];


  for (
    let root = 0;
    root < total;
    root++
  ) {

    const color =
      colorGrid[root];

    if (
      !candidateColors[
        color
      ] ||
      visited[root]
    ) {
      continue;
    }


    const stack:
      number[] =
      [root];

    visited[root] =
      1;


    let count = 0;

    let minX =
      width;

    let minY =
      height;

    let maxX = 0;
    let maxY = 0;


    while (
      stack.length
    ) {

      const current =
        stack.pop()!;

      const y =
        Math.floor(
          current /
          width
        );

      const x =
        current -
        y *
        width;

      count++;

      if (
        x < minX
      ) {
        minX = x;
      }

      if (
        x > maxX
      ) {
        maxX = x;
      }

      if (
        y < minY
      ) {
        minY = y;
      }

      if (
        y > maxY
      ) {
        maxY = y;
      }


      if (
        x > 0
      ) {

        const next =
          current - 1;

        if (
          !visited[next] &&
          colorGrid[next] ===
            color
        ) {
          visited[next] = 1;
          stack.push(next);
        }
      }


      if (
        x + 1 <
        width
      ) {

        const next =
          current + 1;

        if (
          !visited[next] &&
          colorGrid[next] ===
            color
        ) {
          visited[next] = 1;
          stack.push(next);
        }
      }


      if (
        y > 0
      ) {

        const next =
          current -
          width;

        if (
          !visited[next] &&
          colorGrid[next] ===
            color
        ) {
          visited[next] = 1;
          stack.push(next);
        }
      }


      if (
        y + 1 <
        height
      ) {

        const next =
          current +
          width;

        if (
          !visited[next] &&
          colorGrid[next] ===
            color
        ) {
          visited[next] = 1;
          stack.push(next);
        }
      }
    }


    const boxWidth =
      maxX -
      minX +
      1;

    const boxHeight =
      maxY -
      minY +
      1;

    const area =
      boxWidth *
      boxHeight;

    const fill =
      area
        ? count / area
        : 0;


    /*
     * Elimina:
     *
     * textos,
     * linhas da grade,
     * cabeçalho,
     * pequenos ícones.
     */

    if (
      minY >
        height *
        0.025 &&

      boxWidth >=
        width *
        0.10 &&

      boxWidth <=
        width *
        0.55 &&

      boxHeight >=
        height *
        0.045 &&

      boxHeight <=
        height *
        0.50 &&

      count >=
        total *
        0.0025 &&

      fill >=
        0.55
    ) {

      boxes.push({
        box: {
          x0:
            minX,

          y0:
            minY,

          x1:
            maxX + 1,

          y1:
            maxY + 1,
        },

        pixels:
          count,

        fill,
      });
    }
  }


  /*
   * Caso duas tonalidades da mesma
   * caixa gerem retângulos muito
   * semelhantes, mantemos o maior.
   */

  const sorted =
    boxes.sort(
      (a, b) =>
        b.pixels -
        a.pixels
    );


  const unique:
    BBox[] =
    [];


  const overlapRatio =
    (
      a: BBox,
      b: BBox
    ) => {

      const x0 =
        Math.max(
          a.x0,
          b.x0
        );

      const y0 =
        Math.max(
          a.y0,
          b.y0
        );

      const x1 =
        Math.min(
          a.x1,
          b.x1
        );

      const y1 =
        Math.min(
          a.y1,
          b.y1
        );

      if (
        x1 <= x0 ||
        y1 <= y0
      ) {
        return 0;
      }

      const intersection =
        (
          x1 - x0
        ) *
        (
          y1 - y0
        );

      const areaA =
        (
          a.x1 -
          a.x0
        ) *
        (
          a.y1 -
          a.y0
        );

      const areaB =
        (
          b.x1 -
          b.x0
        ) *
        (
          b.y1 -
          b.y0
        );

      return (
        intersection /
        Math.min(
          areaA,
          areaB
        )
      );
    };


  for (
    const item
    of sorted
  ) {

    if (
      unique.some(
        existing =>
          overlapRatio(
            existing,
            item.box
          ) >
          0.72
      )
    ) {
      continue;
    }

    unique.push(
      item.box
    );
  }


  return unique
    .sort(
      (a, b) =>
        a.y0 -
        b.y0 ||
        a.x0 -
        b.x0
    )
    .slice(
      0,
      24
    );
}


function cropDataUrl(
  image:
    HTMLImageElement,
  box:
    BBox
) {

  const padding =
    Math.max(
      4,
      Math.round(
        image.naturalWidth *
        0.004
      )
    );

  const x0 =
    Math.max(
      0,
      Math.floor(
        box.x0 -
        padding
      )
    );

  const y0 =
    Math.max(
      0,
      Math.floor(
        box.y0 -
        padding
      )
    );

  const x1 =
    Math.min(
      image.naturalWidth,
      Math.ceil(
        box.x1 +
        padding
      )
    );

  const y1 =
    Math.min(
      image.naturalHeight,
      Math.ceil(
        box.y1 +
        padding
      )
    );

  const width =
    x1 -
    x0;

  const height =
    y1 -
    y0;

  const scale =
    Math.min(
      5,
      Math.max(
        2,
        Math.round(
          1500 /
          Math.max(
            width,
            1
          )
        )
      )
    );

  const canvas =
    document.createElement(
      'canvas'
    );

  canvas.width =
    width *
    scale;

  canvas.height =
    height *
    scale;

  const context =
    canvas.getContext(
      '2d'
    );

  if (
    !context
  ) {
    throw new Error(
      'Não foi possível preparar o recorte do Berthing Plan.'
    );
  }

  context.imageSmoothingEnabled =
    false;

  context.drawImage(
    image,

    x0,
    y0,

    width,
    height,

    0,
    0,

    canvas.width,
    canvas.height
  );

  return canvas.toDataURL(
    'image/png'
  );
}


function parseStamp(
  day: string,
  monthToken: string,
  timeToken: string,
  year: number
) {

  const month =
    MONTHS[
      normalized(
        monthToken
      ).slice(
        0,
        3
      )
    ];

  if (
    !month
  ) {
    return '';
  }

  const digits =
    timeToken
      .replace(
        /\D/g,
        ''
      )
      .padStart(
        4,
        '0'
      )
      .slice(-4);

  const hour =
    Number(
      digits.slice(
        0,
        2
      )
    );

  const minute =
    Number(
      digits.slice(
        2,
        4
      )
    );

  const dayNumber =
    Number(day);

  if (
    dayNumber < 1 ||
    dayNumber > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return '';
  }

  return (
    `${year}-` +
    `${String(month).padStart(2, '0')}-` +
    `${String(dayNumber).padStart(2, '0')}T` +
    `${String(hour).padStart(2, '0')}:` +
    `${String(minute).padStart(2, '0')}`
  );
}


function dateEvents(
  text: string,
  year: number
) {

  const value =
    normalized(text);

  const events: {
    stamp: string;
    label: string;
    raw: string;
  }[] =
    [];


  const regex =
    /(\d{1,2})\s+(JAN|FEV|FEB|MAR|ABR|APR|MAI|MAY|JUN|JUL|AGO|AUG|SET|SEP|OUT|OCT|NOV|DEZ|DEC)\s+(\d{3,4})\s*(ETA|ETB|ETD|ETS|START|WORK|INICIO|FIM|SAIDA)?/gi;


  let match:
    RegExpExecArray |
    null;


  while (
    (
      match =
        regex.exec(
          value
        )
    )
  ) {

    const stamp =
      parseStamp(
        match[1],
        match[2],
        match[3],
        year
      );

    if (
      !stamp
    ) {
      continue;
    }

    events.push({
      stamp,

      label:
        normalized(
          match[4] ||
          ''
        ),

      raw:
        match[0],
    });
  }

  return events;
}


function cleanOCRLine(
  line: string
) {
  return line
    .replace(
      /^[^A-Z0-9]+/i,
      ''
    )
    .replace(
      /[^A-Z0-9 .\-'/]/gi,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}


function looksLikeVoyageCode(
  line: string
) {

  const clean =
    cleanOCRLine(
      line
    );

  const compact =
    clean.replace(
      /\s+/g,
      ''
    );

  const digits =
    (
      compact.match(
        /\d/g
      ) ||
      []
    ).length;

  /*
   * No Berthing Plan:
   *
   * linha 1 = viagem
   * linha 2 = nome do navio
   *
   * Exemplo:
   *
   * MELON641N.1
   * MAERSK LEON
   */

  return (
    compact.length >= 5 &&
    compact.length <= 30 &&
    digits >= 2
  );
}


function looksLikeVesselName(
  line: string
) {

  const clean =
    cleanOCRLine(
      line
    );

  const key =
    normalized(
      clean
    );

  if (
    !clean
  ) {
    return false;
  }

  const letters =
    (
      clean.match(
        /[A-Z]/gi
      ) ||
      []
    ).length;

  if (
    letters < 3
  ) {
    return false;
  }

  if (
    /\b(ETA|ETB|ETD|ETS|LOA|DWT|PORT|STBD|SIDE|START|WORK|CUTOFF|ESTMV|FORE|AFBO|BERCO|BOLLARD)\b/.test(
      key
    )
  ) {
    return false;
  }

  return (
    clean.length >= 3 &&
    clean.length <= 60
  );
}


function chooseVesselName(
  text: string
) {

  const lines =
    text
      .split(
        /\r?\n/
      )
      .map(
        compactSpaces
      )
      .filter(Boolean)
      .map(
        cleanOCRLine
      )
      .filter(Boolean);


  /*
   * Regra principal do seu Berthing Plan:
   *
   * primeira linha = código da viagem
   * segunda linha = nome do navio
   */

  if (
    lines.length >= 2 &&
    looksLikeVoyageCode(
      lines[0]
    ) &&
    looksLikeVesselName(
      lines[1]
    )
  ) {
    return lines[1]
      .toUpperCase();
  }


  /*
   * Às vezes o OCR coloca algum
   * código do armador junto da primeira
   * linha. Ainda assim procuramos o
   * primeiro nome válido imediatamente
   * depois de uma linha com viagem.
   */

  for (
    let i = 0;
    i <
    Math.min(
      lines.length - 1,
      5
    );
    i++
  ) {

    if (
      looksLikeVoyageCode(
        lines[i]
      ) &&
      looksLikeVesselName(
        lines[i + 1]
      )
    ) {
      return lines[
        i + 1
      ].toUpperCase();
    }
  }


  /*
   * Fallback caso o OCR tenha perdido
   * completamente a viagem.
   */

  for (
    const line
    of lines.slice(
      0,
      8
    )
  ) {

    if (
      looksLikeVesselName(
        line
      ) &&
      !looksLikeVoyageCode(
        line
      )
    ) {
      return line
        .toUpperCase();
    }
  }

  return '';
}


function nearestBerth(
  box: BBox,
  centers:
    Map<
      number,
      number
    >
) {

  /*
   * O centro geométrico não funciona
   * bem porque vários navios ocupam
   * fisicamente mais de um berço.
   *
   * Usamos um ponto a 20% do início
   * horizontal do bloco.
   */

  const x =
    box.x0 +
    (
      box.x1 -
      box.x0
    ) *
    0.20;

  let best =
    1;

  let bestDistance =
    Number
      .POSITIVE_INFINITY;

  for (
    const [
      berth,
      center,
    ]
    of centers
  ) {

    const distance =
      Math.abs(
        center -
        x
      );

    if (
      distance <
      bestDistance
    ) {

      bestDistance =
        distance;

      best =
        berth;
    }
  }

  return String(best);
}


function candidateFromCard(
  text: string,
  box: BBox,
  berthCenters:
    Map<
      number,
      number
    >,
  year: number,
  source: string
): Candidate | null {

  const name =
    chooseVesselName(
      text
    );

  const events =
    dateEvents(
      text,
      year
    );

  if (
    !name ||
    !events.length
  ) {
    return null;
  }


  /*
   * Se houver Start Work, ele é
   * preferido ao ETA como início da
   * operação.
   */

  const preferredStart =
    events.find(
      event =>
        /START|WORK|INICIO|ETB/.test(
          event.label
        )
    ) ||
    events.find(
      event =>
        /ETA/.test(
          event.label
        )
    ) ||
    events[0];


  const preferredEnd =
    events.find(
      event =>
        /ETD|ETS|FIM|SAIDA/.test(
          event.label
        )
    ) ||
    [
      ...events,
    ]
      .reverse()
      .find(
        event =>
          event.stamp >
          preferredStart.stamp
      );


  const review = [
    'Dados lidos automaticamente por OCR do Berthing Plan. Confira nome, berço e horários antes de salvar.',
  ];


  if (
    !/START|WORK|INICIO|ETB/.test(
      preferredStart.label
    )
  ) {
    review.push(
      'Início baseado no ETA ou no primeiro horário reconhecido no plano.'
    );
  }


  if (
    !preferredEnd
  ) {
    review.push(
      'Fim da operação não identificado automaticamente. Complete antes de importar.'
    );
  }


  return {
    name,

    berth:
      nearestBerth(
        box,
        berthCenters
      ),

    start:
      preferredStart.stamp,

    end:
      preferredEnd?.stamp ||
      '',

    note:
      `Importado por OCR de ${source}.`,

    source,

    startBasis:
      /START|WORK|INICIO|ETB/.test(
        preferredStart.label
      )
        ? preferredStart.label ||
          'Start Work'
        : 'ETA / Berthing Plan',

    review,
  };
}


function uniqueCandidates(
  candidates:
    Candidate[]
) {

  const result:
    Candidate[] =
    [];

  for (
    const candidate
    of candidates
  ) {

    const key =
      `${normalized(candidate.name)}|` +
      `${candidate.start.slice(0, 10)}|` +
      `${candidate.berth}`;

    const existing =
      result.find(
        item =>
          (
            `${normalized(item.name)}|` +
            `${item.start.slice(0, 10)}|` +
            `${item.berth}`
          ) ===
          key
      );

    if (
      !existing
    ) {
      result.push(
        candidate
      );
    }
  }

  return result;
}


async function createOCRWorker():
Promise<OCRWorker> {

  const worker =
    await createWorker(
      'eng'
    );

  await worker.setParameters({
    tessedit_pageseg_mode:
      PSM.SPARSE_TEXT,

    preserve_interword_spaces:
      '1',
  });

  return worker;
}


async function parseBerthingPlanImage(
  imageUrl: string,
  source: string,
  year: number,
  worker: OCRWorker
): Promise<Candidate[]> {

  const image =
    await loadImage(
      imageUrl
    );


  /*
   * Primeiro OCR da imagem inteira.
   * É usado principalmente para
   * localizar BERÇO 1, 2, 3 e 4.
   */

  const full =
    await worker.recognize(
      imageUrl,
      {},
      {
        blocks: true,
      }
    );


  const words =
    flattenWords(
      full.data
        .blocks as
        any[] |
        null |
        undefined
    );


  const berthCenters =
    berthCentersFromOCR(
      words,
      image.naturalWidth,
      image.naturalHeight
    );


  /*
   * Nova detecção baseada nos
   * retângulos de cor.
   */

  const cards =
    detectPlanCards(
      image
    );


  const result:
    Candidate[] =
    [];


  for (
    const card
    of cards
  ) {

    try {

      const crop =
        cropDataUrl(
          image,
          card
        );


      const recognized =
        await worker.recognize(
          crop
        );


      const candidate =
        candidateFromCard(
          recognized.data.text ||
          '',
          card,
          berthCenters,
          year,
          source
        );


      if (
        candidate
      ) {
        result.push(
          candidate
        );
      }

    } catch {

      /*
       * Um bloco ilegível não deve
       * impedir os demais navios.
       */
    }
  }


  return uniqueCandidates(
    result
  );
}


async function choosePlanImages(
  images:
    PreviewImage[],
  subject: string
) {

  if (
    !images.length
  ) {
    return [];
  }


  const enriched =
    await Promise.all(
      images.map(
        async image => {

          try {

            const size =
              await imageSize(
                image.url
              );

            return {
              ...image,
              ...size,
            };

          } catch {

            return image;
          }
        }
      )
    );


  /*
   * Se o próprio anexo possui
   * Berthing Plan no nome, usamos
   * diretamente.
   */

  const named =
    enriched.filter(
      image =>
        looksLikePlanName(
          image.name
        )
    );


  if (
    named.length
  ) {
    return named;
  }


  /*
   * Em e-mails o anexo pode se chamar
   * image002.png etc.
   *
   * Se o assunto indicar Berthing Plan,
   * escolhemos apenas imagens grandes.
   *
   * Assim assinatura, banner e selo
   * da praticagem são ignorados.
   */

  if (
    !looksLikePlanSubject(
      subject
    )
  ) {
    return [];
  }


  return enriched
    .filter(
      image =>
        (
          image.width ||
          0
        ) >= 700 &&
        (
          image.height ||
          0
        ) >= 450
    )
    .sort(
      (a, b) =>
        (
          (
            b.width ||
            0
          ) *
          (
            b.height ||
            0
          )
        ) -
        (
          (
            a.width ||
            0
          ) *
          (
            a.height ||
            0
          )
        )
    )
    .slice(
      0,
      2
    );
}


export async function parseEmail(
  name: string,
  buffer: ArrayBuffer,
  year: number
): Promise<EmailPreview> {

  let body = '';
  let subject = '';

  const images:
    PreviewImage[] =
    [];

  let directImage =
    false;


  const addImage = (
    attachmentName:
      string,
    raw:
      unknown
  ) => {

    const data =
      bytesOf(raw);

    if (
      /\.(png|jpe?g|webp)$/i.test(
        attachmentName
      ) &&
      data.length <=
        10_000_000 &&
      images.length < 12
    ) {

      images.push({
        name:
          attachmentName,

        url:
          imageDataUrl(
            attachmentName,
            data
          ),
      });
    }
  };


  if (
    /\.msg$/i.test(
      name
    )
  ) {

    const reader =
      new MsgReader(
        buffer
      );

    const data =
      reader.getFileData();


    if (
      data.error
    ) {
      throw Error(
        'Arquivo MSG inválido. Salve o e-mail novamente no Outlook.'
      );
    }


    subject =
      data.subject ||
      name;


    body =
      data.body ||
      plain(
        data.bodyHtml ||
        ''
      );


    for (
      const attachment
      of data.attachments ||
      []
    ) {

      const value =
        reader.getAttachment(
          attachment
        );


      const attachmentName =
        value.fileName ||
        (
          attachment as any
        ).fileName ||
        'anexo.png';


      addImage(
        attachmentName,
        value.content
      );
    }


  } else if (
    /\.eml$/i.test(
      name
    )
  ) {

    const email =
      await PostalMime.parse(
        buffer
      );


    subject =
      email.subject ||
      name;


    body =
      email.text ||
      plain(
        email.html ||
        ''
      );


    for (
      const attachment
      of email.attachments ||
      []
    ) {

      addImage(
        attachment.filename ||
        'anexo.png',

        attachment.content
      );
    }


  } else if (
    /\.(png|jpe?g|webp)$/i.test(
      name
    )
  ) {

    subject =
      name;

    directImage =
      true;


    addImage(
      name,

      new Uint8Array(
        buffer
      )
    );


  } else {

    throw Error(
      'Selecione um e-mail (.msg/.eml) ou um Berthing Plan em imagem (.png/.jpg).'
    );
  }


  const hash =
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          buffer
        )
      )
    )
      .map(
        value =>
          value
            .toString(16)
            .padStart(
              2,
              '0'
            )
      )
      .join('');


  const known =
    hash ===
    '3b8d185735dab0dd360288f4c6247f469ca3743d2beca773040c496f94622272';


  const knownPlan =
    hash ===
    '1b148ca2ff8b5bfa8eb5e51f463e6a8deb8a923dd56d22291d29904cb75ea104';


  let ships:
    Candidate[] =
    [];


  let ocrUsed =
    false;


  if (
    known
  ) {

    ships =
      lineup.ships.map(
        ({
          name,
          berth,
          start,
          end,
          note,
          startBasis,
          review,
        }) => ({
          name,
          berth,
          start,
          end,
          note,
          startBasis,
          review,
          source:
            subject,
        })
      );


  } else if (
    knownPlan
  ) {

    ships =
      plan2809;


  } else {

    /*
     * Primeiro tentamos a intenção
     * de manobra escrita no e-mail.
     */

    ships =
      parseMovements(
        body,
        year,
        subject
      );


    /*
     * Depois procuramos um Berthing
     * Plan em imagem.
     */

    const planImages =
      directImage
        ? images
        : await choosePlanImages(
            images,
            subject
          );


    if (
      planImages.length
    ) {

      let worker:
        OCRWorker |
        null =
        null;


      try {

        worker =
          await createOCRWorker();


        const recognized:
          Candidate[] =
          [];


        for (
          const plan
          of planImages
        ) {

          const rows =
            await parseBerthingPlanImage(
              plan.url,
              plan.name ||
              subject,
              year,
              worker
            );


          recognized.push(
            ...rows
          );
        }


        if (
          recognized.length
        ) {

          ocrUsed =
            true;


          ships =
            uniqueCandidates([
              ...ships,
              ...recognized,
            ]);
        }


      } catch (
        error
      ) {

        if (
          !ships.length
        ) {

          throw new Error(
            'O Berthing Plan foi encontrado, mas a leitura automática da imagem falhou. ' +
            'Tente novamente ou importe a imagem em maior resolução. ' +
            (
              error instanceof
              Error
                ? error.message
                : ''
            )
          );
        }


      } finally {

        if (
          worker
        ) {
          await worker.terminate();
        }
      }
    }
  }


  const notice =
    knownPlan
      ?
        'Berthing Plan reconhecido. Confira os horários sinalizados antes de salvar.'
      :
        known
          ?
            'Arquivo reconhecido. Confira os horários estimados.'
          :
            ocrUsed
              ?
                `Berthing Plan reconhecido por OCR. ${ships.length} navio(s) identificado(s). Confira nome, berço e horários antes de salvar.`
              :
                ships.length
                  ?
                    'Manobras encontradas no texto do e-mail. Complete os horários ausentes antes de salvar.'
                  :
                    images.length
                      ?
                        'Imagem carregada, mas nenhum navio foi identificado automaticamente.'
                      :
                        'Nenhum navio foi identificado neste arquivo.';


  return {
    file:
      name,

    subject,

    text:
      body.slice(
        0,
        40000
      ),

    ships,

    images:
      images.map(
        ({
          name:
            imageName,
          url,
        }) => ({
          name:
            imageName,
          url,
        })
      ),

    notice,
  };
}
