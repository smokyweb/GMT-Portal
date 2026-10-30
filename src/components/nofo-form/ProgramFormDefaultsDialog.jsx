import {useProgramFormScope} from '@/hooks/useProgramFormScope';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/admin/ui';
import NofoFormEditor from './NofoFormEditor';
export default function ProgramFormDefaultsDialog({program,onClose}) {
  const state=useProgramFormScope();
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Application Defaults — {program.name}</DialogTitle><DialogDescription>Configure the fields and sections inherited by new NOFO forms for {program.code}.</DialogDescription></DialogHeader>
    {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.loading?<p role="status">Loading program defaults…</p>:state.actor&&<div className="space-y-4">
      {state.actor.role==='isc_admin'?<label className="text-sm block">Default scope<select aria-label="Program default scope" value={state.scope} onChange={event=>state.setScope(event.target.value)} className="block mt-1 w-full border rounded p-2 bg-background text-sm"><option value="">All states</option>{state.states.map(code=><option key={code} value={code}>{code}</option>)}</select></label>:<p className="text-sm">State override: <strong>{state.scope}</strong></p>}
      <NofoFormEditor key={program.id+':'+state.scope} nofo={program} mode="program" scopeState={state.scope}/>
    </div>}
  </DialogContent></Dialog>;
}
