'use client';

import {
  useState,
  useEffect,
  useRef
} from 'react';

import {
  Anchor,
  LayoutDashboard,
  Ship as ShipIcon,
  TriangleAlert,
  History,
  ChartNoAxesCombined,
  Settings,
  Monitor,
  RefreshCw,
  Plus,
  X,
  Check,
  Clock,
  ChevronRight,
  Download,
  Search,
  FileCheck2,
  Users,
  Truck,
  Sun,
  Moon,
  DoorOpen,
  Snowflake,
  Warehouse,
  Upload
} from 'lucide-react';

import {
  State,
  Ship,
  RecordDDS,
  Obligation,
  TYPES,
  typePeriodsForDate,
  windowOf as defaultWindowOf,
  config,
  periodsFor,
  currentSelection,
  localNow,
  currentPeriod,
  operationalDate,
  obligations,
  score,
  fmtTime,
  fmtDate,
  issues,
  validRecord,
  reviewReasons,
  epoch,
  norm
} from './domain';

import EmailImporter
  from './email-importer';

import HashdataPanel
  from './hashdata-panel';

import RulesEditor
  from './rules-editor';

import {
  AdherenceView,
  DayDashboard
} from './operational-views';

import {
  loadWorkspace,
  saveWorkspaceAction
} from './state-store';

import {
  currentDisplayName,
  logout
} from './firebase-client';

const menus=[
  ['HOJE',LayoutDashboard],
  ['NAVIOS',ShipIcon],
  ['PENDÊNCIAS',TriangleAlert],
  ['HISTÓRICO',History],
  ['ADERÊNCIA',ChartNoAxesCombined],
  ['CONFIGURAÇÕES',Settings]
] as const;

const statusClass=
  (s:string)=>
    s==='Realizado'
      ?'success'
      :s==='Realizado com pendência'
        ?'incomplete'
        :s==='Atrasado'
          ?'danger'
          :s==='Aguardando'
            ?'warning'
            :s==='Justificado'
              ?'justified'
              :'neutral';

function Badge({
  text
}:{
  text:string
}){
  return (
    <span
      className={
        'badge '+
        statusClass(text)
      }
    >
      <i/>
      {text}
    </span>
  );
}

function Panel({
  title,
  extra,
  children,
  className=''
}:any){
  return (
    <section
      className={
        'panel '+
        className
      }
    >
      <div className="panel-head">
        <h2>
          {title}
        </h2>

        {extra}
      </div>

      {children}
    </section>
  );
}

function Field({
  label,
  children
}:any){
  return (
    <label className="field">
      <span>
        {label}
      </span>

      {children}
    </label>
  );
}

function Modal({
  title,
  close,
  children
}:any){

  const ref=
    useRef<HTMLDialogElement>(
      null
    );

  useEffect(
    ()=>{
      ref.current?.showModal();
    },
    []
  );

  return (
    <dialog
      ref={ref}
      onCancel={close}
    >

      <div className="modal-head">

        <h2>
          {title}
        </h2>

        <button
          className="icon-button"
          onClick={close}
          aria-label="Fechar"
        >
          <X size={20}/>
        </button>

      </div>

      {children}

    </dialog>
  );
}

