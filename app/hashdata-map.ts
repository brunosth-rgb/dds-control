import {norm,normalizePeriod,type RecordDDS} from './domain';
export const fields = {applied:'Data e hora da aplicação',period:'Período informado',type:'Tipo de DDS',ship:'Navio',applicator:'Aplicador',supervisor:'Supervisor',participants:'Participantes',topics:'Temas',photo:'Foto / anexos',signature:'Assinatura / anexos'};
export type Mapping = Partial<Record<keyof typeof fields,string>>;
export function textValue(v:unknown):string {
 if(v==null)return ''; if(Array.isArray(v))return v.map(textValue).filter(Boolean).join('; ');
 if(typeof v==='object')return JSON.stringify(v);return String(v).trim();
}
export function localDate(v:unknown){
 const raw=textValue(v);let s=raw;
 const br=/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}:\d{2})(?::\d{2})?$/.exec(s);
 if(br)s=`${br[3]}-${br[2]}-${br[1]}T${br[4]}`;
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s))throw Error('Data e hora da aplicação inválidas');
 const date=new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)?s:s+'-03:00');
 if(!Number.isFinite(date.getTime()))throw Error('Data inválida');
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date).replace(' ','T');
}
function evidence(v:unknown){if(Array.isArray(v))return v.length>0;const s=norm(textValue(v));return !!s&&!['FALSE','NAO','NÃO','0','NULL','[]'].includes(s);}
export function mapRecord(row:Record<string,unknown>,map:Mapping):RecordDDS {
 const id=textValue(row.col_id);if(!id)throw Error('Registro sem col_id');
 const get=(field:keyof Mapping)=>map[field]?row[map[field]!]:undefined;
 const applied=localDate(get('applied'));
 const type=norm(textValue(get('type')));const period=normalizePeriod(textValue(get('period')));
 return {id:'hashdata-'+id,type:type==='ARMAZEM'?'ARMAZÉM':type,period,applied,date:applied.slice(0,10),ship:textValue(get('ship')),applicator:textValue(get('applicator')),supervisor:textValue(get('supervisor')),participants:textValue(get('participants')),topics:textValue(get('topics')),photo:evidence(get('photo')),signature:evidence(get('signature')),source:'Hashdata API • formulário de teste'};
}
export function mergeRecords(existing:RecordDDS[],incoming:RecordDDS[]){
 const byId=new Map(existing.map(r=>[r.id,r]));let added=0,updated=0;
 for(const r of incoming){const old=byId.get(r.id);if(!old)added++;else if(JSON.stringify(old)!==JSON.stringify(r))updated++;byId.set(r.id,r);}
 return {records:[...byId.values()],added,updated};
}
