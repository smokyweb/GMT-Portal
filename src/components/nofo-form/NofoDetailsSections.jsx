import {prepareNofoProgramSelection} from '@/lib/awards/nofoProgramSelection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import RequiredTemplatesPanel from '@/components/RequiredTemplatesPanel';

const ORG_TYPES=['County','Municipality','Nonprofit','Tribe','Local Jurisdiction','Local Jurisdiction State Agency','State Agency','Federal Agency','University','Other'];
const setValue=(form,onChange,key,value)=>onChange({...form,[key]:value});
const Section=({title,children,defaultOpen=true})=><details open={defaultOpen} className="rounded-lg border bg-card shadow-sm"><summary className="cursor-pointer list-none px-4 py-3 font-semibold text-sm flex items-center justify-between"><span>{title}</span><span className="text-muted-foreground text-xs">Click to collapse</span></summary><div className="border-t px-4 py-4">{children}</div></details>;
const TextField=({form,onChange,label,field,type='text',placeholder='',disabled=false,span=false,min})=><div className={span?'md:col-span-2':''}><Label htmlFor={'nofo-'+field}>{label}</Label><Input id={'nofo-'+field} type={type} value={form[field]??''} placeholder={placeholder} min={min} disabled={disabled} onChange={e=>setValue(form,onChange,field,e.target.value)}/></div>;
const DateField=({form,onChange,label,field,min})=><TextField form={form} onChange={onChange} label={label} field={field} type="date" min={min}/>;
const pct=(amount,total)=>amount!==''&&amount!=null&&total!==''&&Number(total)!==0?(Number(amount)/Number(total)*100).toFixed(2):'';

