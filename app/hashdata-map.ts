import {
  type RecordDDS,
  normalizePeriod,
  norm
} from './domain';

export type Mapping={
  applied:string;
  period:string;
  type:string;
  sector?:string;
  ship?:string;
  applicator?:string;
  supervisor?:string;
  participants?:string;
  topics?:string;
  photo?:string;
  signature?:string;
};

function text(value:unknown):string{
  if(value===null||value===undefined)return '';

  if(Array.isArray(value)){
    return value.map(text).filter(Boolean).join(', ');
  }

  if(typeof value==='object'){
    const object=value as Record<string,unknown>;

    for(const key of ['value','label','name','text','answer']){
      if(object[key]!==undefined){
        const found=text(object[key]);
        if(found)return found;
      }
    }

    return Object.values(object).map(text).filter(Boolean).join(', ');
  }

  return String(value).trim();
}

function keyNorm(value:string){
  return norm(value).replace(/[^A-Z0-9]/g,'');
}

function mappedValue(
  record:Record<string,unknown>,
  key:string|undefined
){
  if(!key)return '';
  return text(record[key]);
}

function hintedValue(
  record:Record<string,unknown>,
  hints:string[]
){
  const entries=Object.entries(record);

  for(const hint of hints){
    const wanted=keyNorm(hint);

    const exact=entries.find(([key])=>keyNorm(key)===wanted);
    if(exact){
      const found=text(exact[1]);
      if(found)return found;
    }

    const partial=entries.find(([key])=>keyNorm(key).includes(wanted));
    if(partial){
      const found=text(partial[1]);
      if(found)return found;
    }
  }

  return '';
}

function valueOf(
  record:Record<string,unknown>,
  mapped:string|undefined,
  hints:string[]
){
  return mappedValue(record,mapped)||hintedValue(record,hints);
}

function toLocalTimestamp(value:string){
  const raw=value.trim();

  if(!raw)throw new Error('Data da aplicação não informada.');

  if(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw)
  ){
    return raw.length===16?raw+':00':raw;
  }

  const date=new Date(raw);
  if(!Number.isFinite(date.getTime())){
    throw new Error('Data da aplicação inválida.');
  }

  return new Intl.DateTimeFormat(
    'sv-SE',
    {
      timeZone:'America/Sao_Paulo',
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
      hour:'2-digit',
      minute:'2-digit',
      second:'2-digit',
      hour12:false
    }
  ).format(date).replace(' ','T');
}

function normalizeType(value:string){
  const n=norm(value);

  if(!n)return '';
  if(n==='CAM'||n.includes('CAMINHA'))return 'CAM';
  if(n==='RS'||n.includes('REACH STACKER'))return 'RS';
  if(n.includes('GATE'))return 'GATE';
  if(n.includes('REEFER'))return 'REEFER';
  if(n.includes('ARMAZ'))return 'ARMAZÉM';
  if(n.includes('NAVIO')||n.includes('VESSEL'))return 'NAVIO';

  return n;
}

function booleanValue(value:unknown){
  if(value===true)return true;
  if(value===false||value===null||value===undefined)return false;
  if(Array.isArray(value))return value.length>0;

  if(typeof value==='object'){
    return Object.keys(value as object).length>0;
  }

  const n=norm(String(value));
  return !['','NAO','N','FALSE','0','SEM','NA'].includes(n);
}

function sourceOf(record:Record<string,unknown>){
  const form=text(
    record.form_name||
    record.formName||
    record.form_title||
    record.formTitle||
    record.formulario||
    record.form
  );

  return 'Hashdata API'+(form?' • '+form:'');
}

function recordId(record:Record<string,unknown>){
  const id=text(
    record.col_id||
    record.id||
    record._id||
    record.response_id||
    record.responseId
  );

  if(!id)throw new Error('Registro Hashdata sem ID.');
  return id;
}

export function mapRecord(
  record:Record<string,unknown>,
  mapping:Mapping
):RecordDDS{
  const applied=toLocalTimestamp(
    valueOf(record,mapping.applied,['data-aplicacao','dataaplicacao','aplicacao','datahora'])
  );

  const sector=valueOf(
    record,
    mapping.sector,
    ['setor','selecione-setor','area','departamento']
  );

  const type=normalizeType(
    valueOf(record,mapping.type,['qualdds','tipo-dds','tipodds','tipo'])
  );

  const period=normalizePeriod(
    valueOf(record,mapping.period,['periodo','turno','horario'])
  );

  return {
    id:recordId(record),
    sector,
    type,
    ship:valueOf(record,mapping.ship,['navio','vessel']),
    date:applied.slice(0,10),
    period,
    applied,
    applicator:valueOf(record,mapping.applicator,['nome-quem-aplicou-dds','aplicador','quem-aplicou']),
    supervisor:valueOf(record,mapping.supervisor,['supervisor','selecione-nome','nome-supervisor']),
    participants:valueOf(record,mapping.participants,['nome-dos-participantes','participantes']),
    topics:valueOf(record,mapping.topics,['temas-abordados','temas','assunto']),
    photo:booleanValue(
      mapping.photo
        ?record[mapping.photo]
        :hintedValue(record,['fotos_files','fotos','foto','anexos'])
    ),
    signature:booleanValue(
      mapping.signature
        ?record[mapping.signature]
        :hintedValue(record,['assinatura-dos-participantes_files','assinatura','assinaturas'])
    ),
    source:sourceOf(record)
  };
}

export function mergeRecords(
  current:RecordDDS[],
  incoming:RecordDDS[]
){
  const byId=new Map(current.map(r=>[r.id,r]));
  let added=0;
  let updated=0;

  for(const record of incoming){
    const previous=byId.get(record.id);

    if(!previous){
      byId.set(record.id,record);
      added++;
      continue;
    }

    if(JSON.stringify(previous)!==JSON.stringify(record)){
      byId.set(record.id,record);
      updated++;
    }
  }

  return {
    records:Array.from(byId.values()),
    added,
    updated
  };
}
