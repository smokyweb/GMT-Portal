export const GRANTEE_CONTACT_INPUTS=[
  {key:'agency_name',label:'Pass-through agency name'}, {key:'contact_name',label:'Awarding contact name'},
  {key:'contact_title',label:'Awarding contact title'}, {key:'contact_email',label:'Awarding contact email',type:'email'},
  {key:'contact_phone',label:'Awarding contact phone',type:'tel'},
];
export function settingsForm(context) {return Object.fromEntries(Object.entries(context.settings).map(([key,value])=>[key,value??'']));}
export function chooseGanApprover(form,choices,id) {
  const person=choices.find(choice=>choice.id===id);
  return {...form,approving_official_id:id,approving_official_name:person?.full_name||form.approving_official_name,
    approving_official_title:person?.title||form.approving_official_title};
}
export function defaultGanOrganizationChoices(data) {
  const officials=Object.fromEntries(data.organizations.filter(org=>org.authorized_official_id&&data.officials.some(user=>user.id===org.authorized_official_id&&user.organization_id===org.id)).map(org=>[org.id,org.authorized_official_id]));
  const agencies=[...new Set(data.organizations.map(org=>org.grantee_id).filter(Boolean))];
  const common=agencies.length===1&&data.organizations.every(org=>org.grantee_id===agencies[0])&&data.grantees.some(grantee=>grantee.id===agencies[0])?agencies[0]:'';
  return {officialsByOrganization:officials,granteeId:common};
}

export function presentGanSettings(context) {
  return {...context,choices:Object.fromEntries(Object.entries(context.choices).map(([key,values])=>[key,values.map(item=>({...item,name:item.full_name||item.name||item.email}))]))};
}
