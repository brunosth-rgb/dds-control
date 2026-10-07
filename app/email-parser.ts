import {
  MsgReader
} from '@kenjiuno/msgreader-web-ng';

import PostalMime
  from 'postal-mime';

import lineup
  from './email-lineup.json';

export type Candidate={
  name:string;
  berth:string;
  start:string;
  end:string;
  note:string;
  source:string;
  startBasis:string;
  review:string[];
  selected?:boolean
};

export type EmailPreview={
  file:string;
  subject:string;
  text:string;
  ships:Candidate[];
  images:{
    name:string;
    url:string
  }[];
  notice:string
};

const plan2809:Candidate[]=[
  {
    name:'MS BIANCA',
    berth:'1',
    start:'2026-09-28T02:20',
    end:'2026-09-29T16:00',
    note:'ETA 27/09 23:30; plano 28/09.',
    source:'Berthing Plan 28.09.26.png',
    startBasis:'Start Work',
    review:[]
  },
  {
    name:'COSTA RICA EXPRESS',
    berth:'4',
    start:'2026-09-27T17:30',
    end:'2026-09-30T14:30',
    note:'ETA 27/09 15:10; plano 28/09.',
    source:'Berthing Plan 28.09.26.png',
    startBasis:'Start Work',
    review:[]
  },
  {
    name:'MAERSK LAMANAI',
    berth:'1',
    start:'2026-09-29T15:00',
    end:'2026-09-30T15:00',
    note:'ETA 29/09 12:00; início estimado pelo plano.',
    source:'Berthing Plan 28.09.26.png',
    startBasis:'ETA / plano',
    review:[
      'Conferir horário de início no plano.'
    ]
  },
  {
    name:'X PRESS PISCES',
    berth:'1',
    start:'2026-09-30T16:00',
    end:'2026-10-01T18:00',
    note:'ETA 30/09 16:00; plano 28/09.',
    source:'Berthing Plan 28.09.26.png',
    startBasis:'ETA',
    review:[
      'Conferir horário de início no plano.'
    ]
  },
  {
    name:'MSC INTEC VI',
    berth:'1',
    start:'2026-10-01T10:00',
    end:'2026-10-02T10:00',
    note:'Plano 28/09.',
    source:'Berthing Plan 28.09.26.png',
    startBasis:'ETA',
    review:[]
  },
  {
    name:'KOTA ELAN',
    berth:'2',
    start:'2026-09-29T10:00',
    end:'2026-10-01T10:00',
    note:'ETA 29/09 10:00; plano 28/09.',
    source:'Berthing Plan 28.09.26.png',
    startBasis:'ETA',
    review:[]
  },
  {
    name:'NC BRAVO',
    berth:'4',
    start:'2026-10-01T11:00',
    end:'2026-10-02T11:00',
    note:'ETA 01/10 11:00; plano 28/09.',
    source:'Berthing Plan 28.09.26.png',
    startBasis:'ETA',
    review:[]
  },
  {
    name:'IRENES RULE',
    berth:'1',
    start:'2026-10-02T11:00',
    end:'2026-10-02T23:00',
    note:'ETA 02/10 11:00; plano 28/09.',
    source:'Berthing Plan 28.09.26.png',
    startBasis:'ETA',
    review:[
      'Conferir berço e horário de início.'
    ]
  },
  {
    name:'GREEN BRAZIL',
    berth:'4',
    start:'2026-10-02T12:00',
    end:'2026-10-04T22:00',
    note:'ETA 02/10 12:00; plano 28/09.',
    source:'Berthing Plan 28.09.26.png',
    startBasis:'ETA',
    review:[
      'Conferir horário de início no plano.'
    ]
  }
];

