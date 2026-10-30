export default function AwardOfficialSummary({official,canManage=false,isViewer=false}) {
  if(!official)return null;
  return <div className="rounded-md border bg-muted/20 p-3 text-sm">
    <p className="font-medium">{official.full_name||official.email}</p><p>{official.title||'Job title missing'}</p>
    <p className="text-muted-foreground">{official.email} · {official.phone||'Phone missing'}</p>
    {canManage?<a href="/admin" className="mt-2 inline-block text-xs text-blue-700 underline">Update the registered user’s title or phone in User Management</a>:
      isViewer?<a href="/profile" className="mt-2 inline-block text-xs text-blue-700 underline">Update my contact details</a>:<p className="mt-2 text-xs text-muted-foreground">Ask your administrator to update this contact if needed.</p>}
  </div>;
}
