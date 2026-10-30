export function createEhpClient(api) {
  return {
    application:id=>api('GET','/api/ehp/applications/'+encodeURIComponent(id)),
    classify:(id,lineId,affected,expectedRevision)=>api('PUT','/api/ehp/applications/'+encodeURIComponent(id)+'/budgets/'+encodeURIComponent(lineId),{affected,expectedRevision}),
    decide:(id,input)=>api('PUT','/api/ehp/applications/'+encodeURIComponent(id)+'/decision',input),
    submitFunding:input=>api('POST','/api/funding-requests/submit',input),
  };
}
