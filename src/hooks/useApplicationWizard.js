import {legacyForm} from '@/lib/forms/legacyForm';
import {useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {base44} from '@/api/base44Client';
import {defaultForm} from '@/lib/forms/defaultForm';
import {validateFormValues,validateBudget} from '@/lib/forms/valueValidation';
import {draftForm,persistDraft,applyFieldValue,budgetTotals,allProjectBudgets,reviewFields} from '@/lib/forms/applicationDraft';
export function useApplicationWizard() {
  const navigate=useNavigate(),savePromise=useRef(null),appRef=useRef(null);
  const [user,setUser]=useState(null),[organization,setOrganization]=useState(null),[organizations,setOrganizations]=useState([]),[nofos,setNofos]=useState([]);
  const [nofo,setNofo]=useState(null),[application,setApplication]=useState(null),[definition,setDefinition]=useState(defaultForm()),[form,setForm]=useState(draftForm());
  const [projects,setProjects]=useState([]),[removedProjectIds,setRemovedProjectIds]=useState([]),[stepId,setStepId]=useState('organization');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[errors,setErrors]=useState([]),[confirmed,setConfirmed]=useState(false),[submitted,setSubmitted]=useState(false);
  useEffect(()=>{
    let active=true;
    (async()=>{try{
      const params=new URLSearchParams(window.location.search),id=params.get('id'),nofoId=params.get('nofo');
      const actor=await base44.auth.me();
      const [orgs,notices]=await Promise.all([base44.entities.Organization.list('-name',500),base44.entities.Nofo.list('-created_date',500)]);
      let existing=null;if(id)existing=(await base44.entities.Application.filter({id})).find(item=>item.id===id);
      if(id&&!existing)throw new Error('Application not found');
      const selectedOrg=orgs.find(org=>org.id===(existing?.organization_id||actor.organization_id));
      const selectedNofo=notices.find(notice=>notice.id===(existing?.nofo_id||nofoId))||null;
      let version;if(existing)version=(await base44.forms.application(existing.id,'edit')).version;
      else if(selectedNofo)version=await base44.forms.nofo(selectedNofo.id);
      const [budgets,loadedProjects]=existing?await Promise.all([base44.entities.ApplicationBudget.filter({application_id:existing.id}),base44.entities.Project.filter({application_id:existing.id})]):[[],[]];
      if(!active)return;
      setUser(actor);setOrganizations(orgs.filter(org=>org.is_active!==false&&(actor.role==='user'?org.id===actor.organization_id:actor.role==='isc_admin'||org.state===(actor.scope_state||actor.grantee_state))));
      setNofos(notices.filter(notice=>notice.id===selectedNofo?.id||['Published','Active'].includes(notice.status)));
      setOrganization(selectedOrg||null);setNofo(selectedNofo);setDefinition(version?.definition||(existing?legacyForm(selectedNofo||{program_code:existing.program_code}):defaultForm(selectedNofo||{})));
      const initialProjects=(loadedProjects||[]).map(project=>({...project,isExisting:true,budgets:(budgets||[]).filter(item=>item.project_id===project.id||(!item.project_id&&project===loadedProjects[0])).map(item=>({...item,isExisting:true}))}));
      if(!initialProjects.length&&!existing)initialProjects.push({title:'',project_type:'Other',funding_type:'Pass-Through',is_active:true,budgets:[]});
      appRef.current=existing;setApplication(existing);setSubmitted(Boolean(existing&&!['Draft','RevisionRequested','ChangesRequested'].includes(existing.status)));setForm(draftForm(existing||{}));setProjects(initialProjects);
    }catch(err){if(active)setError(err.message);}finally{if(active)setLoading(false);}})();return()=>{active=false;};
  },[]);
  const sections=definition.sections.filter(section=>section.enabled),section=sections.find(item=>item.id===stepId)||sections[0];
  const context={application:form,organization:organization||{},values:form.form_values};
  const saveDraft=async()=>{
    if(savePromise.current)return savePromise.current;
    if(!organization)throw new Error('Select an organization first');
    setBusy(true);setError('');
    const operation=(async()=>{
      if(!projects.length)throw new Error('Add at least one Project before saving the application');
      const result=await persistDraft({application:appRef.current,form,nofo,organization,projects,removedProjectIds,onApplication:saved=>{appRef.current=saved;setApplication(saved);},onProject:(index,row)=>setProjects(current=>current.map((item,i)=>i===index?row:item))});
      appRef.current=result.application;setApplication(result.application);setProjects(result.projects);setRemovedProjectIds([]);
      if(result.application.form_version_id) {
        const pinned=await base44.forms.application(result.application.id,'edit');setDefinition(pinned.version.definition);
      }
      navigate('/new-application?id='+result.application.id,{replace:true});
      return result.application;
    })();savePromise.current=operation;
    try{return await operation;}finally{setBusy(false);savePromise.current=null;}
  };
  const chooseNofo=async id=>{
    if(application&&!['Draft','RevisionRequested','ChangesRequested'].includes(application.status))return;
    setBusy(true);setError('');
    try {const selected=nofos.find(notice=>notice.id===id)||null;setNofo(selected);setForm(current=>({...current,form_values:{}}));setDefinition(selected?(await base44.forms.nofo(id)).definition:defaultForm());setStepId('organization');}
    catch(err){setError(err.message);}finally{setBusy(false);}
  };
  const changeProject=(index,next)=>{
    if(submitted)return;
    setProjects(current=>current.map((project,i)=>i===index?next:project));
    const total=budgetTotals(allProjectBudgets(projects.map((project,i)=>i===index?next:project)));setForm(current=>({...current,requested_amount:total.federal/100,match_amount:total.match/100}));
  };
  const addProject=()=>{if(!submitted)setProjects(current=>[...current,{title:'',project_type:'Other',funding_type:'Pass-Through',is_active:true,budgets:[]}]);};
  const removeProject=index=>{if(submitted||projects.length<=1)return;const project=projects[index];if(project.id&&project.isExisting)setRemovedProjectIds(ids=>[...new Set([...ids,project.id])]);setProjects(current=>current.filter((_,i)=>i!==index));};
  const next=async()=>{
    /** @type {any[]} */
    let missing=validateFormValues(definition,context).filter(item=>item.sectionId===section.id);
    if(section.kind==='organization'&&!organization)missing.push({sectionId:section.id,message:'Select an organization'});
    if(section.kind==='organization'&&user?.role==='user'&&!nofo)missing.push({sectionId:section.id,message:'Select a NOFO'});
    if(section.kind==='budget'){
      if(!projects.length)missing.push({sectionId:section.id,message:'Add at least one Project.'});
      projects.forEach((project,index)=>{if(!project.title?.trim())missing.push({sectionId:section.id,message:`Project ${index+1} needs a title.`});if(!project.isExisting&&!/^\d{5}$/.test(project.project_zip||''))missing.push({sectionId:section.id,message:`Project ${index+1} needs a 5-digit ZIP.`});});
      missing=[...missing,...validateBudget(definition,allProjectBudgets(projects),form)];
    }
    setErrors(missing);if(missing.length)return;
    try {await saveDraft();setStepId(sections[Math.min(sections.indexOf(section)+1,sections.length-1)].id);}catch(err){setError(err.message);}
  };
  const submit=async()=>{
    setError('');setErrors([]);
    try {if(!confirmed)throw new Error('Confirm that the application information is accurate');
      const saved=await saveDraft();setBusy(true);
      const sent=await base44.entities.Application.update(saved.id,{status:'Submitted'});appRef.current=sent;setApplication(sent);
      setSubmitted(true);setConfirmed(false);
    }catch(err){setError(err.message);setErrors(err.data?.details||[]);}finally{setBusy(false);}
  };
  const save=async()=>{try{await saveDraft();}catch(err){setError(err.message);}};
  const upload=async(field,file)=>{
    if(!file)return;setBusy(true);setError('');
    try {const result=await base44.integrations.Core.UploadFile({file});setForm(current=>applyFieldValue(current,field,{url:result.file_url,file_name:file.name}));}
    catch(err){setError(err.message);}finally{setBusy(false);}
  };
  const items=allProjectBudgets(projects);
  return {user,organization,organizations,setOrganization,nofos,nofo,chooseNofo,application,form,definition,projects,changeProject,addProject,removeProject,items,sections,section,
    stepId,setStepId,loading,busy,error,errors,confirmed,setConfirmed,submitted,saveDraft,save,next,submit,upload,
    setField:(field,value)=>setForm(current=>applyFieldValue(current,field,value)),context,fields:reviewFields(definition,context),navigate};
}
