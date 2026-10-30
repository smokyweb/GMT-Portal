import {base44} from '@/api/base44Client';
export async function updateApplicationStatus(app,status,setApplications) {
    await base44.entities.Application.update(app.id, { status });
    setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status } : a));
    const emailMap = {
      Approved: {
        subject: `Application Approved – ${app.application_number}`,
        body: `Dear ${app.organization_name},\n\nYour grant application (${app.application_number}) has been APPROVED.\n\nPlease log in to the GMT Portal to view the details and next steps.\n\nGrant Management Team`,
      },
      Denied: {
        subject: `Application Not Approved – ${app.application_number}`,
        body: `Dear ${app.organization_name},\n\nYour grant application (${app.application_number}) has not been approved at this time.\n\nPlease log in to the GMT Portal for more information.\n\nGrant Management Team`,
      },
      RevisionRequested: {
        subject: `Revision Requested – ${app.application_number}`,
        body: `Dear ${app.organization_name},\n\nRevisions are required for your grant application (${app.application_number}).\n\nPlease log in to the GMT Portal to review the feedback and update your application.\n\nGrant Management Team`,
      },
    }
    if (emailMap[status] && app.submitted_by) {
      await base44.integrations.Core.SendEmail({ to: app.submitted_by, ...emailMap[status] });
    }
  };

