import {obligations,periodsFor,shiftDate,score,type State} from './domain';
export function rangeDates(anchor:string,mode:'week'|'month'){
 const d=new Date(anchor+'T12:00:00Z');
 const start=mode==='week'?shiftDate(anchor,-((d.getUTCDay()+6)%7)):anchor.slice(0,7)+'-01';
 const count=mode==='week'?7:new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 return Array.from({length:count},(_,i)=>shiftDate(start,i));
}
export function dayObligations(state:State,date:string,now:number){return periodsFor(state.settings).flatMap((_,i)=>obligations(state,date,i,now));}
export function adherenceSeries(state:State,anchor:string,mode:'week'|'month',now:number,type='Todos'){
 return rangeDates(anchor,mode).map(date=>{
  const rows=dayObligations(state,date,now).filter(r=>r.start<=now&&(type==='Todos'||r.type===type));
  return {date,...score(rows),rows};
 });
}