export default function NofoDetailsSections({form,onChange,programs,editing,legacyConfig,legacyLabel,onAddDoc,onUpdateDoc,onRemoveDoc}){
  const program=programs.find(item=>item.id===form.program_id);
  return <div className="space-y-4">
    <Section title="Basics">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField form={form} onChange={onChange} label="Title *" field="title" placeholder="NOFO title"/>
        <TextField form={form} onChange={onChange} label="Fiscal Year *" field="fiscal_year" type="number" placeholder="e.g. 2023"/>
        <div><Label>Grant Program</Label><Select value={form.program_id||'__none__'} onValueChange={value=>onChange(prepareNofoProgramSelection(form,programs,value))}><SelectTrigger><SelectValue placeholder="Select program"/></SelectTrigger><SelectContent><SelectItem value="__none__">Select program</SelectItem>{programs.filter(item=>item.is_active||item.id===form.program_id).map(item=><SelectItem key={item.id} value={item.id}>{item.name} ({item.code}){!item.is_active?' ⚠ inactive':''}</SelectItem>)}</SelectContent></Select></div>
        <TextField form={form} onChange={onChange} label="Funding Stream" field="funding_stream"/>
        <TextField form={form} onChange={onChange} label="Federal Grant Number (FAIN)" field="grant_number"/>
        <TextField form={form} onChange={onChange} label="State Grant #" field="state_grant_number"/>
        <TextField form={form} onChange={onChange} label="Assistance Listing #" field="cfda_number"/>
        <TextField form={form} onChange={onChange} label="Assistance Listing Title" field="cfda_title"/>
        <TextareaField form={form} onChange={onChange} label="Summary" field="summary" span/>
      </div>
    </Section>
    <Section title="Funding">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField form={form} onChange={onChange} label="Total Funding Available ($)" field="total_funding_available" type="number"/>
        <TextField form={form} onChange={onChange} label="Total Federal Award to State ($)" field="total_federal_award" type="number"/>
        <TextField form={form} onChange={onChange} label="Min Award ($)" field="min_award" type="number"/>
        <TextField form={form} onChange={onChange} label="Max Award ($)" field="max_award" type="number"/>
        <TextField form={form} onChange={onChange} label="Per-Organization Award Cap ($)" field="organization_award_cap" type="number"/>
        <TextField form={form} onChange={onChange} label="M&A Retained (%)" field="ma_percent" type="number"/>
        <TextField form={form} onChange={onChange} label="Local Share (Pass-Through) ($)" field="local_share_amount" type="number"/>
        <div><Label>Local Share (%)</Label><Input readOnly value={pct(form.local_share_amount,form.total_funding_available)}/></div>
        <TextField form={form} onChange={onChange} label="State Share (Retained) ($)" field="state_share_amount" type="number"/>
        <div><Label>State Share (%)</Label><Input readOnly value={pct(form.state_share_amount,form.total_funding_available)}/></div>
        <TextField form={form} onChange={onChange} label="MOU Amount ($)" field="mou_amount" type="number"/>
      </div>
    </Section>
    <Section title="Dates">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DateField form={form} onChange={onChange} label="Application Open Date" field="open_date"/>
        <DateField form={form} onChange={onChange} label="Application Close Date" field="close_date"/>
        <DateField form={form} onChange={onChange} label="Federal Award Date" field="federal_award_date"/>
        <DateField form={form} onChange={onChange} label="Federal Close Date" field="federal_close_date"/>
        <DateField form={form} onChange={onChange} label="Federal PoP Start" field="federal_performance_start"/>
        <DateField form={form} onChange={onChange} label="Federal PoP End" field="federal_performance_end" min={form.federal_performance_start||undefined}/>
      </div>
    </Section>
    <Section title="Eligibility">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label>Available States</Label><p className="text-xs text-muted-foreground mb-2">Leave empty for all states.</p><Input value={(form.scope_states||[]).join(', ')} onChange={e=>setValue(form,onChange,'scope_states',e.target.value.split(',').map(value=>value.trim().toUpperCase()).filter(Boolean))} placeholder="e.g. NE, IL, CA"/></div>
        <div><Label>Eligible Organization Types</Label><div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">{ORG_TYPES.map(type=><label key={type} className="flex items-center gap-2 text-sm"><Checkbox checked={(form.eligible_org_types||[]).includes(type)} onCheckedChange={checked=>setValue(form,onChange,'eligible_org_types',checked?[...(form.eligible_org_types||[]),type]:(form.eligible_org_types||[]).filter(item=>item!==type))}/>{type}</label>)}</div></div>
        <TextareaField form={form} onChange={onChange} label="Eligibility Criteria" field="eligibility_criteria" span/>
        <TextareaField form={form} onChange={onChange} label="Allowable Costs" field="allowable_costs" span/>
      </div>
    </Section>
    <Section title="Evaluation">
      <div className="space-y-4"><TextareaField form={form} onChange={onChange} label="Evaluation Criteria" field="evaluation_criteria"/><div className="flex w-full items-center justify-between rounded-lg border p-3"><div><Label>Enable Application Scoring</Label><p className="text-xs text-muted-foreground">Allow reviewers to score applications under this NOFO.</p></div><Switch checked={!!form.scoring_enabled} onCheckedChange={value=>setValue(form,onChange,'scoring_enabled',value)}/></div></div>
    </Section>
    <Section title="Award Terms" defaultOpen={false}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><TextareaField form={form} onChange={onChange} label="Statutory Authority" field="statutory_authority"/><TextareaField form={form} onChange={onChange} label="Federal Award Description" field="federal_award_description"/><TextField form={form} onChange={onChange} label="Default Indirect Cost Rate (%)" field="indirect_cost_rate" type="number"/><TextField form={form} onChange={onChange} label="Method of Payment" field="payment_method"/><div><Label>Research & Development</Label><Select value={form.is_r_and_d==null?'__none__':String(form.is_r_and_d)} onValueChange={value=>setValue(form,onChange,'is_r_and_d',value==='__none__'?null:value==='true')}><SelectTrigger><SelectValue placeholder="Not specified"/></SelectTrigger><SelectContent><SelectItem value="__none__">Not specified</SelectItem><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select></div><TextareaField form={form} onChange={onChange} label="Indirect Cost / R&D Statement" field="indirect_rd_statement"/></div>
    </Section>
    <Section title="Documents" defaultOpen={false}>
      <div className="space-y-6"><div><div className="flex items-center justify-between mb-2"><div><Label>Required Documents</Label><p className="text-xs text-muted-foreground">Applicant-submitted checklist items.</p></div><Button type="button" variant="outline" size="sm" onClick={onAddDoc}>+ Add Document</Button></div><div className="space-y-2">{(form.required_documents||[]).map((doc,index)=>doc.template_id?null:<div key={index} className="flex items-center gap-2"><Input value={doc.name||''} onChange={e=>onUpdateDoc(index,'name',e.target.value)} placeholder="Document name" className="flex-1"/><label className="flex items-center gap-1 text-xs"><Checkbox checked={!!doc.mandatory} onCheckedChange={value=>onUpdateDoc(index,'mandatory',value)}/>Required</label><Button type="button" variant="ghost" size="sm" onClick={()=>onRemoveDoc(index)}>✕</Button></div>)}</div></div>{editing&&<div><RequiredTemplatesPanel entityType="NOFO" entityId={editing.id} assignmentMode requiredTemplateAssignments={(form.required_documents||[]).filter(doc=>doc.template_id)} onUpdate={assignments=>onChange({...form,required_documents:[...(form.required_documents||[]).filter(doc=>!doc.template_id),...assignments]})} isAdmin/></div>}</div>
    </Section>
    {legacyConfig.enabled&&<Section title="Legacy" defaultOpen={false}><TextField form={form} onChange={onChange} label={legacyLabel} field="legacy_grant_id" disabled={!legacyConfig.canEdit}/></Section>}
  </div>;
}
function TextareaField({form,onChange,label,field,span=true}){return <div className={span?'md:col-span-2':''}><Label htmlFor={'nofo-'+field}>{label}</Label><Textarea id={'nofo-'+field} value={form[field]??''} rows={3} onChange={e=>setValue(form,onChange,field,e.target.value)}/></div>}
