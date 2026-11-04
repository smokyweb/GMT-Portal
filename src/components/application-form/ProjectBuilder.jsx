import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Switch} from '@/components/ui/switch';
import {Button} from '@/components/ui/button';
import {Trash2} from 'lucide-react';
import BudgetBuilder from '@/components/BudgetBuilder';

const PROJECT_TYPES=['Planning','Equipment','Training','Travel','Personnel','Infrastructure','Other'];
const PRIORITIES=['High','Medium','Low'];

export default function ProjectBuilder({project,index,onChange,onRemove,nofo,canRemove,legacyEnabled}) {
  const set=(field,value)=>onChange({...project,[field]:value});
  return <div className="rounded-xl border bg-card p-5 space-y-5">
    <div className="flex items-center justify-between gap-3">
      <div><h3 className="font-semibold">Project {index+1}</h3><p className="text-xs text-muted-foreground">Add the project scope and its budget lines.</p></div>
      {canRemove&&<Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-destructive"><Trash2 className="h-4 w-4 mr-1"/>Remove</Button>}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2"><label className="text-xs font-medium">Project Title <span className="text-red-500">*</span></label><Input className="mt-1" value={project.title||''} onChange={e=>set('title',e.target.value)} placeholder="Project title"/></div>
      {legacyEnabled&&<div><label className="text-xs font-medium">Legacy Project ID</label><Input className="mt-1" value={project.legacy_project_id||''} onChange={e=>set('legacy_project_id',e.target.value)} /></div>}
      <div><label className="text-xs font-medium">Project ZIP <span className="text-red-500">*</span></label><Input className="mt-1" inputMode="numeric" maxLength={5} value={project.project_zip||''} onChange={e=>set('project_zip',e.target.value.replace(/[^0-9]/g,'').slice(0,5))} placeholder="5-digit ZIP"/></div>
      <div><label className="text-xs font-medium">Project Type</label><Select value={project.project_type||'Other'} onValueChange={v=>set('project_type',v)}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent>{PROJECT_TYPES.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div><label className="text-xs font-medium">Funding Type</label><Select value={project.funding_type||'Pass-Through'} onValueChange={v=>set('funding_type',v)}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Pass-Through">Pass-Through</SelectItem><SelectItem value="Retained">Retained</SelectItem></SelectContent></Select></div>
      <div><label className="text-xs font-medium">Awarded Amount</label><Input className="mt-1" type="number" min="0" value={project.awarded_amount??''} onChange={e=>set('awarded_amount',e.target.value)} placeholder="0.00"/></div>
      <div><label className="text-xs font-medium">National Priority Area</label><Input className="mt-1" value={project.national_priority_area||''} onChange={e=>set('national_priority_area',e.target.value)}/></div>
      <div><label className="text-xs font-medium">IJ Title</label><Input className="mt-1" value={project.ij_title||''} onChange={e=>set('ij_title',e.target.value)}/></div>
      <div><label className="text-xs font-medium">IJ Funding Priority</label><Select value={project.ij_funding_priority||'Medium'} onValueChange={v=>set('ij_funding_priority',v)}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent>{PRIORITIES.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div><label className="text-xs font-medium">IJ Number</label><Input className="mt-1" value={project.ij_number||''} onChange={e=>set('ij_number',e.target.value)}/></div>
      <div><label className="text-xs font-medium">IJ Core Capability</label><Input className="mt-1" value={project.ij_core_capability||''} onChange={e=>set('ij_core_capability',e.target.value)}/></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div><label className="text-xs font-medium">Project Narrative</label><Textarea rows={4} className="mt-1" value={project.project_narrative||''} onChange={e=>set('project_narrative',e.target.value)}/></div>
      <div><label className="text-xs font-medium">Work Plan</label><Textarea rows={4} className="mt-1" value={project.work_plan||''} onChange={e=>set('work_plan',e.target.value)}/></div>
    </div>
    <div className="flex flex-wrap gap-6 border-y py-3 text-sm">
      <label className="flex items-center gap-2">LETPA eligible <Switch checked={!!project.letpa_eligible} onCheckedChange={v=>set('letpa_eligible',v)}/></label>
      <label className="flex items-center gap-2">Shareable <Switch checked={!!project.shareable} onCheckedChange={v=>set('shareable',v)}/></label>
      <label className="flex items-center gap-2">Deployable <Switch checked={!!project.deployable} onCheckedChange={v=>set('deployable',v)}/></label>
      <label className="flex items-center gap-2">Active <Switch checked={project.is_active!==false} onCheckedChange={v=>set('is_active',v)}/></label>
    </div>
    <div><h4 className="font-medium mb-3">Project Budget</h4><BudgetBuilder items={project.budgets||[]} onChange={budgets=>onChange({...project,budgets})} nofo={nofo}/></div>
  </div>;
}
