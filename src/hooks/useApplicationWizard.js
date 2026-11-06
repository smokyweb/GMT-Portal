import {legacyForm} from '@/lib/forms/legacyForm';
import {useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {base44} from '@/api/base44Client';
import {defaultForm} from '@/lib/forms/defaultForm';
import {validateFormValues,validateBudget} from '@/lib/forms/valueValidation';
import {draftForm,persistDraft,applyFieldValue,budgetTotals,allProjectBudgets,reviewFields} from '@/lib/forms/applicationDraft';
import {normalizeProjectFieldConfig,FEMA_CORE_CAPABILITIES} from '@/lib/projects/projectFieldConfig';
function contactValues(user={}) {
  const parts=String(user.full_name||'').trim().split(/\s+/).filter(Boolean);
  return {poc_user_id:user.id||'',poc_first_name:user.first_name||parts.shift()||'',poc_last_name:user.last_name||parts.join(' '),poc_title:user.title||'',poc_email:user.email||'',poc_phone:user.phone||''};
}
export function useApplicationWizard() {
  const navigate=useNavigate(),savePromise=useRef(null),appRef=useRef(null);
  const [user,setUser]=useState(null),[organization,setOrganization]=useState(null),[organizations,setOrganizations]=useState([]),[organizationUsers,setOrganizationUsers]=useState([]),[nofos,setNofos]=useState([]);
  const [nofo,setNofo]=useState(null),[application,setApplication]=useState(null),[definition,setDefinition]=useState(defaultForm()),[form,setForm]=useState(draftForm()),[projectConfig,setProjectConfig]=useState(normalizeProjectFieldConfig(null,null));
  const [projects,setProjects]=useState([]),[removedProjectIds,setRemovedProjectIds]=useState([]),[documents,setDocuments]=useState([]),[stepId,setStepId]=useState('organization');
  const refreshDocuments=async()=>{if(!application?.id){setDocuments([]);return [];}const rows=await base44.entities.Document.filter({application_id:application.id},'-created_date',500);setDocuments(rows||[]);return rows||[];};
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[errors,setErrors]=useState([]),[confirmed,setConfirmed]=useState(false),[submitted,setSubmitted]=useState(false);
  useEffect(()=>{
    let active=true;
    (async()=>{try{
      const params=new URLSearchParams(window.location.search),id=params.get('id'),nofoId=params.get('nofo');
      const actor=await base44.auth.me();
      const [orgs,notices,programs,coreSettings]=await Promise.all([base44.entities.Organization.list('-name',500),base44.entities.Nofo.list('-created_date',500),base44.entities.GrantProgram.list('-name',500),base44.entities.AppSettings.filter({key:'project_ij_core_capabilities'}).catch(()=>[])]);
      let existing=null;if(id)existing=(await base44.entities.Application.filter({id})).find(item=>item.id===id);
      if(id&&!existing)throw new Error('Application not found');
      const selectedOrg=orgs.find(org=>org.id===(existing?.organization_id||actor.organization_id));
      const selectedNofo=notices.find(notice=>notice.id===(existing?.nofo_id||nofoId))||null;
      const selectedProgram=programs.find(program=>program.id===selectedNofo?.program_id);
      let coreCapabilities=FEMA_CORE_CAPABILITIES;try{const raw=coreSettings?.[0]?.value;const parsed=typeof raw==='string'?JSON.parse(raw):raw;if(Array.isArray(parsed)&&parsed.length)coreCapabilities=parsed;}catch{}
      let version;if(existing)version=(await base44.forms.application(existing.id,'edit')).version;
      else if(selectedNofo)version=await base44.forms.nofo(selectedNofo.id);
      const [budgets,loadedProjects]=existing?await Promise.all([base44.entities.ApplicationBudget.filter({application_id:existing.id}),base44.entities.Project.filter({application_id:existing.id})]):[[],[]];
      if(!active)return;
      const availableOrganizations=orgs.filter(org=>org.is_active!==false&&(actor.role==='user'?org.id===actor.organization_id:actor.role==='isc_admin'||org.state===(actor.scope_state||actor.grantee_state)));
      const initialOrganization=selectedOrg||(!existing&&availableOrganizations.length===1?availableOrganizations[0]:null);
      setUser(actor);setOrganizations(availableOrganizations);
      setNofos(notices.filter(notice=>notice.id===selectedNofo?.id||['Published','Active'].includes(notice.status)));
      const selectedUsers=initialOrganization?.id?await base44.entities.User.filter({organization_id:initialOrganization.id},'-full_name',500):[];
      const eligibleUsers=(selectedUsers||[]).filter(item=>!['inactive','deactivated'].includes(item.active_status||'active'));
      const initialForm=draftForm(existing||{});
      if(existing?.poc_user_id){const savedContact=eligibleUsers.find(item=>String(item.id)===String(existing.poc_user_id));if(savedContact)Object.assign(initialForm,contactValues(savedContact));}else{const defaultContact=eligibleUsers.find(item=>String(item.id)===String(initialOrganization?.primary_contact_user_id))||(eligibleUsers.length===1?eligibleUsers[0]:null);if(defaultContact)Object.assign(initialForm,contactValues(defaultContact));}
      setOrganization(initialOrganization);setOrganizationUsers(eligibleUsers);setNofo(selectedNofo);setDefinition(version?.definition||(existing?legacyForm(selectedNofo||{program_code:existing.program_code}):defaultForm(selectedNofo||{})));
      setProjectConfig(normalizeProjectFieldConfig(selectedProgram||{code:selectedNofo?.program_code},selectedNofo,coreCapabilities));
      const initialProjects=(loadedProjects||[]).map(project=>({...project,isExisting:true,budgets:(budgets||[]).filter(item=>item.project_id===project.id||(!item.project_id&&project===loadedProjects[0])).map(item=>({...item,isExisting:true}))}));
      if(!initialProjects.length&&!existing)initialProjects.push({title:'',project_type:'Other',funding_type:'Pass-Through',is_active:true,budgets:[]});
      appRef.current=existing;setApplication(existing);setSubmitted(Boolean(existing&&!['Draft','RevisionRequested','ChangesRequested'].includes(existing.status)));setForm(initialForm);setProjects(initialProjects);
    }catch(err){if(active)setError(err.message);}finally{if(active)setLoading(false);}})();return()=>{active=false;};
  },[]);
  useEffect(()=>{let active=true;if(application?.id)base44.entities.Document.filter({application_id:application.id},'-created_date',500).then(rows=>{if(active)setDocuments(rows||[]);});else setDocuments([]);return()=>{active=false;};},[application?.id]);
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
  const chooseOrganization=async nextOrganization=>{
    if(submitted)return;
    setOrganization(nextOrganization||null);setOrganizationUsers([]);
    setForm(current=>({...current,poc_user_id:'',poc_first_name:'',poc_last_name:'',poc_title:'',poc_email:'',poc_phone:''}));
    if(nextOrganization?.id){const users=(await base44.entities.User.filter({organization_id:nextOrganization.id},'-full_name',500)).filter(item=>!['inactive','deactivated'].includes(item.active_status||'active'));setOrganizationUsers(users);const defaultContact=users.find(item=>String(item.id)===String(nextOrganization.primary_contact_user_id))||(users.length===1?users[0]:null);if(defaultContact)setForm(current=>({...current,...contactValues(defaultContact)}));}
  };
  const choosePoc=selectedId=>{
    const selected=organizationUsers.find(item=>String(item.id)===String(selectedId));
    setForm(current=>({...current,...(selected?contactValues(selected):{poc_user_id:'',poc_first_name:'',poc_last_name:'',poc_title:'',poc_email:'',poc_phone:''})}));
  };
  const updatePoc=async changes=>{if(!form.poc_user_id)return null;setBusy(true);setError('');try{const updated=await base44.accounts.update(form.poc_user_id,changes);setOrganizationUsers(current=>current.map(item=>item.id===updated.id?updated:item));setForm(current=>({...current,...contactValues(updated)}));return updated;}catch(err){setError(err.message);throw err;}finally{setBusy(false);}};
  const addPoc=async input=>{if(!organization)return null;setBusy(true);setError('');try{const result=await base44.accounts.invite({...input,role:'user',organization_id:organization.id});const created=result.user;setOrganizationUsers(current=>[...current,created]);setForm(current=>({...current,...contactValues(created)}));return created;}catch(err){setError(err.message);throw err;}finally{setBusy(false);}};
  const updateOrganization=async changes=>{if(!organization)return null;setBusy(true);setError('');try{const updated=await base44.entities.Organization.update(organization.id,changes);setOrganization(current=>({...current,...updated}));return updated;}catch(err){setError(err.message);throw err;}finally{setBusy(false);}};
  const chooseNofo=async id=>{
    if(application&&!['Draft','RevisionRequested','ChangesRequested'].includes(application.status))return;
    setBusy(true);setError('');
    try {const selected=nofos.find(notice=>notice.id===id)||null;const program=selected?(await base44.entities.GrantProgram.filter({id:selected.program_id}))[0]:null;setNofo(selected);setProjectConfig(normalizeProjectFieldConfig(program||{code:selected?.program_code},selected));setForm(current=>({...current,form_values:{}}));setDefinition(selected?(await base44.forms.nofo(id)).definition:defaultForm());setStepId('organization');}
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
  return {user,organization,organizations,setOrganization,chooseOrganization,organizationUsers,choosePoc,updateOrganization,updatePoc,addPoc,nofos,nofo,chooseNofo,application,form,definition,projects,projectConfig,changeProject,addProject,removeProject,documents,refreshDocuments,items,sections,section,
    stepId,setStepId,loading,busy,error,errors,confirmed,setConfirmed,submitted,saveDraft,save,next,submit,upload,
    setField:(field,value)=>setForm(current=>applyFieldValue(current,field,value)),context,fields:reviewFields(definition,context),navigate};
}
