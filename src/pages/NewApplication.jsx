import {useApplicationWizard} from '@/hooks/useApplicationWizard';
import {ehpRequired} from '@/lib/forms/valueValidation';
import ApplicationOrganizationStep from '@/components/application-form/ApplicationOrganizationStep';
import ApplicationStepNavigation from '@/components/application-form/ApplicationStepNavigation';
import ApplicationWizardActions from '@/components/application-form/ApplicationWizardActions';
import ApplicationReview from '@/components/application-form/ApplicationReview';
import ConfiguredFields from '@/components/application-form/ConfiguredFields';
import ProjectBuilder from '@/components/application-form/ProjectBuilder';
import DocumentsStep from '@/components/ApplicationDocumentsStep';
export default function NewApplication() {
  const state=useApplicationWizard();
  if(state.loading)return <p role="status" className="p-8 text-sm text-muted-foreground">Loading application…</p>;
  if(!state.user&&state.error)return <div className="space-y-3"><p role="alert" className="text-sm text-red-700">{state.error}</p><button type="button" className="text-sm text-primary" onClick={()=>state.navigate('/my-applications')}>Back to Applications</button></div>;
  return <div className="max-w-4xl mx-auto space-y-6">
    <header><h1 className="text-2xl font-bold">{state.application?.status==='RevisionRequested'?'Revise Application':'New Application'}</h1>
      {state.nofo&&<p className="text-sm text-muted-foreground mt-1">Applying for: {state.nofo.title}</p>}
      {state.application?.revision_notes&&<p className="text-sm p-3 bg-amber-50 border rounded mt-3">{state.application.revision_notes}</p>}</header>
    {!state.sections.some(section=>section.kind==='organization')&&<ApplicationOrganizationStep state={state}/>}
    <ApplicationStepNavigation state={state}/>
    {state.error&&<p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
    {state.errors.length>0&&<ul role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 list-disc list-inside">{state.errors.map((error,index)=><li key={index}><button type="button" className="text-left underline" onClick={()=>state.setStepId(error.sectionId)}>{error.message}</button></li>)}</ul>}
    <section className="rounded-xl border bg-card p-6 space-y-5"><h2 className="text-lg font-semibold">{state.section.label}</h2>
      {state.section.kind==='organization'&&<ApplicationOrganizationStep state={state}/>}
      <ConfiguredFields section={state.section} state={state}/>
      {state.section.kind==='ehp'&&ehpRequired(state.definition,state.context)&&<p role="status" className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">EHP review is required. Upload the EHP screening form in Documents. Affected reimbursements require recorded EHP approval.</p>}
      {state.section.kind==='budget'&&<div className="space-y-5">
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Projects</h3><p className="text-sm text-muted-foreground">Add at least one project. Each project has its own budget.</p></div><button type="button" className="rounded bg-primary text-primary-foreground px-3 py-2 text-sm" onClick={state.addProject} disabled={state.submitted}>+ Add Project</button></div>
        {state.projects.map((project,index)=><ProjectBuilder key={project.id||`new-${index}`} project={project} index={index} onChange={next=>state.changeProject(index,next)} onRemove={()=>state.removeProject(index)} canRemove={state.projects.length>1&&!state.submitted} nofo={state.nofo} projectConfig={state.projectConfig} legacyEnabled={Object.prototype.hasOwnProperty.call(project,'legacy_project_id')}/>)}
        {state.projects.length>0&&Number.isFinite(Number(state.form.awarded_amount))&&Number(state.form.awarded_amount)>0&&Math.abs(state.projects.reduce((sum,p)=>sum+(Number(p.awarded_amount)||0),0)-Number(state.form.awarded_amount))>0.005&&<p role="status" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Project awarded amounts do not add up to the application awarded amount. Review the project amounts before submitting.</p>}
      </div>}
      {state.section.kind==='documents'&&<DocumentsStep nofo={{...state.nofo,required_documents:state.definition.rules.requiredDocuments||state.nofo?.required_documents||[]}} app={state.application} user={state.user} org={state.organization} onSaveDraft={state.saveDraft} readOnly={state.submitted} extraRequired={[...(ehpRequired(state.definition,state.context)?[{name:state.definition.rules.ehpScreeningDocument,mandatory:true}]:[]),...(state.projectConfig.requiredIjAttachment?[{name:'Investment Justification Attachment',mandatory:true}]:[])]}/>} 
      {state.section.kind==='review'&&<ApplicationReview state={state}/>}
    </section>
    <ApplicationWizardActions state={state}/>
  </div>;
}
