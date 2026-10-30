import {formFields} from './defaultForm.js';
export const formId=prefix=>prefix+'_'+crypto.randomUUID().replaceAll('-','').slice(0,12);
export function moveItem(items,index,direction) {
  const target=index+direction;if(target<0||target>=items.length)return items;
  const next=[...items];[next[index],next[target]]=[next[target],next[index]];return next;
}
export function updateSection(definition,id,changes) {
  return {...definition,sections:definition.sections.map(section=>section.id===id?{...section,...changes}:section)};
}
export function updateField(definition,sectionId,id,changes) {
  const section=definition.sections.find(item=>item.id===sectionId);
  return updateSection(definition,sectionId,{fields:section.fields.map(field=>field.id===id?{...field,...changes}:field)});
}
export function newCustomField(type='text') {
  const id=formId('cf');
  return {id,key:id,label:'New field',type,source:'custom',required:false,visible:true,reviewerVisible:true,exportVisible:true,
    ...(['dropdown','yesno','multiselect'].includes(type)?{options:type==='yesno'?['yes','no','unknown']:['Option 1']}:{}),
    ...(type==='table'?{columns:[{id:'name',label:'Name',type:'text',required:true}]}:{}),
  };
}
export function importSection(definition,source,targetId) {
  const target=definition.sections.find(section=>section.id===targetId);
  if(!source||!target||source.kind!==target.kind)throw new Error('Copy a section of the same kind into this section');
  const clone=JSON.parse(JSON.stringify(source)),outside=formFields(definition).filter(field=>field.sectionId!==targetId);
  const outsideIds=new Set(outside.map(field=>field.id)),targetStandards=new Set(target.fields.filter(field=>field.source!=='custom').map(field=>field.id));
  const remap=new Map();
  clone.fields=clone.fields.map(field=>{
    if(field.source!=='custom'&&!targetStandards.has(field.id)||outsideIds.has(field.id)) {
      const original=field.id,id=formId('cf');remap.set(original,id);
      return {...field,id,key:id,source:'custom',copied_from_field_id:original};
    }
    return field;
  });
  const importedIds=new Set(clone.fields.map(field=>field.id));
  clone.fields.push(...target.fields.filter(field=>field.source!=='custom'&&!importedIds.has(field.id)).map(field=>({...field,visible:false})));
  const allIds=new Set([...outsideIds,...clone.fields.map(field=>field.id)]);
  clone.fields=clone.fields.map(field=>{
    if(!field.condition)return field;
    const original=field.condition.fieldId,parent=remap.get(original)||
      outside.find(item=>item.copied_from_field_id===original)?.id||original;
    if(!allIds.has(parent))throw new Error('This section depends on a field in another section. Copy that section first or remove the condition.');
    return {...field,condition:{...field.condition,fieldId:parent}};
  });
  if(outside.some(field=>field.condition&&!allIds.has(field.condition.fieldId)))throw new Error('Remove conditions that refer to replaced custom fields before copying this section.');
  return updateSection(definition,targetId,{...clone,id:targetId});
}
