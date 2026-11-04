import {inputDate} from './awardFields.js';
export function inheritedAward(application,nofo={},program={},organization={}) {
  const fields={},origins={};
  const set=(key,value,origin)=>{fields[key]=value??null;origins[key]=origin;};
  const cfda=nofo.cfda_number||program.cfda_number||null,cfdaSource=nofo.cfda_number?'from NOFO':'from Grant Program';
  set('federal_award_number',nofo.grant_number,'from NOFO');set('state_grant_number',nofo.state_grant_number,'from NOFO');
  set('cfda_number',cfda,cfdaSource);
  for(const key of ['federal_award_date','federal_performance_start','federal_performance_end'])set(key,inputDate(nofo[key])||null,'from NOFO');
  set('federal_close_date',inputDate(nofo.federal_close_date)||inputDate(nofo.federal_performance_end)||null,'from NOFO');
  for(const [key,source,fallback] of [['award_start','performance_start','federal_performance_start'],['award_close','performance_end','federal_performance_end']])
    set(key,inputDate(application[source])||inputDate(nofo[fallback])||null,application[source]?'from Application':'from NOFO');
  set('recipient_type',organization.type,'from Organization');
  for(const key of ['awarded_amount','match_amount'])set(key,application[key],'from Application');
  set('award_status','Pending','Award');set('subaward_number',null,'Award');set('isip_bsir_number',null,'Award');set('ma_amount',null,'Award');
  set('state_start',null,'Award');set('state_close',null,'Award');
  return {fields,origins};
}
