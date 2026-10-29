'use client';

import {useState} from 'react';

import {
  Settings,
  TYPES,
  config,
  validateSettings,
  type OperationalRegime
} from './domain';

const REGIMES:{value:OperationalRegime;label:string}[]=[
  {value:'core',label:'6h - todos os dias'},
  {value:'support',label:'12h - todos os dias'},
  {value:'weekday-core-weekend-support',label:'6h seg-sex / 12h sáb-dom'},
  {value:'weekday-support-weekend-core',label:'12h seg-sex / 6h sáb-dom'}
];

export default function RulesEditor({
  settings,
  busy,
  onSave
}:{
  settings:Settings;
  busy:boolean;
  onSave:(s:Settings)=>void;
}){
  const [draft,setDraft]=useState(()=>({
    ...settings,
    ...config(settings)
  }));

  const [error,setError]=useState('');

  function changePeriod(
    group:'core'|'support',
    i:number,
    side:number,
    value:string
  ){
    const pair=draft[group][i].split('–');
    pair[side]=value;

    setDraft({
      ...draft,
      [group]:draft[group].map((p,j)=>j===i?pair.join('–'):p)
    });
  }

  function setRegime(type:string,regime:OperationalRegime){
    setDraft({
      ...draft,
      rules:{
        ...draft.rules,
        [type]:{
          ...draft.rules[type],
          regime,
          group:regime==='support'||regime==='weekday-support-weekend-core'?'support':'core'
        }
      }
    });
  }

  return (
    <form
      className="settings-body rules-editor"
      onSubmit={e=>{
        e.preventDefault();
        try{
          setError('');
          onSave(validateSettings(draft));
        }catch(e){
          setError((e as Error).message);
        }
      }}
    >
      <h3>Quantidade de DDS e regime operacional</h3>

      <p className="meta">
        Configure a quantidade esperada e o regime de horário de cada tipo de DDS.
        Use zero para desativar a cobrança de uma equipe.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Equipe</th>
              <th>DDS esperados</th>
              <th>Regime operacional</th>
            </tr>
          </thead>

          <tbody>
            {TYPES.map(t=>(
              <tr key={t}>
                <td>
                  <strong>{t}</strong>
                </td>

                <td>
                  <input
                    aria-label={'Quantidade de DDS '+t}
                    type="number"
                    min="0"
                    max="20"
                    required
                    value={draft.rules[t].quantity}
                    onChange={e=>
                      setDraft({
                        ...draft,
                        rules:{
                          ...draft.rules,
                          [t]:{
                            ...draft.rules[t],
                            quantity:Number(e.target.value)
                          }
                        }
                      })
                    }
                  />
                </td>

                <td>
                  <select
                    aria-label={'Regime operacional '+t}
                    value={draft.rules[t].regime}
                    onChange={e=>setRegime(t,e.target.value as OperationalRegime)}
                  >
                    {REGIMES.map(r=>(
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="schedule-grid">
        <section>
          <h3>Períodos de 6 horas</h3>

          <p className="meta">
            Estes horários são usados por qualquer equipe configurada em regime de 6 horas.
          </p>

          {draft.core.map((p,i)=>{
            const pair=p.split('–').map(v=>v.length===2?v+':00':v);

            return (
              <div className="schedule-row" key={i}>
                <label>
                  Início
                  <input
                    aria-label={`Período 6h ${i+1} início`}
                    type="time"
                    required
                    value={pair[0]}
                    onChange={e=>changePeriod('core',i,0,e.target.value)}
                  />
                </label>

                <label>
                  Fim
                  <input
                    aria-label={`Período 6h ${i+1} fim`}
                    type="time"
                    required
                    value={pair[1]}
                    onChange={e=>changePeriod('core',i,1,e.target.value)}
                  />
                </label>

                <button
                  type="button"
                  aria-label={`Remover período 6h ${i+1}`}
                  disabled={draft.core.length===1}
                  onClick={()=>setDraft({
                    ...draft,
                    core:draft.core.filter((_,j)=>j!==i)
                  })}
                >
                  Remover
                </button>
              </div>
            );
          })}

          <button
            type="button"
            disabled={draft.core.length>=12}
            onClick={()=>setDraft({
              ...draft,
              core:[...draft.core,'00:00–01:00']
            })}
          >
            + Adicionar período
          </button>
        </section>

        <section>
          <h3>Períodos de 12 horas</h3>

          <p className="meta">
            Estes horários são usados por qualquer equipe configurada em regime de 12 horas.
          </p>

          {draft.support.map((p,i)=>{
            const pair=p.split('–').map(v=>v.length===2?v+':00':v);

            return (
              <div className="schedule-row" key={i}>
                <label>
                  Início
                  <input
                    aria-label={`Período 12h ${i+1} início`}
                    type="time"
                    required
                    value={pair[0]}
                    onChange={e=>changePeriod('support',i,0,e.target.value)}
                  />
                </label>

                <label>
                  Fim
                  <input
                    aria-label={`Período 12h ${i+1} fim`}
                    type="time"
                    required
                    value={pair[1]}
                    onChange={e=>changePeriod('support',i,1,e.target.value)}
                  />
                </label>

                <button
                  type="button"
                  aria-label={`Remover período 12h ${i+1}`}
                  disabled={draft.support.length===1}
                  onClick={()=>setDraft({
                    ...draft,
                    support:draft.support.filter((_,j)=>j!==i)
                  })}
                >
                  Remover
                </button>
              </div>
            );
          })}

          <button
            type="button"
            disabled={draft.support.length>=12}
            onClick={()=>setDraft({
              ...draft,
              support:[...draft.support,'00:00–01:00']
            })}
          >
            + Adicionar período
          </button>
        </section>
      </div>

      <p className="meta">
        Cada grupo de períodos deve cobrir as 24 horas sem sobreposição.
        Quando o fim é menor que o início, o período termina no dia seguinte.
      </p>

      <label className="field">
        <span>Tolerância (minutos)</span>

        <input
          type="number"
          min="0"
          max="360"
          required
          value={draft.tolerance}
          onChange={e=>setDraft({
            ...draft,
            tolerance:Number(e.target.value)
          })}
        />
      </label>

      <label className="check">
        <input
          type="checkbox"
          checked={draft.requirePhoto}
          onChange={e=>setDraft({
            ...draft,
            requirePhoto:e.target.checked
          })}
        />
        Exigir foto
      </label>

      <label className="check">
        <input
          type="checkbox"
          checked={draft.requireSignature}
          onChange={e=>setDraft({
            ...draft,
            requireSignature:e.target.checked
          })}
        />
        Exigir assinatura
      </label>

      <p className="review-flag">
        Ao salvar, os indicadores serão recalculados com as novas regras.
        Os registros DDS existentes serão preservados.
      </p>

      {error&&(
        <p role="alert" className="alert danger">
          {error}
        </p>
      )}

      <button className="primary" disabled={busy}>
        Salvar configurações
      </button>
    </form>
  );
}
