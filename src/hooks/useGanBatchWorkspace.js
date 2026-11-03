import {defaultGanOrganizationChoices} from '@/lib/documents/ganSettingsPresentation';
import {useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {ganBatchRows,newGanBatchSelection,ganBatchPayload,presentGanCatalog,sharedGanIssues} from '@/lib/documents/ganBatchPresentation';
export function useGanBatchWorkspace(initialTemplateId='') {
  const [packageTarget,setPackageTarget]=useState(null);
  const [catalog,setCatalog]=useState({nofos:[],templates:[],grantees:[],applications:[],organizations:[],officials:[],batches:[]});
  const [selection,setSelection]=useState(newGanBatchSelection),[selectedIds,setSelectedIds]=useState([]),[checks,setChecks]=useState({});
  const [batch,setBatch]=useState(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const actor=useRef(''),stop=useRef(false),generation=useRef(null),retry=useRef(null),requestVersion=useRef(0);
  const remember=(id,pass)=>sessionStorage.setItem('gmt-gan-batch-'+actor.current,JSON.stringify({id,pass}));
  const restore=async(id,pass=null)=>{
    setPackageTarget(null);
    const saved=await base44.gan.batch(id),data=await base44.gan.options(saved.nofoId);
    setCatalog(presentGanCatalog(data));setBatch(saved);setSelection({...saved.selection,nofoId:saved.nofoId});setSelectedIds(saved.rows.map(row=>row.applicationId));setChecks({});
    generation.current=null;retry.current=pass;remember(id,pass);return saved;
  };
  useEffect(()=>{let active=true;setBusy('Loading award documents…');
    (async()=>{try{
      const user=await base44.auth.me();actor.current=user.id;
      const data=await base44.gan.options();if(!active)return;setCatalog(presentGanCatalog(data));
      if(initialTemplateId&&data.templates.some(item=>item.id===initialTemplateId))setSelection(current=>({...current,templateId:initialTemplateId}));
      let stored;try{stored=JSON.parse(sessionStorage.getItem('gmt-gan-batch-'+user.id)||'null');}catch{stored=null;}
      if(stored?.id)await restore(stored.id,stored.pass);
    }catch(err){if(active)setError(err.message);}finally{if(active)setBusy('');}})();
    return()=>{active=false;stop.current=true;requestVersion.current++;};
  },[]);
  const chooseNofo=async id=>{
    setPackageTarget(null);const version=++requestVersion.current;setError('');setNotice('');setBusy('Loading applications…');setBatch(null);setChecks({});generation.current=null;retry.current=null;
    setSelection(current=>({...current,nofoId:id,officialsByOrganization:{}}));setSelectedIds([]);
    try{const data=await base44.gan.options(id);if(version!==requestVersion.current)return;setCatalog(presentGanCatalog(data));setSelectedIds(data.applications.map(row=>row.applicationId));setSelection(current=>({...current,...defaultGanOrganizationChoices(data),nofoId:id}));}
    catch(err){if(version===requestVersion.current)setError(err.message);}finally{if(version===requestVersion.current)setBusy('');}
  };
  const change=(key,value)=>{setSelection(current=>({...current,[key]:value}));setChecks({});generation.current=null;setError('');setNotice('');};
  const official=(orgId,id)=>change('officialsByOrganization',{...selection.officialsByOrganization,[orgId]:id||null});
  const toggle=id=>{setSelectedIds(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);generation.current=null;};
  const toggleAll=()=>{setSelectedIds(current=>current.length===catalog.applications.length?[]:catalog.applications.map(row=>row.applicationId));generation.current=null;};
  const check=async()=>{
    setError('');setBusy('Checking readiness…');setNotice('');stop.current=false;
    try{for(let i=0;i<selectedIds.length&&!stop.current;i+=20){
      setBusy('Checking readiness '+Math.min(i+20,selectedIds.length)+' of '+selectedIds.length+'…');
      const result=await base44.gan.check(ganBatchPayload(selection,selectedIds.slice(i,i+20),crypto.randomUUID()));
      setChecks(current=>({...current,...Object.fromEntries(result.rows.map(row=>[row.applicationId,row]))}));
    }}catch(err){setError(err.message);}finally{setBusy('');}
  };
  const execute=async(id,pass=null)=>{
    let remaining=1;stop.current=false;retry.current=pass;remember(id,pass);
    while(remaining&&!stop.current){
      const result=await base44.gan.run(id,{limit:10,...(pass?{retryBlocked:true,retryRequestId:pass}:{})});
      setBatch(result);setCatalog(current=>presentGanCatalog({...current,batches:current.batches.map(item=>item.id===result.id?{...item,generated:result.counts.generated}:item)}));remaining=result.run.remaining;setBusy('Processing drafts: '+result.counts.generated+' saved, '+result.counts.blocked+' blocked…');
    }
    if(!remaining){retry.current=null;remember(id,null);setNotice('Draft processing finished. Review saved PDFs and any blocked rows.');}
    else setNotice('Processing stopped after the current group. Resume this batch to continue.');
  };
  const generate=async()=>{
    setBusy('Creating batch…');setError('');setNotice('');stop.current=false;
    try{
      if(!generation.current)generation.current=ganBatchPayload(selection,selectedIds,crypto.randomUUID());
      const created=await base44.gan.create(generation.current);await restore(created.id);
      if(stop.current)setNotice('Batch planned. Resume this batch to generate its drafts.');else await execute(created.id);
    }catch(err){setError(err.message);}finally{setBusy('');}
  };
  const resume=async(retryBlocked=false)=>{
    setBusy('Resuming batch…');setError('');setNotice('');
    try{await execute(batch.id,retryBlocked?(retry.current||crypto.randomUUID()):retry.current);}catch(err){setError(err.message);}finally{setBusy('');}
  };
  const load=async id=>{if(!id)return;setBusy('Loading saved batch…');setError('');try{await restore(id);}catch(err){setError(err.message);}finally{setBusy('');}};
  const fresh=async()=>{stop.current=true;setBatch(null);setChecks({});setNotice('');setError('');generation.current=null;retry.current=null;sessionStorage.removeItem('gmt-gan-batch-'+actor.current);await chooseNofo(selection.nofoId);};
  const download=async document=>{setError('');try{await base44.gan.download(document.id,document.revision);}catch(err){setError(err.message);}};
  const rows=ganBatchRows(batch?.rows||catalog.applications,checks,selectedIds),canRun=Boolean(selection.nofoId&&selection.templateId&&selectedIds.length);
  return {packageTarget,showPackage:setPackageTarget,closePackage:()=>setPackageTarget(null),catalog,selection,rows,sharedIssues:sharedGanIssues(rows),batch,busy,error,notice,selectedIds,allSelected:rows.length>0&&selectedIds.length===rows.length,canRun,canStop:/^(Checking|Creating|Processing|Resuming)/.test(busy),
    chooseNofo,change,official,toggle,toggleAll,check,generate,resume,load,fresh,download,stop:()=>{stop.current=true;}};
}
