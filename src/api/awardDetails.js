export function createAwardDetailsClient(api) {
  return {
    application:id=>api('GET','/api/awards/applications/'+encodeURIComponent(id)),
    save:(id,expectedRevision,fields,resetFields=[])=>api('PUT','/api/awards/applications/'+encodeURIComponent(id),{expectedRevision,fields,resetFields}),
  };
}
