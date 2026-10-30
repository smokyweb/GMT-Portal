export function createGanSettingsClient(api) {
  const base='/api/gan/settings';
  return {
    directory:()=>api('GET',base+'/directory'),
    organization:id=>api('GET',base+'/organizations/'+encodeURIComponent(id)),
    saveOrganization:(id,input)=>api('PUT',base+'/organizations/'+encodeURIComponent(id),input),
    grantee:id=>api('GET',base+'/grantees/'+encodeURIComponent(id)),
    saveGrantee:(id,input)=>api('PUT',base+'/grantees/'+encodeURIComponent(id),input),
  };
}
