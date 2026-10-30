export function createNofoFormsClient(request) {
  return {
    program:(id,scopeState)=>request('GET','/api/forms/programs/'+id+(scopeState!==undefined?'?scope_state='+encodeURIComponent(scopeState):'')),
    saveProgram:(id,version,definition)=>request('PUT','/api/forms/programs/'+id,{scope_state:version.scope_state,expectedVersionId:version.id,expectedRevision:version.revision,expectedInheritedVersionId:version.inherited_from_version_id,definition}),
    nofoDefaults:id=>request('GET','/api/forms/nofos/'+id+'/program-defaults'),
    nofo:id=>request('GET','/api/forms/nofos/'+id),
    saveNofo:(id,version,definition,appliedProgramDefaultId=undefined)=>request('PUT','/api/forms/nofos/'+id,{expectedVersionId:version.id,expectedRevision:version.revision,expectedProgramDefaultId:version.program_default_version_id,appliedProgramDefaultId,definition}),
    application:(id,audience='edit')=>request('GET','/api/forms/applications/'+id+'?audience='+audience),
  };
}
