export default function GanWorkflowIdentifiers({values={organization_name:'',application_number:'',subaward_number:''},projects=[]}) {
  return <div className="space-y-1 break-words text-sm text-muted-foreground">
    <p>{values.organization_name} · {values.application_number} · Subaward {values.subaward_number||'—'}</p>
    <p>Projects: {projects.map(project=>project.project_id).join(', ')||'—'}</p>
  </div>;
}