export default function Tower(){

  const [
    s,
    setS
  ]=
    useState<State|null>(
      null
    );

  const [
    rev,
    setRev
  ]=
    useState(0);

  const [
    user,
    setUser
  ]=
    useState('');

  const [
    view,
    setView
  ]=
    useState('HOJE');

  const [
    date,
    setDate
  ]=
    useState(
      '2026-09-29'
    );

  const [
    period,
    setPeriod
  ]=
    useState(2);

  const [
    now,
    setNow
  ]=
    useState(
      Date.now()
    );

  const [
    busy,
    setBusy
  ]=
    useState(false);

  const [
    error,
    setError
  ]=
    useState('');

  const [
    notice,
    setNotice
  ]=
    useState('');

  const [
    modal,
    setModal
  ]=
    useState<any>(
      null
    );

  const [
    q,
    setQ
  ]=
    useState('');

  const [
    type,
    setType
  ]=
    useState(
      'Todos'
    );

  const [
    shipTab,
    setShipTab
  ]=
    useState(
      'Todos'
    );

  const [
    theme,
    setTheme
  ]=
    useState(
      'dark'
    );

  const [
    recordType,
    setRecordType
  ]=
    useState(
      'CAM'
    );

  const [
    recordDate,
    setRecordDate
  ]=
    useState(
      '2026-09-29'
    );

  const cfg=
    config(
      s?.settings
    );

  const PERIODS=
    cfg.core;

  const WORK_PERIODS=
    cfg.support;

  const ALL_PERIODS=
    periodsFor(
      s?.settings
    );

  const split=
    PERIODS.length;

  const typePeriods=
    (
      t:string,
      d=date
    )=>
      typePeriodsForDate(
        t,
        d,
        s?.settings
      );

  const windowOf=
    (
      d:string,
      i:number
    )=>
      defaultWindowOf(
        d,
        i,
        s?.settings
      );

  useEffect(
    ()=>{

      const saved=
        localStorage.getItem(
          'dds-theme'
        ) || 'dark';

      setTheme(
        saved
      );

      document.documentElement.dataset.theme=
        saved;

      setDate(
        operationalDate()
      );

      setPeriod(
        currentPeriod()
      );

      load();

      const t=
        setInterval(
          ()=>
            setNow(
              Date.now()
            ),
          30000
        );

      return ()=>
        clearInterval(t);
    },
    []
  );

  async function load(){

    setBusy(true);
    setError('');

    try{

      const d=
        await loadWorkspace();

      setS(
        d.state
      );

      setRev(
        d.revision
      );

      setUser(
        currentDisplayName()
      );

      const sel=
        currentSelection(
          d.state.settings,
          'core'
        );

      setDate(
        sel.date
      );

      setPeriod(
        sel.index
      );

    }catch(e){

      setError(
        String(
          (
            e as Error
          ).message
        )
      );

    }finally{

      setBusy(false);
    }
  }

  async function save(
    body:any
  ){

    setBusy(true);
    setError('');

    try{

      const d=
        await saveWorkspaceAction(
          body,
          rev,
          user ||
          currentDisplayName()
        );

      setS(
        d.state
      );

      setRev(
        d.revision
      );

      setModal(
        null
      );

      setNotice(
        'Alteração salva. Indicadores recalculados.'
      );

      setTimeout(
        ()=>
          setNotice(''),
        4500
      );

    }catch(e){

      setError(
        (
          e as Error
        ).message
      );

    }finally{

      setBusy(false);
    }
  }

  function toggleTheme(){

    const t=
      theme==='dark'
        ?'light'
        :'dark';

    setTheme(t);

    document.documentElement.dataset.theme=
      t;

    localStorage.setItem(
      'dds-theme',
      t
    );
  }

  function navigate(
    v:string
  ){
    setView(v);
    setQ('');
    setType('Todos');
  }

  function live(){

    const sel=
      currentSelection(
        s?.settings,
        period>=split
          ?'support'
          :'core'
      );

    setDate(
      sel.date
    );

    setPeriod(
      sel.index
    );
  }

  function recordForm(
    item?:Obligation,
    r?:RecordDDS
  ){

    const d=
      r?.date ||
      item?.date ||
      date;

    const p=
      r?.period ||
      item?.period ||
      ALL_PERIODS[
        period
      ];

    const fallback=
      TYPES.find(
        t=>
          cfg.rules[t]
            .quantity>0 &&
          typePeriods(
            t,
            d
          ).includes(
            p
          )
      ) ||
      (
        WORK_PERIODS.includes(p)
          ?'GATE'
          :'NAVIO'
      );

    const selected=
      r?.type ||
      item?.type ||
      fallback;

    setRecordDate(
      d
    );

    setRecordType(
      selected
    );

    setModal({
      kind:'record',

      record:
        r || {
          type:selected,

          ship:
            item?.type==='NAVIO'
              ?item.reference
              :'',

          date:d,
          period:p,

          applied:
            localNow()
              .slice(
                0,
                16
              ),

          applicator:'',
          supervisor:'',
          participants:'',
          topics:'',
          photo:false,
          signature:false
        }
    });
  }

  function exportCSV(){

    if(
      !s
    ){
      return;
    }

    const fields=[
      'id',
      'type',
      'ship',
      'date',
      'period',
      'applied',
      'applicator',
      'supervisor',
      'participants',
      'topics',
      'photo',
      'signature'
    ];

    const csv=
      '\ufeff'+
      [
        fields,

        ...s.records.map(
          r=>
            fields.map(
              f=>
                String(
                  (
                    r as any
                  )[f] ?? ''
                )
            )
        )
      ]
        .map(
          a=>
            a
              .map(
                v=>
                  '"'+
                  v.replace(
                    /"/g,
                    '""'
                  )+
                  '"'
              )
              .join(';')
        )
        .join('\r\n');

    const url=
      URL.createObjectURL(
        new Blob(
          [csv],
          {
            type:
              'text/csv;charset=utf-8'
          }
        )
      );

    const a=
      document.createElement(
        'a'
      );

    a.href=
      url;

    a.download=
      'DDS-historico.csv';

    a.click();

    URL.revokeObjectURL(
      url
    );
  }

  if(
    !s
  ){
    return (
      <div className="loading">

        <Anchor size={42}/>

        <h1>
          DDS Control Tower
        </h1>

        <p>
          {error ||
           'Carregando os registros…'}
        </p>

        {error && (
          <>

            <button
              onClick={load}
            >
              Tentar novamente
            </button>

            <button
              onClick={
                ()=>logout()
              }
            >
              Sair
            </button>

          </>
        )}

      </div>
    );
  }

  const rows=
    obligations(
      s,
      date,
      period,
      now
    );

  const all=
    ALL_PERIODS.flatMap(
      (_,i)=>
        obligations(
          s,
          date,
          i,
          now
        )
    );

  const stats=
    score(rows);

  const pending=
    all.filter(
      x=>
        [
          'Atrasado',
          'Realizado com pendência'
        ].includes(
          x.status
        )
    );

  const review=
    s.records.filter(
      r=>
        !validRecord(
          r,
          s.settings
        )
    );

  const legacyTestRecords=
    s.records.filter(
      r=>
        /^Excel de teste(?:\s*•|$)/i.test(
          r.source||''
        ) ||
        (
          r.source||''
        )==='Registro manual de teste'
    );

  const unmatched=
    s.records.filter(
      r=>
        validRecord(
          r,
          s.settings
        ) &&
        r.type==='NAVIO' &&
        !ALL_PERIODS
          .flatMap(
            (_,i)=>
              obligations(
                s,
                r.date,
                i,
                now
              )
          )
          .some(
            o=>
              o.record?.id===r.id ||
              (
                o.type==='NAVIO' &&
                norm(o.reference)===
                  norm(r.ship) &&
                o.period===r.period
              )
          )
    );

  const tv=
    view==='MODO TV';

  const activeTypes=
    TYPES.filter(
      t=>
        cfg.rules[t]
          .quantity>0 &&
        typePeriods(
          t,
          date
        ).includes(
          ALL_PERIODS[
            period
          ]
        )
    );

  const periodIndexes=
    ALL_PERIODS
      .map(
        (_,i)=>i
      )
      .filter(
        i=>
          period>=split
            ?i>=split
            :i<split
      );

  const selectedWindow=
    windowOf(
      date,
      period
    );

  const visibleShips=
    s.ships.filter(
      v=>
        !v.deleted &&
        v.status!=='Cancelado' &&
        epoch(v.start)<
          selectedWindow.end &&
        epoch(
          v.actualEnd||v.end
        )>
          selectedWindow.start
    );

  const shipIndex=
    period<split
      ?period
      :0;

  const shipRows=
    obligations(
      s,
      date,
      shipIndex,
      now
    );

  const visibleRecords=
    s.records
      .filter(
        r=>
          (
            type==='Todos' ||
            r.type===type
          ) &&
          norm(
            [
              r.ship,
              r.applicator,
              r.type,
              r.topics
            ].join(' ')
          ).includes(
            norm(q)
          )
      )
      .sort(
        (a,b)=>
          b.applied.localeCompare(
            a.applied
          ) ||
          b.id.localeCompare(
            a.id
          )
      );

  const shipState=
    (v:Ship)=>
      v.status==='Cancelado'
        ?'Cancelados'
        :v.status==='Finalizado'
          ?'Finalizados'
          :epoch(v.start)>now
            ?'Programados'
            :epoch(v.end)<now
              ?'Fim previsto vencido'
              :'Em operação';

  const obligationTable=
    (
      list:Obligation[]
    )=>(
      <div className="table-wrap">

        <table>

          <thead>
            <tr>
              <th>
                Tipo / referência
              </th>
              <th>
                Período
              </th>
              <th>
                Status
              </th>
              <th>
                Prazo
              </th>
              <th>
                Supervisor
              </th>
              <th>
                Realizado
              </th>
              <th/>
            </tr>
          </thead>

          <tbody>

            {[...list]
              .sort(
                (a,b)=>
                  (
                    !a.record &&
                    a.status!=='Justificado'
                      ?0
                      :1
                  ) -
                  (
                    !b.record &&
                    b.status!=='Justificado'
                      ?0
                      :1
                  ) ||
                  a.due-b.due
              )
              .map(
                r=>(
                  <tr
                    key={r.key}
                    className={
                      !r.record &&
                      r.status!=='Justificado'
                        ?
                          r.status==='Atrasado'
                            ?'dds-not-done overdue'
                            :'dds-not-done'
                        :''
                    }
                  >

                    <td>
                      <strong>
                        {r.reference}
                      </strong>

                      <small>
                        {r.type}

                        {r.quantity>1
                          ?` • DDS ${r.slot} de ${r.quantity}`
                          :r.count>1
                            ?` • ${r.count} respostas, 1 obrigação`
                            :''}
                      </small>
                    </td>

                    <td>
                      {r.period}
                    </td>

                    <td>

                      <Badge
                        text={
                          r.status
                        }
                      />

                      {!r.record &&
                       r.status!=='Justificado' && (
                        <small className="not-done-label">
                          DDS ainda não realizado
                        </small>
                      )}

                      {r.record &&
                       epoch(
                         r.record.applied
                       )>r.due && (
                        <small>
                          Aplicado após o prazo
                        </small>
                      )}

                    </td>

                    <td>
                      {fmtTime(
                        r.due
                      )}
                    </td>

                    <td>
                      {r.record?.supervisor || '—'}
                    </td>

                    <td>
                      {r.record
                        ?fmtTime(
                           r.record.applied
                         )
                        :'—'}
                    </td>

                    <td>

                      <button
                        className="subtle"
                        onClick={
                          ()=>
                            setModal({
                              kind:'obligation',
                              item:r
                            })
                        }
                      >
                        Detalhes

                        <ChevronRight
                          size={15}
                        />
                      </button>

                    </td>

                  </tr>
                )
              )}

          </tbody>

        </table>

        {!list.length && (
          <div className="empty">
            <Check/>
            <p>
              Nenhum item nesta seleção.
            </p>
          </div>
        )}

      </div>
    );

  const timeline=(
    <>

      <div
        className="regime-switch"
        aria-label="Regime de trabalho"
      >

        <button
          className={
            period<split
              ?'selected'
              :''
          }
          onClick={
            ()=>setPeriod(0)
          }
        >
          {TYPES
            .filter(
              t=>
                cfg.rules[t]
                  .quantity>0 &&
                typePeriods(
                  t,
                  date
                ).some(
                  p=>
                    PERIODS.includes(p)
                )
            )
            .join(' · ') ||
           'Períodos de 6h'}
        </button>

        <button
          className={
            period>=split
              ?'selected'
              :''
          }
          onClick={
            ()=>setPeriod(split)
          }
        >
          {TYPES
            .filter(
              t=>
                cfg.rules[t]
                  .quantity>0 &&
                typePeriods(
                  t,
                  date
                ).some(
                  p=>
                    WORK_PERIODS.includes(p)
                )
            )
            .join(' · ') ||
           'Períodos de 12h'}
        </button>

      </div>

      <div
        className={
          'periods '+
          (
            period>=split
              ?'two-periods'
              :''
          )
        }
      >

        {periodIndexes.map(
          i=>{

            const p=
              ALL_PERIODS[i];

            const a=
              obligations(
                s,
                date,
                i,
                now
              );

            const k=
              score(a);

            return (
              <button
                key={p}
                className={
                  period===i
                    ?'selected'
                    :''
                }
                onClick={
                  ()=>setPeriod(i)
                }
              >

                <div>
                  <strong>
                    {p}
                  </strong>

                  {period===i && (
                    <span>
                      Selecionado
                    </span>
                  )}
                </div>

                <div className="period-value">
                  {k.pct}%

                  {' '}

                  <small>
                    {k.done}/{k.total} DDS
                  </small>
                </div>

                <div className="track">
                  <i
                    style={{
                      width:
                        k.pct+'%'
                    }}
                  />
                </div>

              </button>
            );
          }
        )}

      </div>

    </>
  );

  const cards=(
    <div className="kpis">

      <div className="kpi lead">

        <span>
          ADERÊNCIA DO PERÍODO
        </span>

        <strong>
          {stats.pct}
          <em>%</em>
        </strong>

        <p>
          {stats.done} de {stats.total} DDS realizados
        </p>

        <div className="track">
          <i
            style={{
              width:
                stats.pct+'%'
            }}
          />
        </div>

      </div>

      {activeTypes.map(
        t=>{

          const k=
            score(
              rows.filter(
                r=>
                  r.type===t
              )
            );

          const Icon=
            (
              {
                NAVIO:ShipIcon,
                CAM:Truck,
                RS:Users,
                GATE:DoorOpen,
                REEFER:Snowflake,
                ARMAZÉM:Warehouse
              } as any
            )[t];

          return (
            <div
              className="kpi"
              key={t}
            >

              <div className="kpi-label">
                <span>
                  {t}
                </span>

                <Icon size={22}/>
              </div>

              <strong>
                {k.done}
                <em>
                  {' / '}
                  {k.total}
                </em>
              </strong>

              <p>
                {k.total
                  ?'DDS realizados'
                  :t==='NAVIO'
                    ?'Nenhum navio previsto'
                    :'Nenhuma obrigação'}
              </p>

            </div>
          );
        }
      )}

    </div>
  );

  return (
    <div
      className={
        'shell '+
        (
          tv
            ?'tv'
            :''
        )
      }
    >

      {!tv && (
        <aside className="sidebar">

          <div className="brand">
            <Anchor size={29}/>

            <div>
              DDS

              <span>
                CONTROL TOWER
              </span>
            </div>
          </div>

          <div className="workspace-label">
            OPERAÇÃO • PARMA
          </div>

          <nav>

            {menus.map(
              ([m,Icon])=>(
                <button
                  key={m}
                  onClick={
                    ()=>navigate(m)
                  }
                  className={
                    view===m
                      ?'active'
                      :''
                  }
                >

                  <Icon size={19}/>

                  {m}

                  {m==='PENDÊNCIAS' &&
                   pending.length>0 && (
                    <b>
                      {pending.length}
                    </b>
                  )}

                </button>
              )
            )}

          </nav>

          <button
            className="tv-link"
            onClick={
              ()=>
                navigate(
                  'MODO TV'
                )
            }
          >
            <Monitor size={19}/>
            DASHBOARD DO DIA
          </button>

          <div className="profile">

            <div className="avatar">
              {user.slice(0,1)||'D'}
            </div>

            <div>

              <strong>
                {user||'Operador'}
              </strong>

              <small>
                Firebase · dados compartilhados
              </small>

              <button
                className="profile-logout"
                onClick={
                  ()=>logout()
                }
              >
                Sair
              </button>

            </div>

          </div>

        </aside>
      )}

      <main>

        <header className="top">

          <div className="breadcrumb">
            DDS Control Tower
            <span>/</span>
            {tv
              ?'Dashboard do dia'
              :view.charAt(0)+
               view.slice(1).toLowerCase()}
          </div>

          <div className="top-right">

            <button
              className="theme-toggle"
              onClick={
                toggleTheme
              }
              aria-label={
                theme==='dark'
                  ?'Ativar modo claro'
                  :'Ativar modo escuro'
              }
            >

              {theme==='dark'
                ?<Sun size={17}/>
                :<Moon size={17}/>}

              <span>
                {theme==='dark'
                  ?'Modo claro'
                  :'Modo escuro'}
              </span>

            </button>

            <span>
              {(s as any)
                .hashdata
                ?.lastSuccess
                  ?'Hashdata sincronizado'
                  :'Hashdata: configurar importação'}
            </span>

            <button
              className="icon-button"
              onClick={load}
              disabled={busy}
              aria-label="Atualizar dados"
            >
              <RefreshCw
                size={17}
                className={
                  busy
                    ?'spin'
                    :''
                }
              />
            </button>

          </div>

        </header>

        <div className="content">

          <HashdataPanel
            settings={
              view==='CONFIGURAÇÕES'
            }
            info={
              (s as any)
                .hashdata
            }
            blocked={
              busy ||
              !!modal
            }
            revision={rev}
            user={user}
            onChange={
              d=>{
                setS(d.state);
                setRev(d.revision);
              }
            }
          />

          <div className="heading">

            <div>

              <div className="eyebrow">
                CONTROLE DE ADERÊNCIA OPERACIONAL
              </div>

              <h1>
                {
                  (
                    {
                      HOJE:'Visão da operação',
                      NAVIOS:'Programação de navios',
                      PENDÊNCIAS:'Pendências',
                      HISTÓRICO:'Histórico de DDS',
                      ADERÊNCIA:'Aderência operacional',
                      CONFIGURAÇÕES:'Configurações',
                      'MODO TV':'Dashboard do dia'
                    } as any
                  )[view]
                }
              </h1>

              <p>
                {tv
                  ?
                    'Visão consolidada • '+
                    fmtDate(date)
                  :
                    'Última alteração '+
                    fmtDate(
                      s.updated.slice(
                        0,
                        10
                      )
                    )+
                    ' às '+
                    s.updated.slice(
                      11,
                      16
                    )}
              </p>

            </div>

            <div className="heading-actions">

              {tv
                ?
                  <>
                    <strong className="tv-clock">
                      {fmtTime(now)}
                    </strong>

                    <button
                      onClick={
                        ()=>
                          navigate(
                            'HOJE'
                          )
                      }
                    >
                      Voltar à operação
                    </button>
                  </>
                :
                  <>

                    <input
                      aria-label="Data operacional"
                      type="date"
                      value={date}
                      onChange={
                        e=>
                          e.target.value &&
                          setDate(
                            e.target.value
                          )
                      }
                    />

                    <button
                      onClick={live}
                    >
                      Agora
                    </button>

                    {view==='NAVIOS'
                      ?
                        <>

                          <button
                            onClick={
                              ()=>
                                setModal({
                                  kind:'import'
                                })
                            }
                          >
                            <Upload size={17}/>
                            Importar arquivo de e-mail
                          </button>

                          <button
                            className="primary"
                            onClick={
                              ()=>
                                setModal({
                                  kind:'ship'
                                })
                            }
                          >
                            <Plus size={17}/>
                            Novo navio
                          </button>

                        </>
                      :
                        view==='HISTÓRICO'
                          ?
                            <button
                              className="primary"
                              onClick={
                                ()=>recordForm()
                              }
                            >
                              <Plus size={17}/>
                              Registrar DDS
                            </button>
                          :
                            null}

                  </>
              }

            </div>

          </div>

          {error && (
            <div
              role="alert"
              className="alert danger"
            >
              {error}

              <button
                onClick={
                  ()=>setError('')
                }
                aria-label="Dispensar erro"
              >
                <X size={16}/>
              </button>
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="alert success"
            >
              {notice}
            </div>
          )}

          {view==='HOJE' && (
            <>

              {timeline}

              {cards}

              <Panel
                title="DDS do período"
                extra={
                  <span className="meta">
                    {ALL_PERIODS[period]}
                    {' • '}
                    {fmtDate(date)}
                    {' · '}
                    {
                      rows.filter(
                        r=>
                          !r.record &&
                          r.status!=='Justificado'
                      ).length
                    }
                    {' '}
                    não realizados
                  </span>
                }
              >
                {obligationTable(rows)}
              </Panel>

              {period<split && (
                <details className="ships-disclosure">

                  <summary>
                    Navios no período · {visibleShips.length} operações
                  </summary>

                  <Panel
                    title="Navios no período"
                    className="ships-expanded"
                    extra={
                      <span className="meta">
                        {visibleShips.length} operações · {ALL_PERIODS[period]}
                      </span>
                    }
                  >

                    <div className="vessel-grid">

                      {visibleShips.map(
                        v=>{

                          const related=
                            all.filter(
                              r=>
                                r.type==='NAVIO' &&
                                r.entityId===v.id &&
                                (
                                  r.start<
                                  selectedWindow.end &&
                                  windowOf(
                                    date,
                                    ALL_PERIODS.indexOf(
                                      r.period
                                    )
                                  ).end>
                                  selectedWindow.start
                                )
                            );

                          return (
                            <article
                              className="vessel-card"
                              key={v.id}
                            >

                              <div className="vessel-title">

                                <ShipIcon size={24}/>

                                <div>
                                  <h3>
                                    {v.name}
                                  </h3>

                                  <small>
                                    Berço {v.berth}
                                  </small>
                                </div>

                                <button
                                  className="subtle"
                                  onClick={
                                    ()=>
                                      setModal({
                                        kind:'ship',
                                        ship:v
                                      })
                                  }
                                >
                                  Gerenciar
                                </button>

                              </div>

                              <dl>

                                <dt>
                                  Início
                                </dt>

                                <dd>
                                  {fmtDate(
                                    v.start.slice(
                                      0,
                                      10
                                    )
                                  )}
                                  {' · '}
                                  {v.start.slice(
                                    11,
                                    16
                                  )}
                                </dd>

                                <dt>
                                  {v.actualEnd
                                    ?'Saída real'
                                    :'Fim previsto'}
                                </dt>

                                <dd>
                                  {fmtDate(
                                    (
                                      v.actualEnd ||
                                      v.end
                                    ).slice(
                                      0,
                                      10
                                    )
                                  )}
                                  {' · '}
                                  {
                                    (
                                      v.actualEnd ||
                                      v.end
                                    ).slice(
                                      11,
                                      16
                                    )
                                  }
                                </dd>

                              </dl>

                              <div className="vessel-status">

                                {related.map(
                                  r=>(
                                    <button
                                      key={r.key}
                                      className="subtle"
                                      onClick={
                                        ()=>
                                          setModal({
                                            kind:'obligation',
                                            item:r
                                          })
                                      }
                                    >

                                      {period>=split && (
                                        <span>
                                          {r.period}
                                        </span>
                                      )}

                                      {r.quantity>1 && (
                                        <span>
                                          DDS {r.slot}/{r.quantity}
                                        </span>
                                      )}

                                      <Badge
                                        text={r.status}
                                      />

                                    </button>
                                  )
                                )}

                              </div>

                              {v.startBasis && (
                                <small>
                                  Início: {v.startBasis}
                                </small>
                              )}

                              {!!v.review?.length && (
                                <small className="review-flag">
                                  Programação estimada · conferir observações
                                </small>
                              )}

                            </article>
                          );
                        }
                      )}

                    </div>

                    {!visibleShips.length && (
                      <div className="empty">

                        <ShipIcon/>

                        <p>
                          Nenhum navio cadastrado para este período.
                        </p>

                        <button
                          onClick={
                            ()=>
                              navigate(
                                'NAVIOS'
                              )
                          }
                        >
                          Ver programação e importar
                        </button>

                      </div>
                    )}

                  </Panel>

                </details>
              )}

              {!tv &&
               (
                 review.length>0 ||
                 unmatched.length>0
               ) && (
                <div className="review-note">

                  <FileCheck2 size={20}/>

                  <span>
                    <strong>
                      {review.length} registro(s) para revisão · {unmatched.length} DDS de navio sem vínculo com programação.
                    </strong>
                    {' '}
                    Confira o histórico e cadastre as janelas em NAVIOS.
                  </span>

                  <button
                    onClick={
                      ()=>
                        navigate(
                          'HISTÓRICO'
                        )
                    }
                  >
                    Revisar
                  </button>

                </div>
              )}

            </>
          )}

          {view==='NAVIOS' && (
            <>

              <div className="tabs">

                {[
                  'Todos',
                  'Em operação',
                  'Programados',
                  'Finalizados',
                  'Cancelados',
                  'Fim previsto vencido'
                ].map(
                  t=>(
                    <button
                      className={
                        shipTab===t
                          ?'selected'
                          :''
                      }
                      key={t}
                      onClick={
                        ()=>setShipTab(t)
                      }
                    >
                      {t}
                    </button>
                  )
                )}

              </div>

              <Panel
                title="Gestão manual da operação"
                extra={
                  <span className="meta">
                    DDS atual: {ALL_PERIODS[shipIndex]}
                  </span>
                }
              >

                <div className="table-wrap">

                  <table>

                    <thead>
                      <tr>
                        <th>
                          Navio / berço
                        </th>
                        <th>
                          Início
                        </th>
                        <th>
                          Fim previsto / real
                        </th>
                        <th>
                          Situação
                        </th>
                        <th>
                          DDS atual
                        </th>
                        <th>
                          Ações
                        </th>
                      </tr>
                    </thead>

                    <tbody>

                      {s.ships
                        .filter(
                          v=>
                            !v.deleted &&
                            (
                              shipTab==='Todos' ||
                              shipState(v)===shipTab
                            )
                        )
                        .map(
                          v=>(
                            <tr key={v.id}>

                              <td>

                                <strong>
                                  {v.name}
                                </strong>

                                <small>
                                  Berço {v.berth}
                                </small>

                                {v.source && (
                                  <small>
                                    Importado dos e-mails
                                  </small>
                                )}

                                {!!v.review?.length && (
                                  <small className="review-flag">
                                    Conferir estimativas
                                  </small>
                                )}

                              </td>

                              <td>

                                {fmtDate(
                                  v.start.slice(
                                    0,
                                    10
                                  )
                                )}

                                <small>
                                  {v.start.slice(
                                    11,
                                    16
                                  )}
                                </small>

                              </td>

                              <td>

                                {fmtDate(
                                  (
                                    v.actualEnd ||
                                    v.end
                                  ).slice(
                                    0,
                                    10
                                  )
                                )}

                                <small>
                                  {
                                    (
                                      v.actualEnd ||
                                      v.end
                                    ).slice(
                                      11,
                                      16
                                    )
                                  }

                                  {' '}

                                  {v.actualEnd
                                    ?'• saída real'
                                    :''}
                                </small>

                              </td>

                              <td>
                                {shipState(v)}
                              </td>

                              <td>

                                {shipRows.find(
                                  r=>
                                    r.entityId===v.id
                                )
                                  ?
                                    <>

                                      <Badge
                                        text={
                                          shipRows.find(
                                            r=>
                                              r.entityId===v.id &&
                                              !r.record
                                          )?.status ||
                                          shipRows.find(
                                            r=>
                                              r.entityId===v.id
                                          )!.status
                                        }
                                      />

                                      <small>
                                        {
                                          score(
                                            shipRows.filter(
                                              r=>
                                                r.entityId===v.id
                                            )
                                          ).done
                                        }
                                        {' / '}
                                        {
                                          score(
                                            shipRows.filter(
                                              r=>
                                                r.entityId===v.id
                                            )
                                          ).total
                                        }
                                        {' '}
                                        DDS
                                      </small>

                                    </>
                                  :
                                    <span className="meta">
                                      Não esperado
                                    </span>}

                              </td>

                              <td>
                                <button
                                  onClick={
                                    ()=>
                                      setModal({
                                        kind:'ship',
                                        ship:v
                                      })
                                  }
                                >
                                  Gerenciar
                                </button>
                              </td>

                            </tr>
                          )
                        )}

                    </tbody>

                  </table>

                  {!s.ships.some(
                    v=>
                      !v.deleted &&
                      (
                        shipTab==='Todos' ||
                        shipState(v)===shipTab
                      )
                  ) && (
                    <div className="empty">

                      <ShipIcon size={32}/>

                      <h3>
                        Nenhum navio nesta seleção
                      </h3>

                      <p>
                        Cadastre manualmente ou importe a programação de navios.
                      </p>

                      <button
                        className="primary"
                        onClick={
                          ()=>
                            setModal({
                              kind:'ship'
                            })
                        }
                      >
                        <Plus size={17}/>
                        Novo navio
                      </button>

                    </div>
                  )}

                </div>

              </Panel>

              <Panel title="Histórico de alterações">

                {s.audit
                  .filter(
                    a=>
                      [
                        'ship',
                        'finish',
                        'cancel',
                        'delete',
                        'import-emails',
                        'import-files'
                      ].includes(
                        a.action
                      )
                  )
                  .map(
                    (a,i)=>(
                      <div
                        className="audit"
                        key={i}
                      >

                        <Clock size={16}/>

                        <div>

                          <strong>
                            {a.detail}
                          </strong>

                          <small>
                            {fmtDate(
                              a.at.slice(
                                0,
                                10
                              )
                            )}
                            {' '}
                            {a.at.slice(
                              11,
                              16
                            )}
                            {' · '}
                            {a.user}
                          </small>

                        </div>

                      </div>
                    )
                  )}

                {!s.audit.some(
                  a=>
                    [
                      'ship',
                      'finish',
                      'cancel',
                      'delete',
                      'import-emails',
                      'import-files'
                    ].includes(
                      a.action
                    )
                ) && (
                  <div className="empty compact">
                    As alterações na programação ficarão registradas aqui.
                  </div>
                )}

              </Panel>

            </>
          )}

          {view==='PENDÊNCIAS' && (
            <>

              <div className="summary-strip">

                <div>
                  <strong>
                    {pending.length}
                  </strong>
                  <span>
                    Pendências do dia
                  </span>
                </div>

                <div>
                  <strong>
                    {
                      pending.filter(
                        r=>
                          r.status==='Atrasado'
                      ).length
                    }
                  </strong>
                  <span>
                    DDS atrasados
                  </span>
                </div>

                <div>
                  <strong>
                    {
                      pending.filter(
                        r=>
                          r.status==='Realizado com pendência'
                      ).length
                    }
                  </strong>
                  <span>
                    Registros incompletos
                  </span>
                </div>

                <div>
                  <strong>
                    {
                      all.filter(
                        r=>
                          r.status==='Justificado'
                      ).length
                    }
                  </strong>
                  <span>
                    Justificados
                  </span>
                </div>

              </div>

              <Panel
                title="Atrasos e registros incompletos"
                extra={
                  <span className="meta">
                    {fmtDate(date)} · todos os períodos
                  </span>
                }
              >
                {obligationTable(pending)}
              </Panel>

              <Panel title="Ocorrências justificadas">
                {obligationTable(
                  all.filter(
                    r=>
                      r.status==='Justificado'
                  )
                )}
              </Panel>

              <p className="footnote">
                Justificativas preservam a ocorrência no histórico. Não contam como DDS realizado nem retiram a obrigação do denominador nesta versão.
              </p>

            </>
          )}

          {view==='HISTÓRICO' && (
            <>

              <div className="filters">

                <div className="search">

                  <Search size={18}/>

                  <input
                    placeholder="Buscar navio, equipe, aplicador ou tema"
                    value={q}
                    onChange={
                      e=>
                        setQ(
                          e.target.value
                        )
                    }
                  />

                </div>

                <select
                  aria-label="Filtrar tipo"
                  value={type}
                  onChange={
                    e=>
                      setType(
                        e.target.value
                      )
                  }
                >
                  {[
                    'Todos',
                    ...TYPES
                  ].map(
                    t=>(
                      <option key={t}>
                        {t}
                      </option>
                    )
                  )}
                </select>

                <button
                  onClick={exportCSV}
                >
                  <Download size={17}/>
                  Exportar CSV
                </button>

              </div>

              <Panel
                title="Respostas registradas"
                extra={
                  <span className="meta">
                    {visibleRecords.length} registros · mais recentes primeiro
                  </span>
                }
              >

                <div className="table-wrap">

                  <table>

                    <thead>
                      <tr>
                        <th>
                          Aplicação
                        </th>
                        <th>
                          Referência
                        </th>
                        <th>
                          Período informado
                        </th>
                        <th>
                          Qualidade
                        </th>
                        <th>
                          Aplicador
                        </th>
                        <th/>
                      </tr>
                    </thead>

                    <tbody>

                      {visibleRecords.map(
                        r=>(
                          <tr key={r.id}>

                            <td>
                              {fmtDate(r.date)}

                              <small>
                                {fmtTime(r.applied)}
                              </small>
                            </td>

                            <td>

                              <strong>
                                {r.type==='NAVIO'
                                  ?r.ship
                                  :r.type ||
                                   'Tipo não informado'}
                              </strong>

                              <small>
                                {r.source}
                              </small>

                            </td>

                            <td>
                              {r.period}
                            </td>

                            <td>

                              <Badge
                                text={
                                  !validRecord(
                                    r,
                                    s.settings
                                  )
                                    ?'Revisar classificação'
                                    :issues(
                                       r,
                                       s
                                     ).length
                                      ?'Realizado com pendência'
                                      :'Realizado'
                                }
                              />

                              {reviewReasons(
                                r,
                                s.settings
                              ).length>0 && (
                                <small className="review-flag">
                                  {
                                    reviewReasons(
                                      r,
                                      s.settings
                                    ).join(' · ')
                                  }
                                </small>
                              )}

                              {unmatched.some(
                                x=>
                                  x.id===r.id
                              ) && (
                                <small>
                                  Sem vínculo com programação
                                </small>
                              )}

                            </td>

                            <td>
                              {r.applicator}
                            </td>

                            <td>
                              <button
                                onClick={
                                  ()=>
                                    setModal({
                                      kind:'detail',
                                      record:r
                                    })
                                }
                              >
                                Ver registro
                              </button>
                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                  {!visibleRecords.length && (
                    <div className="empty">
                      Nenhum registro encontrado.
                    </div>
                  )}

                </div>

              </Panel>

              <p className="footnote">
                O período selecionado no formulário prevalece sobre o horário de aplicação. Registros sem tipo ou com período incompatível ficam para revisão.
              </p>

            </>
          )}

          {view==='ADERÊNCIA' && (
            <AdherenceView
              state={s}
              date={date}
              now={now}
            />
          )}

          {tv && (
            <DayDashboard
              state={s}
              date={date}
              now={now}
              onOpen={
                item=>
                  setModal({
                    kind:'obligation',
                    item
                  })
              }
              onPeriod={
                i=>{
                  setPeriod(i);
                  navigate('HOJE');
                }
              }
            />
          )}

          {view==='CONFIGURAÇÕES' && (
            <div className="config-grid">

              <Panel
                title="Regras e períodos"
                className="rules-panel"
              >

                <RulesEditor
                  key={rev}
                  settings={s.settings}
                  busy={busy}
                  onSave={
                    settings=>{
                      setPeriod(0);

                      save({
                        action:'settings',
                        settings
                      });
                    }
                  }
                />

              </Panel>

              <Panel title="Legenda de status">

                <div className="settings-body status-list">

                  {[
                    'Não iniciado',
                    'Aguardando',
                    'Atrasado',
                    'Realizado',
                    'Realizado com pendência',
                    'Justificado'
                  ].map(
                    (v,i)=>(
                      <div key={v}>

                        <Badge text={v}/>

                        <span>
                          {
                            [
                              'Antes do início da obrigação',
                              'Dentro da tolerância',
                              'Prazo vencido, sem DDS',
                              'Registro com campos completos',
                              'Registro com informação faltante',
                              'Ocorrência com motivo registrado'
                            ][i]
                          }
                        </span>

                      </div>
                    )
                  )}

                </div>

              </Panel>

              {legacyTestRecords.length>0 && (
                <Panel title="Limpeza de produção">

                  <div className="settings-body">

                    <p>
                      {legacyTestRecords.length} registro(s) legado(s) de teste ainda estão armazenados no Firestore.
                    </p>

                    <p className="meta">
                      A limpeza remove apenas registros com origem “Excel de teste” ou “Registro manual de teste”. Registros atuais da Hashdata API não são removidos.
                    </p>

                    <button
                      className="primary"
                      disabled={busy}
                      onClick={
                        ()=>
                          setModal({
                            kind:'cleanup-test',
                            count:
                              legacyTestRecords.length
                          })
                      }
                    >
                      Remover dados legados de teste
                    </button>

                  </div>

                </Panel>
              )}

            </div>
          )}

          <footer>
            <span>
              DDS CONTROL TOWER <b>•</b> AMBIENTE OPERACIONAL
            </span>

            <span>
              Período informado no formulário · Horário de Brasília
            </span>
          </footer>

        </div>

      </main>

      {modal && (
        <Modal
          title={
            modal.kind==='ship'
              ?
                (
                  modal.ship
                    ?'Gerenciar navio'
                    :'Novo navio'
                )
              :
                modal.kind==='import'
                  ?'Importar programação dos e-mails'
                  :
                    modal.kind==='record'
                      ?'Registrar DDS'
                      :
                        modal.kind==='cleanup-test'
                          ?'Remover dados legados de teste'
                          :
                            modal.kind==='confirm'
                              ?'Confirmar alteração'
                              :
                                modal.kind==='justify'
                                  ?'Justificar ocorrência'
                                  :'Detalhes do DDS'
          }
          close={
            ()=>{
              setModal(null);
              setError('');
            }
          }
        >

          {error && (
            <div
              role="alert"
              className="alert danger"
            >
              {error}
            </div>
          )}

          {modal.kind==='import' && (
            <EmailImporter
              ships={s.ships}
              busy={busy}
              onSave={
                ships=>
                  save({
                    action:'import-files',
                    ships
                  })
              }
            />
          )}

          {modal.kind==='cleanup-test' && (
            <div className="settings-body">

              <p>
                Remover {modal.count} registro(s) legado(s) de teste do Firestore?
              </p>

              <p className="meta">
                Serão removidos somente registros com origem “Excel de teste” ou “Registro manual de teste”. A sincronização atual da Hashdata será preservada.
              </p>

              <div className="modal-actions">

                <button
                  onClick={
                    ()=>setModal(null)
                  }
                >
                  Voltar
                </button>

                <button
                  className="primary"
                  disabled={busy}
                  onClick={
                    ()=>
                      save({
                        action:'cleanup-test-data'
                      })
                  }
                >
                  Confirmar limpeza
                </button>

              </div>

            </div>
          )}

          {modal.kind==='ship' && (
            <form
              onSubmit={
                e=>{
                  e.preventDefault();

                  const f=
                    Object.fromEntries(
                      new FormData(
                        e.currentTarget
                      )
                    );

                  save({
                    action:'ship',

                    ship:{
                      ...f,
                      id:
                        modal.ship?.id
                    }
                  });
                }
              }
            >

              <div className="form-grid">

                <Field label="Nome do navio">
                  <input
                    name="name"
                    required
                    defaultValue={
                      modal.ship?.name ||
                      modal.name ||
                      ''
                    }
                  />
                </Field>

                <Field label="Berço">
                  <input
                    name="berth"
                    required
                    defaultValue={
                      modal.ship?.berth ||
                      ''
                    }
                  />
                </Field>

                <Field label="Início da operação">
                  <input
                    name="start"
                    type="datetime-local"
                    required
                    defaultValue={
                      modal.ship
                        ?.start
                        ?.slice(
                          0,
                          16
                        ) ||
                      date+'T13:00'
                    }
                  />
                </Field>

                <Field label="Fim previsto">
                  <input
                    name="end"
                    type="datetime-local"
                    required
                    defaultValue={
                      modal.ship
                        ?.end
                        ?.slice(
                          0,
                          16
                        ) ||
                      date+'T23:00'
                    }
                  />
                </Field>

                <div className="span2">

                  <Field label="Observação">
                    <textarea
                      name="note"
                      defaultValue={
                        modal.ship?.note ||
                        ''
                      }
                    />
                  </Field>

                  {modal.ship?.source && (
                    <p className="meta">
                      Fonte: {modal.ship.source} · Início: {modal.ship.startBasis}
                    </p>
                  )}

                  {modal.ship
                    ?.review
                    ?.map(
                      (
                        x:string,
                        i:number
                      )=>(
                        <small
                          className="review-flag"
                          key={i}
                        >
                          {x}
                        </small>
                      )
                    )}

                </div>

              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  onClick={
                    ()=>setModal(null)
                  }
                >
                  Voltar
                </button>

                <button
                  className="primary"
                  disabled={
                    busy ||
                    (
                      modal.ship &&
                      modal.ship.status!=='Ativo'
                    )
                  }
                >
                  Salvar navio
                </button>

              </div>

              {modal.ship && (
                <div className="operation-actions">

                  {[
                    'finish',
                    'cancel',
                    'delete'
                  ].map(
                    (
                      action,
                      i
                    )=>(
                      <button
                        key={action}
                        type="button"
                        disabled={
                          busy ||
                          (
                            action!=='delete' &&
                            modal.ship.status!=='Ativo'
                          )
                        }
                        onClick={
                          ()=>
                            setModal({
                              kind:'confirm',
                              action,
                              id:modal.ship.id,
                              name:modal.ship.name
                            })
                        }
                      >
                        {
                          [
                            'Finalizar agora',
                            'Cancelar operação',
                            'Excluir cadastro'
                          ][i]
                        }
                      </button>
                    )
                  )}

                </div>
              )}

            </form>
          )}

          {modal.kind==='confirm' && (
            <div className="settings-body">

              <p>
                <strong>
                  {modal.name}
                </strong>
              </p>

              <p>
                {modal.action==='finish'
                  ?'Registrar a saída no horário atual e encerrar novas obrigações?'
                  :modal.action==='cancel'
                    ?'Cancelar a operação e retirar seus DDS da programação? O histórico de respostas será preservado.'
                    :'Excluir o cadastro da programação? As respostas e o histórico de alterações serão preservados.'}
              </p>

              <div className="modal-actions">

                <button
                  onClick={
                    ()=>setModal(null)
                  }
                >
                  Voltar
                </button>

                <button
                  disabled={busy}
                  className="primary"
                  onClick={
                    ()=>
                      save({
                        action:modal.action,
                        id:modal.id
                      })
                  }
                >
                  Confirmar
                </button>

              </div>

            </div>
          )}

          {modal.kind==='record' && (
            <form
              onSubmit={
                e=>{
                  e.preventDefault();

                  const f=
                    new FormData(
                      e.currentTarget
                    );

                  save({
                    action:'record',

                    record:{
                      ...Object.fromEntries(
                        f
                      ),

                      id:
                        modal.record.id,

                      photo:
                        f.has('photo'),

                      signature:
                        f.has('signature')
                    }
                  });
                }
              }
            >

              <div className="form-grid">

                <Field label="Tipo de DDS">

                  <select
                    name="type"
                    required
                    value={recordType}
                    onChange={
                      e=>
                        setRecordType(
                          e.target.value
                        )
                    }
                  >

                    <option value="">
                      Selecione
                    </option>

                    {TYPES.map(
                      t=>(
                        <option key={t}>
                          {t}
                        </option>
                      )
                    )}

                  </select>

                </Field>

                <Field label="Nome do navio (para NAVIO)">
                  <input
                    name="ship"
                    defaultValue={
                      modal.record.ship
                    }
                  />
                </Field>

                <Field label="Data operacional do período">
                  <input
                    name="date"
                    type="date"
                    required
                    value={recordDate}
                    onChange={
                      e=>
                        setRecordDate(
                          e.target.value
                        )
                    }
                  />
                </Field>

                <Field label="Período informado">

                  <select
                    key={
                      recordType+
                      '-'+
                      recordDate
                    }
                    name="period"
                    required
                    defaultValue={
                      typePeriods(
                        recordType,
                        recordDate
                      ).includes(
                        modal.record.period
                      )
                        ?modal.record.period
                        :''
                    }
                  >

                    <option value="">
                      Selecione
                    </option>

                    {typePeriods(
                      recordType,
                      recordDate
                    ).map(
                      p=>(
                        <option key={p}>
                          {p}
                        </option>
                      )
                    )}

                  </select>

                </Field>

                <Field label="Data e hora da aplicação">
                  <input
                    name="applied"
                    type="datetime-local"
                    required
                    defaultValue={
                      modal.record
                        .applied
                        ?.slice(
                          0,
                          16
                        )
                    }
                  />
                </Field>

                <Field label="Aplicador">
                  <input
                    name="applicator"
                    defaultValue={
                      modal.record.applicator
                    }
                  />
                </Field>

                <Field label="Supervisor">
                  <input
                    name="supervisor"
                    defaultValue={
                      modal.record.supervisor
                    }
                  />
                </Field>

                <Field label="Participantes">
                  <textarea
                    name="participants"
                    defaultValue={
                      modal.record.participants
                    }
                  />
                </Field>

                <div className="span2">

                  <Field label="Temas abordados">
                    <textarea
                      name="topics"
                      defaultValue={
                        modal.record.topics
                      }
                    />
                  </Field>

                </div>

                <label className="check">

                  <input
                    type="checkbox"
                    name="photo"
                    defaultChecked={
                      modal.record.photo
                    }
                  />

                  Foto informada

                </label>

                <label className="check">

                  <input
                    type="checkbox"
                    name="signature"
                    defaultChecked={
                      modal.record.signature
                    }
                  />

                  Assinatura informada

                </label>

              </div>

              <p className="form-note">
                O registro manual é armazenado apenas no DDS Control e não altera o formulário no Hashdata.
              </p>

              <div className="modal-actions">

                <button
                  type="button"
                  onClick={
                    ()=>setModal(null)
                  }
                >
                  Voltar
                </button>

                <button
                  disabled={busy}
                  className="primary"
                >
                  Salvar DDS
                </button>

              </div>

            </form>
          )}

          {modal.kind==='justify' && (
            <form
              className="settings-body"
              onSubmit={
                e=>{
                  e.preventDefault();

                  save({
                    action:'justify',

                    key:
                      modal.item.key,

                    reason:
                      new FormData(
                        e.currentTarget
                      ).get(
                        'reason'
                      )
                  });
                }
              }
            >

              <p>
                {modal.item.reference} · {modal.item.period}
              </p>

              <Field label="Motivo da justificativa">
                <textarea
                  name="reason"
                  minLength={5}
                  required
                  placeholder="Ex.: equipe sem operação neste período"
                />
              </Field>

              <div className="modal-actions">

                <button
                  className="primary"
                  disabled={busy}
                >
                  Salvar justificativa
                </button>

              </div>

            </form>
          )}

          {[
            'obligation',
            'detail'
          ].includes(
            modal.kind
          ) &&
          (()=>{

            const r:
              RecordDDS|undefined=
              modal.record ||
              modal.item?.record;

            const item:
              Obligation|undefined=
              modal.item;

            return (
              <div className="settings-body">

                {item && (
                  <>

                    <h3>
                      {item.reference}
                    </h3>

                    <Badge
                      text={
                        item.status
                      }
                    />

                    <p>
                      {fmtDate(item.date)} · {item.period} · Prazo {fmtTime(item.due)}
                    </p>

                    {item.reason && (
                      <p>
                        <strong>
                          Justificativa:
                        </strong>
                        {' '}
                        {item.reason}
                      </p>
                    )}

                  </>
                )}

                {r && (
                  <>

                    <dl>

                      <dt>
                        Tipo / navio
                      </dt>

                      <dd>
                        {r.type||'Não informado'} {r.ship}
                      </dd>

                      <dt>
                        Aplicação
                      </dt>

                      <dd>
                        {fmtDate(
                          r.applied.slice(
                            0,
                            10
                          )
                        )}
                        {' '}
                        {fmtTime(r.applied)}
                      </dd>

                      <dt>
                        Período informado
                      </dt>

                      <dd>
                        {r.period}
                      </dd>

                      <dt>
                        Aplicador
                      </dt>

                      <dd>
                        {r.applicator||'Não informado'}
                      </dd>

                      <dt>
                        Supervisor
                      </dt>

                      <dd>
                        {r.supervisor||'Não informado'}
                      </dd>

                      <dt>
                        Participantes
                      </dt>

                      <dd className="pre">
                        {r.participants||'Não informado'}
                      </dd>

                      <dt>
                        Temas
                      </dt>

                      <dd className="pre">
                        {r.topics||'Não informado'}
                      </dd>

                      <dt>
                        Foto / assinatura
                      </dt>

                      <dd>
                        {r.photo
                          ?'Foto indicada'
                          :'Sem foto'}
                        {' · '}
                        {r.signature
                          ?'Assinatura indicada'
                          :'Sem assinatura'}
                      </dd>

                    </dl>

                    <p className="meta">
                      A exportação informa a presença dos anexos. Os arquivos de foto e assinatura ainda não foram carregados.
                    </p>

                    {issues(
                      r,
                      s
                    ).length>0 && (
                      <p className="alert warning">
                        Faltam: {issues(r,s).join(', ')}
                      </p>
                    )}

                    <button
                      onClick={
                        ()=>
                          recordForm(
                            undefined,
                            r
                          )
                      }
                    >
                      Editar registro
                    </button>

                  </>
                )}

                {item && !r && (
                  <div className="modal-actions">

                    <button
                      onClick={
                        ()=>recordForm(item)
                      }
                    >
                      Registrar DDS
                    </button>

                    {item.status==='Justificado'
                      ?
                        <button
                          onClick={
                            ()=>
                              save({
                                action:'unjustify',
                                key:item.key
                              })
                          }
                        >
                          Remover justificativa
                        </button>
                      :
                        <button
                          className="primary"
                          onClick={
                            ()=>
                              setModal({
                                kind:'justify',
                                item
                              })
                          }
                        >
                          Justificar
                        </button>}

                  </div>
                )}

              </div>
            );
          })()}

        </Modal>
      )}

    </div>
  );
}
