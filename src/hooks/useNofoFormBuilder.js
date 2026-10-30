import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import {formFields} from '@/lib/forms/defaultForm';
import {formId,moveItem,updateSection,updateField,newCustomField,importSection} from '@/lib/forms/formEditing';
export function useNofoFormBuilder(target,mode='nofo',scopeState='') {
  const programCode=target.program_code||target.code||'';
  const [version,setVersion]=useState(null),[definition,setDefinition]=useState(null),[selected,setSelected]=useState('organization'),[fieldId,setFieldId]=useState('');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [appliedDefaults,setAppliedDefaults]=useState(undefined);
  const [sources,setSources]=useState([]),[source,setSource]=useState(null),[dirty,setDirty]=useState(false);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');setSource(null);setDirty(false);setDefinition(null);setVersion(null);setAppliedDefaults(undefined);setSelected('organization');setFieldId('');
    (async()=>{try{
      const [current,list]=await Promise.all([mode==='program'?base44.forms.program(target.id,scopeState):base44.forms.nofo(target.id),base44.entities.Nofo.list('-created_date',500)]);
      if(!active)return;setVersion(current);setDefinition(current.definition);setSources(list.filter(item=>(mode==='program'||item.id!==target.id)&&(current.actor_role==='isc_admin'||!(item.scope_states||[]).length||(item.scope_states||[]).some(code=>String(code).toUpperCase()===current.actor_state))));
    }catch(err){if(active)setError(err.message);}finally{if(active)setLoading(false);}})();
    return()=>{active=false;};
  },[target.id,programCode,mode,scopeState]);
  const change=next=>{setDefinition(next);setDirty(true);setNotice('');setError('');};
  const section=definition?.sections.find(item=>item.id===selected)||definition?.sections[0];
  const field=section?.fields.find(item=>item.id===fieldId);
  const chooseSection=id=>{setSelected(id);setFieldId('');};
  const setSection=changes=>change(updateSection(definition,section.id,changes));
  const setField=changes=>change(updateField(definition,section.id,field.id,changes));
  const moveSection=(index,direction)=>change({...definition,sections:moveItem(definition.sections,index,direction)});
  const moveField=(index,direction)=>setSection({fields:moveItem(section.fields,index,direction)});
  const addSection=()=>{const id=formId('section');change({...definition,sections:[...definition.sections.slice(0,-1),{id,label:'New section',kind:'custom',enabled:true,fields:[]},definition.sections.at(-1)]});chooseSection(id);};
  const addField=()=>{const value=newCustomField();setSection({fields:[...section.fields,value]});setFieldId(value.id);};
  const deleteField=targetField=>{
    if(formFields(definition).some(item=>item.condition?.fieldId===targetField.id)){setError('Remove conditions that refer to this field before deleting it.');return;}
    setSection({fields:section.fields.filter(item=>item.id!==targetField.id)});setFieldId('');
  };
  const loadSource=async id=>{setError('');setSource(null);try{setSource({...await base44.forms.nofo(id),program_code:sources.find(item=>item.id===id)?.program_code||''});}catch(err){setError(err.message);}};
  const loadProgramDefaults=async()=>{setBusy(true);setError('');try{const defaults=await base44.forms.nofoDefaults(target.id);change(defaults.definition);setAppliedDefaults(defaults.program_default_version_id||null);chooseSection(defaults.definition.sections[0].id);}catch(err){setError(err.message);}finally{setBusy(false);}};
  const canCopyForm=Boolean(source&&source.program_code===programCode);
  const copyForm=()=>{if(canCopyForm){setAppliedDefaults(undefined);change(structuredClone(source.definition));chooseSection(source.definition.sections[0].id);}};
  const copySection=id=>{try{change(importSection(definition,source.definition.sections.find(item=>item.id===id),section.id));setFieldId('');}catch(err){setError(err.message);}};
  const save=async()=>{
    setBusy(true);setError('');setNotice('');
    try {const saved=mode==='program'?await base44.forms.saveProgram(target.id,version,definition):await base44.forms.saveNofo(target.id,version,definition,appliedDefaults);
      setVersion(saved);setDefinition(saved.definition);setDirty(false);setAppliedDefaults(undefined);setNotice((mode==='program'?'Program defaults':'Application form')+' saved as version '+saved.version+'. Existing applications keep their original version.');}
    catch(err){setError(err.message);}finally{setBusy(false);}
  };
  return {version,definition,section,field,fieldId,setFieldId,loading,busy,error,notice,dirty,sources,source,canCopyForm,loadProgramDefaults,canLoadProgramDefaults:mode==='nofo',canEdit:version?.can_edit!==false,programCode,change,chooseSection,setSection,setField,moveSection,moveField,addSection,addField,deleteField,loadSource,copyForm,copySection,save};
}
