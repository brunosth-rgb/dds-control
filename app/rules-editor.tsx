'use client';

import {
  useState
} from 'react';

import {
  Settings,
  TYPES,
  config,
  validateSettings
} from './domain';

export default function RulesEditor({
  settings,
  busy,
  onSave
}:{
  settings:Settings;
  busy:boolean;
  onSave:(s:Settings)=>void
}){

  const [
    draft,
    setDraft
  ]=
    useState(
      ()=>({
        ...settings,
        ...config(
          settings
        )
      })
    );

  const [
    error,
    setError
  ]=
    useState('');

  function changePeriod(
    group:'core'|'support',
    i:number,
    side:number,
    value:string
  ){
    const pair=
      draft[group][i]
        .split('–');

    pair[side]=value;

    setDraft({
      ...draft,
      [group]:
        draft[group].map(
          (p,j)=>
            j===i
              ? pair.join('–')
              : p
        )
    });
  }

  const regime=
    (t:string)=>
      t==='NAVIO'
        ? '6h, todos os dias'
        :
          t==='CAM' ||
          t==='RS'
            ? '6h seg-sex • 12h sáb-dom'
            : '12h, todos os dias';

  return (
    <form
      className="settings-body rules-editor"
      onSubmit={
        e=>{
          e.preventDefault();

          try{
            setError('');

            onSave(
              validateSettings(
                draft
              )
            );
          }catch(e){
            setError(
              (
                e as Error
              ).message
            );
          }
        }
      }
    >

      <h3>
        Quantidade de DDS por período
      </h3>

      <p className="meta">
        NAVIO: quantidade por navio ativo. Demais equipes: quantidade por equipe. Use zero para desativar a cobrança. O regime de horários por equipe é fixo conforme a operação.
      </p>

      <div className="table-wrap">

        <table>

          <thead>
            <tr>
              <th>
                Equipe
              </th>

              <th>
                DDS esperados
              </th>

              <th>
                Regime operacional
              </th>
            </tr>
          </thead>

          <tbody>

            {TYPES.map(
              t=>(
                <tr key={t}>

                  <td>
                    <strong>
                      {t}
                    </strong>
                  </td>

                  <td>
                    <input
                      aria-label={
                        'Quantidade de DDS '+
                        t
                      }
                      type="number"
                      min="0"
                      max="20"
                      required
                      value={
                        draft.rules[t]
                          .quantity
                      }
                      onChange={
                        e=>
                          setDraft({
                            ...draft,
                            rules:{
                              ...draft.rules,

                              [t]:{
                                ...draft.rules[t],

                                quantity:
                                  Number(
                                    e.target.value
                                  )
                              }
                            }
                          })
                      }
                    />
                  </td>

                  <td>
                    <span className="meta">
                      {regime(t)}
                    </span>
                  </td>

                </tr>
              )
            )}

          </tbody>

        </table>

      </div>

      <div className="schedule-grid">

        <section>

          <h3>
            Períodos de 6 horas
          </h3>

          <p className="meta">
            NAVIO todos os dias. CAM e RS de segunda a sexta.
          </p>

          {draft.core.map(
            (p,i)=>{

              const pair=
                p
                  .split('–')
                  .map(
                    v=>
                      v.length===2
                        ? v+':00'
                        : v
                  );

              return (
                <div
                  className="schedule-row"
                  key={i}
                >

                  <label>
                    Início

                    <input
                      aria-label={
                        `Período 6h ${i+1} início`
                      }
                      type="time"
                      required
                      value={
                        pair[0]
                      }
                      onChange={
                        e=>
                          changePeriod(
                            'core',
                            i,
                            0,
                            e.target.value
                          )
                      }
                    />

                  </label>

                  <label>
                    Fim

                    <input
                      aria-label={
                        `Período 6h ${i+1} fim`
                      }
                      type="time"
                      required
                      value={
                        pair[1]
                      }
                      onChange={
                        e=>
                          changePeriod(
                            'core',
                            i,
                            1,
                            e.target.value
                          )
                      }
                    />

                  </label>

                  <button
                    type="button"
                    aria-label={
                      `Remover período 6h ${i+1}`
                    }
                    disabled={
                      draft.core.length===1
                    }
                    onClick={
                      ()=>
                        setDraft({
                          ...draft,
                          core:
                            draft.core.filter(
                              (_,j)=>
                                j!==i
                            )
                        })
                    }
                  >
                    Remover
                  </button>

                </div>
              );
            }
          )}

          <button
            type="button"
            disabled={
              draft.core.length>=12
            }
            onClick={
              ()=>
                setDraft({
                  ...draft,

                  core:[
                    ...draft.core,
                    '00:00–01:00'
                  ]
                })
            }
          >
            + Adicionar período
          </button>

        </section>

        <section>

          <h3>
            Períodos de 12 horas
          </h3>

          <p className="meta">
            GATE, REEFER e ARMAZÉM todos os dias. CAM e RS aos sábados e domingos.
          </p>

          {draft.support.map(
            (p,i)=>{

              const pair=
                p
                  .split('–')
                  .map(
                    v=>
                      v.length===2
                        ? v+':00'
                        : v
                  );

              return (
                <div
                  className="schedule-row"
                  key={i}
                >

                  <label>
                    Início

                    <input
                      aria-label={
                        `Período 12h ${i+1} início`
                      }
                      type="time"
                      required
                      value={
                        pair[0]
                      }
                      onChange={
                        e=>
                          changePeriod(
                            'support',
                            i,
                            0,
                            e.target.value
                          )
                      }
                    />

                  </label>

                  <label>
                    Fim

                    <input
                      aria-label={
                        `Período 12h ${i+1} fim`
                      }
                      type="time"
                      required
                      value={
                        pair[1]
                      }
                      onChange={
                        e=>
                          changePeriod(
                            'support',
                            i,
                            1,
                            e.target.value
                          )
                      }
                    />

                  </label>

                  <button
                    type="button"
                    aria-label={
                      `Remover período 12h ${i+1}`
                    }
                    disabled={
                      draft.support.length===1
                    }
                    onClick={
                      ()=>
                        setDraft({
                          ...draft,

                          support:
                            draft.support.filter(
                              (_,j)=>
                                j!==i
                            )
                        })
                    }
                  >
                    Remover
                  </button>

                </div>
              );
            }
          )}

          <button
            type="button"
            disabled={
              draft.support.length>=12
            }
            onClick={
              ()=>
                setDraft({
                  ...draft,

                  support:[
                    ...draft.support,
                    '00:00–01:00'
                  ]
                })
            }
          >
            + Adicionar período
          </button>

        </section>

      </div>

      <p className="meta">
        Cada grupo deve cobrir as 24 horas, sem sobreposição. Quando o fim é menor que o início, o período termina no dia seguinte.
      </p>

      <label className="field">

        <span>
          Tolerância (minutos)
        </span>

        <input
          type="number"
          min="0"
          max="360"
          required
          value={
            draft.tolerance
          }
          onChange={
            e=>
              setDraft({
                ...draft,

                tolerance:
                  Number(
                    e.target.value
                  )
              })
          }
        />

      </label>

      <label className="check">

        <input
          type="checkbox"
          checked={
            draft.requirePhoto
          }
          onChange={
            e=>
              setDraft({
                ...draft,

                requirePhoto:
                  e.target.checked
              })
          }
        />

        Exigir foto

      </label>

      <label className="check">

        <input
          type="checkbox"
          checked={
            draft.requireSignature
          }
          onChange={
            e=>
              setDraft({
                ...draft,

                requireSignature:
                  e.target.checked
              })
          }
        />

        Exigir assinatura

      </label>

      <p className="review-flag">
        Ao salvar, os indicadores serão recalculados com estas regras, inclusive nas datas anteriores. Os registros de DDS serão preservados; horários que deixarem de existir precisarão de revisão.
      </p>

      {error && (
        <p
          role="alert"
          className="alert danger"
        >
          {error}
        </p>
      )}

      <button
        className="primary"
        disabled={busy}
      >
        Salvar configurações
      </button>

    </form>
  );
}
