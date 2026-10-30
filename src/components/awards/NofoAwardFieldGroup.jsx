import {NOFO_AWARD_FIELDS} from '@/lib/awards/awardFields';
import AwardValueInput from './AwardValueInput';
export default function NofoAwardFieldGroup({group,form,onChange,program=null}) {
  const fields=NOFO_AWARD_FIELDS.filter(field=>field.group===group);
  return <fieldset className="space-y-3 rounded border p-3">
    <legend className="px-1 text-sm font-semibold">{group==='Program'?'Federal Award Information':group==='Terms'?'Award Terms':group}</legend>
    <div className="grid sm:grid-cols-2 gap-3">{fields.map(field=><div key={field.key} className={field.type==='textarea'?'sm:col-span-2':''}>
      <label htmlFor={'award-'+field.key} className="text-xs font-medium">{field.label}</label>
      <AwardValueInput field={field} value={form[field.key]} onChange={value=>onChange(field.key,value)}/>
      {field.key==='cfda_number'&&program?.cfda_number&&<p className="text-xs text-muted-foreground mt-1">Program default: {program.cfda_number}</p>}
      {field.key==='ma_percent'&&<p className="text-xs text-muted-foreground mt-1">{program?.ma_limit_percent!=null?'Configured program limit: '+program.ma_limit_percent+'%':'Set the program M&A limit in Grant Programs before entering a retained percentage.'}</p>}
    </div>)}</div>
  </fieldset>;
}
