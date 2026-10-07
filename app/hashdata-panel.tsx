import {useEffect,useRef,useState} from 'react';
import {fields,type Mapping} from './hashdata-map';
import {fetchHashdataRecords,previewHashdata} from './hashdata-client';
import {saveHashdataSync} from './state-store';

export default function HashdataPanel({
  info,
  blocked,
  onChange,
  revision,
  user,
  settings=false,
}:{
  info:any;
  blocked:boolean;
  settings?:boolean;
  revision:number;
  user:string;
  onChange:(data:any)=>void;
}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[preview,setPreview]=useState<any>(null),[mapping,setMapping]=useState<Mapping>({}),[auto,setAuto]=useState(false);
 const current=useRef({blocked,busy,onChange,info,revision,user});current.current={blocked,busy,onChange,info,revision,user};
 async function call(action:'preview'|'sync',extra:{mapping?:Mapping;auto?:boolean}={}){
  if(current.current.busy||current.current.blocked)return;
  current.current.busy=true;setBusy(true);setError('');setMessage('');
  try{
   const batch=await fetchHashdataRecords();
   if(action==='preview'){
    const data=previewHashdata(batch.records,current.current.info?.mapping||{});
    setPreview(data);setMapping(data.mapping);setAuto(!!current.current.info?.auto);
   }else{
    const selectedMapping=extra.mapping||current.current.info?.mapping||{};
    const selectedAuto=extra.auto===undefined?!!current.current.info?.auto:extra.auto;
    const data=await saveHashdataSync(batch.records,selectedMapping,selectedAuto,current.current.revision,current.current.user);
    current.current.onChange(data);setPreview(null);setMessage(`${data.summary.added} novos · ${data.summary.updated} atualizados · ${data.summary.review} para revisão`);
   }
  }catch(e){setError((e as Error).message);}finally{current.current.busy=false;setBusy(false);}
 }
 useEffect(()=>{if(!info?.auto)return;const timer=setInterval(()=>{if(!document.hidden&&!current.current.blocked&&!current.current.busy)void call('sync');},1800000);return()=>clearInterval(timer);},[!!info?.auto]);
 if(!settings&&!info?.mapping)return null;
 if(!settings)return <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8,marginBottom:16}}><button className="primary" disabled={busy||blocked} aria-busy={busy} title="Atualização automática a cada 30 minutos enquanto a aba estiver visível" onClick={()=>call('sync')}>{busy?'Sincronizando…':'Sincronizar agora'}</button>{error&&<p role="alert" className="alert danger">{error}</p>}</div>;
 return <section className="panel" aria-label="Integração Hashdata"><div className="panel-head"><div><h2>Hashdata · formulário de teste</h2><p>{info?.lastSuccess?`Última sincronização: ${info.lastSuccess.replace('T',' ')}`:'Conexão preparada. Confira os campos para importar os DDS.'}</p><small>{info?.auto?'Atualização a cada 30 minutos enquanto esta aba estiver visível.':'Atualização manual.'} Consulta dos últimos 30 dias.</small></div><div className="heading-actions"><button disabled={busy||blocked} onClick={()=>call('preview')}>{busy?'Consultando…':'Conferir campos'}</button>{info?.mapping&&<button className="primary" disabled={busy||blocked} onClick={()=>call('sync')}>Sincronizar agora</button>}</div></div>
 {error&&<p role="alert" className="alert danger">{error}</p>}{message&&<p role="status" className="alert">{message}</p>}
 {preview&&<form className="settings-body" onSubmit={e=>{e.preventDefault();void call('sync',{mapping,auto})}}><p><strong>{preview.count} respostas encontradas.</strong> Selecione o campo correspondente a cada informação. O exemplo abaixo de cada seleção ajuda a conferir.</p><p>A data operacional será a data da aplicação. O período será o informado no formulário, sem dedução pelo horário.</p><div className="form-grid">{Object.entries(fields).map(([key,label])=><label className="field" key={key}><span>{label}{['applied','period','type'].includes(key)?' *':''}</span><select required={['applied','period','type'].includes(key)} value={mapping[key as keyof Mapping]||''} onChange={e=>setMapping({...mapping,[key]:e.target.value})}><option value="">Não informado / selecionar</option>{preview.keys.map((k:string)=><option key={k} value={k}>{k}</option>)}</select><small style={{overflowWrap:'anywhere'}}>{preview.samples[mapping[key as keyof Mapping]||'']||'Sem exemplo'}</small></label>)}</div><label className="check"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>Atualizar a cada 30 minutos enquanto o painel estiver aberto</label><p>Tipos ou períodos incompatíveis ficam para revisão. Datas inválidas impedem a importação. Registros do Hashdata com o mesmo ID serão atualizados.</p><div className="modal-actions"><button type="button" onClick={()=>setPreview(null)}>Fechar</button><button className="primary" disabled={busy||blocked||!preview.count}>Salvar campos e importar</button></div></form>}
 </section>;
}
