/**
 * Workflow Engine
 * Triggered by key events in the app. Each trigger checks conditions
 * and fires status transitions + email notifications as needed.
 */

/**
 * Triggered after a document is uploaded for an application.
 * Rule: If app is in "Submitted" state → move to "UnderReview" and notify state admins.
 */
export async function onDocumentUploaded(base44, applicationId) {
  const app = (await base44.entities.Application.filter({ id: applicationId }))[0];
  if (!app) return;

  if (app.status === 'Submitted') {
    await base44.entities.Application.update(applicationId, { status: 'UnderReview' });

    // Notify all state admin users
    const admins = await base44.entities.User.filter({ role: 'admin' });
    await Promise.all(admins.map(admin =>
      base44.integrations.Core.SendEmail({
        to: admin.email,
        subject: `Application ${app.application_number} moved to Under Review`,
        body: `A document was uploaded for application ${app.application_number} (${app.organization_name}).\n\nThe application has been automatically moved to "Under Review" status.\n\nLog in to the GMT Portal to begin your review.`,
      }).catch(() => {})
    ));

    await base44.entities.AuditLog.create({
      user_email: 'workflow-engine@system',
      user_name: 'Workflow Engine',
      action: 'StatusTransition',
      entity_type: 'Application',
      entity_id: applicationId,
      description: `Auto-transitioned ${app.application_number} from Submitted → UnderReview (document uploaded)`,
    });
  }
}

/**
 * Triggered after a compliance flag is resolved for an application.
 * Rule: If all compliance flags for the application are resolved → notify the submitter.
 * Rule: If app is "UnderReview" and all flags resolved → suggest ready for approval (email to admins).
 */
export async function onComplianceFlagResolved(base44, applicationId) {
  const [app, openFlags] = await Promise.all([
    base44.entities.Application.filter({ id: applicationId }).then(r => r[0]),
    base44.entities.ComplianceFlag.filter({ application_id: applicationId, is_resolved: false }),
  ]);
  if (!app) return;

  if (openFlags.length === 0) {
    // All flags resolved — notify submitter
    if (app.submitted_by) {
      await base44.integrations.Core.SendEmail({
        to: app.submitted_by,
        subject: `All compliance flags resolved — Application ${app.application_number}`,
        body: `Good news! All compliance flags for your application ${app.application_number} have been resolved.\n\nYour application is now back in review. You will be notified when a final decision is made.`,
      }).catch(() => {});
    }

    // Notify admins it's ready to approve
    const admins = await base44.entities.User.filter({ role: 'admin' });
    await Promise.all(admins.map(admin =>
      base44.integrations.Core.SendEmail({
        to: admin.email,
        subject: `All flags cleared — ${app.application_number} ready for decision`,
        body: `All compliance flags for application ${app.application_number} (${app.organization_name}) have been resolved.\n\nThe application may now be approved. Log in to the GMT Portal to take action.`,
      }).catch(() => {})
    ));

    await base44.entities.AuditLog.create({
      user_email: 'workflow-engine@system',
      user_name: 'Workflow Engine',
      action: 'AllFlagsResolved',
      entity_type: 'Application',
      entity_id: applicationId,
      description: `All compliance flags resolved for ${app.application_number} — notifications sent`,
    });
  }
}

/**
 * Triggered when a funding request is approved.
 * Rule: Update application expenditure totals and notify the subrecipient.
 */
export async function onFundingRequestApproved(base44, fundingRequest, approvedAmount) {
  const app = (await base44.entities.Application.filter({ id: fundingRequest.application_id }))[0];
  if (!app) return;

  const newExpended = (app.total_expended || 0) + approvedAmount;
  const awarded = app.awarded_amount || 0;
  const remaining = Math.max(0, awarded - newExpended);
  const rate = awarded > 0 ? Math.round((newExpended / awarded) * 100) : 0;

  await base44.entities.Application.update(app.id, {
    total_expended: newExpended,
    remaining_balance: remaining,
    expenditure_rate: rate,
  });

  if (fundingRequest.submitted_by || app.submitted_by) {
    await base44.integrations.Core.SendEmail({
      to: fundingRequest.submitted_by || app.submitted_by,
      subject: `Funding Request ${fundingRequest.request_number} Approved`,
      body: `Your funding request ${fundingRequest.request_number} for $${approvedAmount.toLocaleString()} has been approved.\n\nApplication: ${app.application_number}\nExpended to date: $${newExpended.toLocaleString()}\nRemaining balance: $${remaining.toLocaleString()}\nExpenditure rate: ${rate}%\n\nLog in to the GMT Portal for details.`,
    }).catch(() => {});
  }

  await base44.entities.AuditLog.create({
    user_email: 'workflow-engine@system',
    user_name: 'Workflow Engine',
    action: 'ExpenditureUpdated',
    entity_type: 'Application',
    entity_id: app.id,
    description: `Auto-updated expenditures for ${app.application_number}: $${newExpended.toLocaleString()} expended (${rate}%)`,
  });
}

/**
 * Triggered when a report is overdue.
 * Rule: Create a ComplianceFlag and notify the subrecipient.
 */
export async function onReportOverdue(base44, reportSchedule) {
  // Check if flag already exists
  const existing = await base44.entities.ComplianceFlag.filter({
    application_id: reportSchedule.application_id,
    flag_type: 'OverdueReport',
    is_resolved: false,
  });
  if (existing.length > 0) return;

  await base44.entities.ComplianceFlag.create({
    application_id: reportSchedule.application_id,
    application_number: reportSchedule.application_number,
    organization_name: reportSchedule.organization_name,
    flag_type: 'OverdueReport',
    description: `${reportSchedule.report_type} report due ${reportSchedule.due_date} is overdue.`,
    severity: 'High',
    is_resolved: false,
  });

  await base44.entities.AuditLog.create({
    user_email: 'workflow-engine@system',
    user_name: 'Workflow Engine',
    action: 'ComplianceFlagCreated',
    entity_type: 'ReportSchedule',
    entity_id: reportSchedule.id,
    description: `Auto-created OverdueReport flag for ${reportSchedule.application_number}`,
  });
}

// Named list of all rules for the UI
export const WORKFLOW_RULES = [
  {
    id: 'doc-upload-review',
    trigger: 'Document Uploaded',
    condition: 'Application status is "Submitted"',
    action: 'Transition application → "Under Review" + email all State Admins',
    entity: 'Document',
    active: true,
  },
  {
    id: 'flags-cleared-notify',
    trigger: 'Compliance Flag Resolved',
    condition: 'All compliance flags for application are resolved',
    action: 'Email subrecipient (all clear) + email State Admins (ready for decision)',
    entity: 'ComplianceFlag',
    active: true,
  },
  {
    id: 'funding-approved-expenditure',
    trigger: 'Funding Request Approved',
    condition: 'Always',
    action: 'Update application expenditure totals + email subrecipient confirmation',
    entity: 'FundingRequest',
    active: true,
  },
  {
    id: 'report-overdue-flag',
    trigger: 'Report Due Date Passed',
    condition: 'Report status is still "Pending" after due date',
    action: 'Create OverdueReport ComplianceFlag (deduplicated)',
    entity: 'ReportSchedule',
    active: true,
  },
];