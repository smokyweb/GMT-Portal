export default function ApplicationStepNavigation({state}) {
  return <nav aria-label="Application steps" className="flex gap-2 flex-wrap">{state.sections.map((section,index)=><button key={section.id} type="button" disabled={state.busy} aria-current={state.section.id===section.id?'step':undefined} onClick={()=>state.setStepId(section.id)} className={'rounded-full px-3 py-2 text-xs font-medium '+(state.section.id===section.id?'bg-primary text-primary-foreground':'bg-muted text-muted-foreground')}>{index+1}. {section.label}</button>)}</nav>;
}
