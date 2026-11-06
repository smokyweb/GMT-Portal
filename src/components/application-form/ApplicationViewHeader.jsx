import ApplicationPdfExport from '@/components/ApplicationPdfExport';
import LifecycleProgress from '@/components/LifecycleProgress';

export default function ApplicationViewHeader({application, budgets=[]}) {
  return <>
    <div className="flex items-center justify-between gap-3 pr-8">
      <div>
        <h2 className="text-lg font-semibold">Application {application?.application_number || 'Draft'}</h2>
        <p className="text-xs text-muted-foreground">Submitted application view</p>
      </div>
      <ApplicationPdfExport app={application} budgets={budgets}/>
    </div>
    <div className="bg-muted/40 rounded-xl p-4">
      <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">Application Progress</p>
      <LifecycleProgress status={application?.status} type="application" />
    </div>
  </>;
}