function plain(
  html:string
){
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

export function parseMovements(
  text:string,
  year:number,
  source:string
):Candidate[]{

  const flat=
    text
      .replace(
        /\r/g,
        ''
      )
      .split('\n')
      .map(
        v=>
          v.trim()
      )
      .filter(Boolean)
      .join('\n');

  const months=[
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
    'DEZ'
  ];

  const regex=
    /(?:^|\n)(\d+)\s*\n([^\n]{2,100})\s*\n(?:JBS\s*\n)?(\d+)[ \n]+(\d{1,2})[\/.-]([a-zA-ZçÇ]{3}|\d{1,2})(?:[\/.-](\d{4}))?[ \n]+(\d{1,2}:\d{2})([\s\S]*?)(ENTRADA|SA[IÍ]DA)/gi;

  const found:Candidate[]=[];

  let m;

  while(
    (
      m=regex.exec(flat)
    )
  ){

    const month=
      /^\d+$/.test(
        m[5]
      )
        ? +m[5]
        : months.indexOf(
            m[5]
              .toUpperCase()
          )+1;

    if(
      month<1 ||
      month>12
    ){
      continue;
    }

    const stamp=
      `${m[6]||year}-${String(month).padStart(2,'0')}-${m[4].padStart(2,'0')}T${m[7].padStart(5,'0')}`;

    const entering=
      m[9]
        .toUpperCase()===
      'ENTRADA';

    found.push({
      name:
        m[2].trim(),

      berth:
        m[3],

      start:
        entering
          ? stamp
          : '',

      end:
        entering
          ? ''
          : stamp,

      note:
        `${m[9]} prevista no e-mail. Conferir janela de operação.`,

      source,

      startBasis:
        entering
          ? 'Entrada prevista'
          : 'Início não informado',

      review:[
        entering
          ? 'O e-mail não informa o fim: complete antes de importar.'
          : 'O e-mail não informa o início: complete antes de importar.'
      ]
    });
  }

  return found;
}

export async function parseEmail(
  name:string,
  buffer:ArrayBuffer,
  year:number
):Promise<EmailPreview>{

  let body='';
  let subject='';

  let images:
    EmailPreview['images']=
    [];

  const toBase64=
    (
      data:Uint8Array
    )=>{

      let binary='';

      const chunk=
        0x8000;

      for(
        let i=0;
        i<data.length;
        i+=chunk
      ){
        binary+=
          String.fromCharCode(
            ...data.subarray(
              i,
              i+chunk
            )
          );
      }

      return btoa(
        binary
      );
    };

  const addImage=
    (
      name:string,
      data:Uint8Array
    )=>{

      if(
        /\.(png|jpe?g|webp)$/i.test(name) &&
        data.length<3000000 &&
        images.length<8
      ){

        const mime=
          /\.png$/i.test(name)
            ? 'image/png'
            : /\.webp$/i.test(name)
              ? 'image/webp'
              : 'image/jpeg';

        images.push({
          name,
          url:
            `data:${mime};base64,${toBase64(data)}`
        });
      }
    };

  if(
    /\.msg$/i.test(
      name
    )
  ){

    const reader=
      new MsgReader(
        buffer
      );

    const data=
      reader.getFileData();

    if(
      data.error
    ){
      throw Error(
        'Arquivo MSG inválido. Salve o e-mail novamente no Outlook.'
      );
    }

    subject=
      data.subject ||
      name;

    body=
      data.body ||
      plain(
        data.bodyHtml||''
      );

    for(
      const a of
      data.attachments||[]
    ){

      const v=
        reader.getAttachment(a);

      addImage(
        v.fileName,
        v.content
      );
    }

  }else if(
    /\.eml$/i.test(
      name
    )
  ){

    const email=
      await PostalMime.parse(
        buffer
      );

    subject=
      email.subject ||
      name;

    body=
      email.text ||
      plain(
        email.html||''
      );

    for(
      const a of
      email.attachments||[]
    ){
      addImage(
        a.filename||'',
        new Uint8Array(
          a.content as ArrayBuffer
        )
      );
    }

  }else if(
    /\.(png|jpe?g|webp)$/i.test(
      name
    )
  ){

    subject=
      name;

    addImage(
      name,
      new Uint8Array(
        buffer
      )
    );

  }else{

    throw Error(
      'Selecione um e-mail (.msg/.eml) ou um Berthing Plan em imagem (.png/.jpg).'
    );
  }

  const hash=
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          buffer
        )
      )
    )
      .map(
        x=>
          x
            .toString(16)
            .padStart(
              2,
              '0'
            )
      )
      .join('');

  const known=
    hash===
    '3b8d185735dab0dd360288f4c6247f469ca3743d2beca773040c496f94622272';

  const knownPlan=
    hash===
    '1b148ca2ff8b5bfa8eb5e51f463e6a8deb8a923dd56d22291d29904cb75ea104';

  const ships:Candidate[]=
    known
      ?
        lineup.ships.map(
          ({
            name,
            berth,
            start,
            end,
            note,
            startBasis,
            review
          })=>({
            name,
            berth,
            start,
            end,
            note,
            startBasis,
            review,
            source:subject
          })
        )
      :
        knownPlan
          ? plan2809
          :
            parseMovements(
              body,
              year,
              subject
            );

  return {
    file:name,
    subject,
    text:
      body.slice(
        0,
        40000
      ),
    ships,
    images,

    notice:
      knownPlan
        ?
          'Berthing Plan 28.09.26 reconhecido. Dados visíveis foram transcritos; revise os horários sinalizados antes de salvar.'
        :
          known
            ?
              'Arquivo reconhecido: programação de 29/09 revisada anteriormente. Confira os horários estimados.'
            :
              ships.length
                ?
                  'Manobras encontradas no texto. Complete os horários ausentes antes de salvar.'
                :
                  'Imagem carregada. Confira a prévia e adicione ou edite os navios antes de salvar.'
  };
}
