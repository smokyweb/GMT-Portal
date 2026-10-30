export function ganSnapshotPreview(snapshot) {
  return {ready:true,issues:[],body:snapshot.merged_body,values:snapshot.values,projects:snapshot.projects,requiresProjectSchedule:snapshot.projects.length>4};
}
