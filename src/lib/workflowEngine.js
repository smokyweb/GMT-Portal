/**
 * Workflow Engine
 * Triggered by key events in the app. Each trigger checks conditions
 * and fires status transitions + email notifications as needed.
 */

// Load admin overrides for built-in rules from AppSettings
async function getBuiltinOverrides(base44) {
  try {
    const settings = await base44.entities.AppSettings.filter({ key: 'builtin_rule_overrides' });
    return settings[0]?.value || {};
  } catch {
    return {};
  }
}

function isRuleActive(overrides, ruleId) {
  return overrides[ruleId]?.is_active !== false;
}

function getEmailOverride(overrides, ruleId) {
  const o = overrides[ruleId] || {};
  return { subject: o.email_subject || null, body: o.email_body || null };
}

export async function onDocumentUploaded(base44, applicationId) {
  const overrides = await getBuiltinOverrides(base44);
  if (!isRuleActive(overrides, 'doc-upload-review')) return;

  const app = (await base44.entities.Application.filter({ id: applicationId }))[0];
  if (!app) return;

  if (app.status === 'Submitted') {
    await base44.entities.Application.update(applicationId, { status: 'UnderReview' });
    const admins = await base44.entities.User.filter({ role: 'admin' });
    const emailOvr = getEmailOverride(overrides, 'doc-upload-review');
    await Promise.all(admins.map(admin =>
      base44.integrations.Core.SendEmail({
        to: admin.email,
        subject: emailOvr.subject || `Application ${app.application_number} moved to Under Review`,
        body: emailOvr.body || `A document was uploaded for application ${app.application_number} (${app.organization_name}).\n\nThe application has been automatically moved to "Under Review" status.\n\nLog in to the GMT Portal to begin your review.`,
      }).catch(() => {})
    ));
    await base44.entities.AuditLog.create({
      user_email: 'workflow-engine@system', user_name: 'Workflow Engine',
      action: 'StatusTransition', entity_type: 'Application', entity_id: applicationId,
      description: `Auto-transitioned ${app.application_number} from Submitted → UnderReview (document uploaded)`,
    });
  }
}

export async function onComplianceFlagResolved(base44, applicationId) {
  const overrides = await getBuiltinOverrides(base44);
  if (!isRuleActive(overrides, 'flags-cleared-notify')) return;
  const emailOvr = getEmailOverride(overrides, 'flags-cleared-notify');

  const [app, openFlags] = await Promise.all([
    base44.entities.Application.filter({ id: applicationId }).then(r => r[0]),
    base44.entities.ComplianceFlag.filter({ application_id: applicationId, is_resolved: false }),
  ]);
  if (!app) return;

  if (openFlags.length === 0) {
    if (app.submitted_by) {
      await base44.integrations.Core.SendEmail({
        to: app.submitted_by,
        subject: emailOvr.subject || `All compliance flags resolved - Application ${app.application_number}`,
        body: emailOvr.body || `Good news! All compliance flags for your application ${app.application_number} have been resolved.\n\nYour application is now back in review. You will be notified when a final decision is made.`,
      }).catch(() => {});
    }
    const admins = await base44.entities.User.filter({ role: 'admin' });
    await Promise.all(admins.map(admin =>
      base44.integrations.Core.SendEmail({
        to: admin.email,
        subject: emailOvr.subject || `All flags cleared - ${app.application_number} ready for decision`,
        body: emailOvr.body || `All compliance flags for application ${app.application_number} (${app.organization_name}) have been resolved.\n\nThe application may now be approved. Log in to the GMT Portal to take action.`,
      }).catch(() => {})
    ));
    await base44.entities.AuditLog.create({
      user_email: 'workflow-engine@system', user_name: 'Workflow Engine',
      action: 'AllFlagsResolved', entity_type: 'Application', entity_id: applicationId,
      description: `All compliance flags resolved for ${app.application_number} - notifications sent`,
    });
  }
}

export async function onFundingRequestApproved(base44, fundingRequest, approvedAmount) {
  const overrides = await getBuiltinOverrides(base44);
  const emailOvr = getEmailOverride(overrides, 'funding-approved-expenditure');
  const app = (await base44.entities.Application.filter({ id: fundingRequest.application_id }))[0];
  if (!app) return;

  const newExpended = (Number(app.total_expended) || 0) + approvedAmount;
  const awarded = app.awarded_amount || 0;
  const remaining = Math.max(0, awarded - newExpended);
  const rate = awarded > 0 ? Math.round((newExpended / awarded) * 100) : 0;

  await base44.entities.Application.update(app.id, {
    total_expended: newExpended, remaining_balance: remaining, expenditure_rate: rate,
  });

  if (isRuleActive(overrides, 'funding-approved-expenditure') && (fundingRequest.submitted_by || app.submitted_by)) {
    await base44.integrations.Core.SendEmail({
      to: fundingRequest.submitted_by || app.submitted_by,
      subject: emailOvr.subject || `Funding Request ${fundingRequest.request_number} Approved`,
      body: emailOvr.body || `Your funding request ${fundingRequest.request_number} for $${approvedAmount.toLocaleString()} has been approved.\n\nApplication: ${app.application_number}\nExpended to date: $${newExpended.toLocaleString()}\nRemaining balance: $${remaining.toLocaleString()}\nExpenditure rate: ${rate}%\n\nLog in to the GMT Portal for details.`,
    }).catch(() => {});
  }

  // Check expenditure threshold - warn admins if rate > 80%
  if (rate > 80) {
    const admins = await base44.entities.User.filter({ role: 'admin' });
    await Promise.all(admins.map(admin =>
      base44.integrations.Core.SendEmail({
        to: admin.email,
        subject: `⚠️ High Expenditure Rate - ${app.application_number} at ${rate}%`,
        body: `Application ${app.application_number} (${app.organization_name}) has reached an expenditure rate of ${rate}%.\n\nRemaining balance: $${remaining.toLocaleString()}\n\nPlease review to ensure closeout planning is underway.`,
      }).catch(() => {})
    ));
  }

  await base44.entities.AuditLog.create({
    user_email: 'workflow-engine@system', user_name: 'Workflow Engine',
    action: 'ExpenditureUpdated', entity_type: 'Application', entity_id: app.id,
    description: `Auto-updated expenditures for ${app.application_number}: $${newExpended.toLocaleString()} expended (${rate}%)`,
  });
}

export async function onFundingRequestDenied(base44, fundingRequest, reason) {
  if (fundingRequest.submitted_by) {
    await base44.integrations.Core.SendEmail({
      to: fundingRequest.submitted_by,
      subject: `Funding Request ${fundingRequest.request_number} Denied`,
      body: `Your funding request ${fundingRequest.request_number} has been denied.\n\nReason: ${reason || 'No reason provided.'}\n\nPlease log in to the GMT Portal to review the feedback and resubmit if applicable.`,
    }).catch(() => {});
  }
  await base44.entities.AuditLog.create({
    user_email: 'workflow-engine@system', user_name: 'Workflow Engine',
    action: 'FundingRequestDenied', entity_type: 'FundingRequest', entity_id: fundingRequest.id,
    description: `Denial notification sent for ${fundingRequest.request_number}`,
  });
}

export async function onApplicationApproved(base44, application) {
  const overrides = await getBuiltinOverrides(base44);
  if (!isRuleActive(overrides, 'application-approved-notify')) return;
  const emailOvr = getEmailOverride(overrides, 'application-approved-notify');
  if (application.submitted_by) {
    await base44.integrations.Core.SendEmail({
      to: application.submitted_by,
      subject: emailOvr.subject || `🎉 Application ${application.application_number} Approved!`,
      body: emailOvr.body || `Congratulations! Your grant application ${application.application_number} - "${application.project_title}" - has been approved.\n\nAwarded Amount: $${(Number(application.awarded_amount) || 0).toLocaleString()}\nPerformance Period: ${application.performance_start || 'TBD'} to ${application.performance_end || 'TBD'}\n\nLog in to the GMT Portal to view your award details and begin submitting funding requests.`,
    }).catch(() => {});
  }
  await base44.entities.AuditLog.create({
    user_email: 'workflow-engine@system', user_name: 'Workflow Engine',
    action: 'ApprovalNotificationSent', entity_type: 'Application', entity_id: application.id,
    description: `Approval notification sent to ${application.submitted_by} for ${application.application_number}`,
  });
}

export async function onApplicationDenied(base44, application, reason) {
  const overrides = await getBuiltinOverrides(base44);
  if (!isRuleActive(overrides, 'application-denied-notify')) return;
  const emailOvr = getEmailOverride(overrides, 'application-denied-notify');
  if (application.submitted_by) {
    await base44.integrations.Core.SendEmail({
      to: application.submitted_by,
      subject: emailOvr.subject || `Application ${application.application_number} - Decision Notice`,
      body: emailOvr.body || `We regret to inform you that your grant application ${application.application_number} - "${application.project_title}" - was not approved at this time.\n\nReason: ${reason || 'Please contact your program officer for details.'}\n\nYou may be eligible to reapply in future funding cycles. Log in to the GMT Portal for more information.`,
    }).catch(() => {});
  }
  await base44.entities.AuditLog.create({
    user_email: 'workflow-engine@system', user_name: 'Workflow Engine',
    action: 'DenialNotificationSent', entity_type: 'Application', entity_id: application.id,
    description: `Denial notification sent for ${application.application_number}`,
  });
}

export async function onReportSubmitted(base44, report, schedule) {
  const overrides = await getBuiltinOverrides(base44);
  // Mark schedule as submitted
  if (schedule) {
    await base44.entities.ReportSchedule.update(schedule.id, { status: 'Submitted' });
  }
  if (!isRuleActive(overrides, 'report-overdue-flag')) return;
  const emailOvr = getEmailOverride(overrides, 'report-overdue-flag');
  // Notify admins
  const admins = await base44.entities.User.filter({ role: 'admin' });
  await Promise.all(admins.map(admin =>
    base44.integrations.Core.SendEmail({
      to: admin.email,
      subject: emailOvr.subject || `Progress Report Submitted - ${schedule?.application_number || ''}`,
      body: emailOvr.body || `A ${schedule?.report_type || ''} progress report has been submitted for application ${schedule?.application_number || ''} (${schedule?.organization_name || ''}).\n\nLog in to the GMT Portal to review the report.`,
    }).catch(() => {})
  ));
  await base44.entities.AuditLog.create({
    user_email: 'workflow-engine@system', user_name: 'Workflow Engine',
    action: 'ReportSubmitted', entity_type: 'ProgressReport', entity_id: report.id,
    description: `Report submitted notification sent to admins for ${schedule?.application_number}`,
  });
}

export async function onReportOverdue(base44, reportSchedule) {
  const overrides = await getBuiltinOverrides(base44);
  if (!isRuleActive(overrides, 'report-overdue-flag')) return;

  const existing = await base44.entities.ComplianceFlag.filter({
    application_id: reportSchedule.application_id, flag_type: 'OverdueReport', is_resolved: false,
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

  await base44.entities.ReportSchedule.update(reportSchedule.id, { status: 'Overdue' });

  await base44.entities.AuditLog.create({
    user_email: 'workflow-engine@system', user_name: 'Workflow Engine',
    action: 'ComplianceFlagCreated', entity_type: 'ReportSchedule', entity_id: reportSchedule.id,
    description: `Auto-created OverdueReport flag for ${reportSchedule.application_number}`,
  });
}

export async function onMilestoneOverdue(base44, milestone) {
  const overrides = await getBuiltinOverrides(base44);
  if (!isRuleActive(overrides, 'milestone-overdue')) return;
  const emailOvr = getEmailOverride(overrides, 'milestone-overdue');

  await base44.entities.Milestone.update(milestone.id, { status: 'Overdue' });

  const existing = await base44.entities.ComplianceFlag.filter({
    application_id: milestone.application_id, flag_type: 'MissingDocument', is_resolved: false,
  });

  if (existing.length === 0) {
    await base44.entities.ComplianceFlag.create({
      application_id: milestone.application_id,
      application_number: milestone.application_number,
      organization_name: milestone.organization_name,
      flag_type: 'MissingDocument',
      description: `Milestone "${milestone.title}" was due ${milestone.due_date} and is now overdue.`,
      severity: 'Medium',
      is_resolved: false,
    });
  }

  if (milestone.assigned_to) {
    await base44.integrations.Core.SendEmail({
      to: milestone.assigned_to,
      subject: emailOvr.subject || `Overdue Milestone: ${milestone.title}`,
      body: emailOvr.body || `The milestone "${milestone.title}" assigned to you for application ${milestone.application_number} was due on ${milestone.due_date} and is now overdue.\n\nPlease log in to the GMT Portal to update its status.`,
    }).catch(() => {});
  }

  await base44.entities.AuditLog.create({
    user_email: 'workflow-engine@system', user_name: 'Workflow Engine',
    action: 'MilestoneOverdue', entity_type: 'Milestone', entity_id: milestone.id,
    description: `Milestone "${milestone.title}" marked Overdue for ${milestone.application_number}`,
  });
}

export async function onComplianceFlagCreated(base44, flag) {
  const overrides = await getBuiltinOverrides(base44);
  if (!isRuleActive(overrides, 'high-flag-alert')) return;
  // Only alert on Critical/High flags
  if (!['Critical', 'High'].includes(flag.severity)) return;
  const emailOvr = getEmailOverride(overrides, 'high-flag-alert');
  const admins = await base44.entities.User.filter({ role: 'admin' });
  await Promise.all(admins.map(admin =>
    base44.integrations.Core.SendEmail({
      to: admin.email,
      subject: emailOvr.subject || `🚨 ${flag.severity} Compliance Flag - ${flag.application_number}`,
      body: emailOvr.body || `A ${flag.severity} severity compliance flag has been created for application ${flag.application_number} (${flag.organization_name}).\n\nType: ${flag.flag_type}\nDetails: ${flag.description}\n\nLog in to the GMT Portal to review and resolve this flag.`,
    }).catch(() => {})
  ));
  await base44.entities.AuditLog.create({
    user_email: 'workflow-engine@system', user_name: 'Workflow Engine',
    action: 'HighSeverityFlagAlert', entity_type: 'ComplianceFlag', entity_id: flag.id,
    description: `${flag.severity} flag alert sent to admins for ${flag.application_number}`,
  });
}

/**
 * Phase 2: Procurement Risk Check
 * Called when a FundingRequest is submitted/approved.
 * Flags equipment purchases > $250k that lack a proper procurement method.
 */
export async function onProcurementRiskCheck(base44, fundingRequest, lineItems = []) {
  const highValueEquip = lineItems.filter(i =>
    i.budget_category === 'Equipment' && (i.amount || 0) > 250000
  );
  if (highValueEquip.length === 0) return;

  const procMethod = fundingRequest.procurement_method;
  if (['CompetitiveBid', 'SoleSource'].includes(procMethod)) return;

  const existing = await base44.entities.ComplianceFlag.filter({
    application_id: fundingRequest.application_id, flag_type: 'FinancialDiscrepancy', is_resolved: false,
  });
  if (existing.some(f => f.description?.includes('$250k') || f.description?.includes('procurement'))) return;

  const total = highValueEquip.reduce((s, i) => s + (i.amount || 0), 0);
  const flag = await base44.entities.ComplianceFlag.create({
    application_id: fundingRequest.application_id,
    application_number: fundingRequest.application_number,
    organization_name: fundingRequest.organization_name,
    flag_type: 'FinancialDiscrepancy',
    description: `Procurement Risk: Equipment purchase of $${total.toLocaleString()} exceeds the $250,000 federal threshold. Funding request ${fundingRequest.request_number} must designate a Competitive Bid or Sole Source procurement method.`,
    severity: 'Critical',
    is_resolved: false,
  });
  await onComplianceFlagCreated(base44, flag);
  await base44.entities.AuditLog.create({
    user_email: 'workflow-engine@system', user_name: 'Workflow Engine',
    action: 'ProcurementRiskFlagged', entity_type: 'FundingRequest', entity_id: fundingRequest.id,
    description: `Procurement risk flag created for ${fundingRequest.request_number} - $${total.toLocaleString()} equipment without procurement method`,
  });
}

/**
 * Phase 2: EHP Risk Check
 * Called after application approval. Checks if construction project needs EHP.
 */
export async function onEhpRiskCheck(base44, application) {
  if (!application.ehp_required || application.ehp_status === 'Approved') return;

  const approvedAt = application.updated_date || application.submitted_at;
  if (!approvedAt) return;
  const daysSinceApproval = (Date.now() - new Date(approvedAt).getTime()) / 86400000;
  if (daysSinceApproval < 30) return;

  const existing = await base44.entities.ComplianceFlag.filter({
    application_id: application.id, flag_type: 'MissingDocument', is_resolved: false,
  });
  if (existing.some(f => f.description?.toLowerCase().includes('ehp'))) return;

  const flag = await base44.entities.ComplianceFlag.create({
    application_id: application.id,
    application_number: application.application_number,
    organization_name: application.organization_name,
    flag_type: 'MissingDocument',
    description: `EHP Review Overdue: Application ${application.application_number} requires Environmental & Historic Preservation (EHP) review. No approved EHP document has been submitted 30+ days post-award.`,
    severity: 'High',
    is_resolved: false,
  });
  await onComplianceFlagCreated(base44, flag);
  await base44.entities.AuditLog.create({
    user_email: 'workflow-engine@system', user_name: 'Workflow Engine',
    action: 'EHPRiskFlagged', entity_type: 'Application', entity_id: application.id,
    description: `EHP overdue flag auto-created for ${application.application_number}`,
  });
}

// Named list of all built-in rules for the UI
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
    action: 'Update application expenditure totals + email subrecipient + warn admins if rate >80%',
    entity: 'FundingRequest',
    active: true,
  },
  {
    id: 'report-overdue-flag',
    trigger: 'Report Due Date Passed',
    condition: 'Report status is still "Pending" after due date',
    action: 'Create OverdueReport ComplianceFlag + mark schedule Overdue (deduplicated)',
    entity: 'ReportSchedule',
    active: true,
  },
  {
    id: 'application-approved-notify',
    trigger: 'Application Status Changed',
    condition: 'New status is "Approved"',
    action: 'Email subrecipient with approval notice and award details',
    entity: 'Document',
    active: true,
  },
  {
    id: 'application-denied-notify',
    trigger: 'Application Status Changed',
    condition: 'New status is "Denied"',
    action: 'Email subrecipient with denial notice and next-steps guidance',
    entity: 'Document',
    active: true,
  },
  {
    id: 'procurement-risk',
    trigger: 'Funding Request Submitted',
    condition: 'Equipment line item > $250,000 without Competitive Bid or Sole Source designation',
    action: 'Create Critical ProcurementRisk ComplianceFlag + email admins',
    entity: 'FundingRequest',
    active: true,
  },
  {
    id: 'ehp-construction-risk',
    trigger: 'Report Due Date Passed',
    condition: 'EHP required application approved > 30 days without approved EHP document',
    action: 'Create High EHP MissingDocument ComplianceFlag + email admins',
    entity: 'Application',
    active: true,
  },
  {
    id: 'high-flag-alert',
    trigger: 'Compliance Flag Created',
    condition: 'Severity is Critical or High',
    action: 'Immediately email all State Admins with flag details',
    entity: 'ComplianceFlag',
    active: true,
  },
  {
    id: 'milestone-overdue',
    trigger: 'Milestone Due Date Passed',
    condition: 'Milestone status is not Completed or Waived',
    action: 'Mark milestone Overdue + create compliance flag + email assignee',
    entity: 'ReportSchedule',
    active: true,
  },
];

// Rule templates that can be added as custom rules with one click
export const RULE_TEMPLATES = [
  {
    name: 'Notify PM on New Funding Request',
    trigger: 'Funding Request Submitted',
    condition: 'Always',
    action_type: 'Send Email to Admins',
    action_detail: '',
    email_subject: 'New Funding Request Submitted - Action Required',
    email_body: 'A new funding request has been submitted and requires your review. Please log in to the GMT Portal to process it.',
    condition_program: '',
  },
  {
    name: 'Flag Missing Match Documentation',
    trigger: 'Funding Request Submitted',
    condition: 'match_documented is 0',
    action_type: 'Create Compliance Flag',
    action_detail: 'MatchShortfall - Subrecipient submitted a funding request with no match documentation.',
    email_subject: '',
    email_body: '',
  },
  {
    name: 'Alert on High-Value Request (>$50,000)',
    trigger: 'Funding Request Submitted',
    condition: 'amount_requested > 50000',
    action_type: 'Send Email to Admins',
    action_detail: '',
    email_subject: 'Large Funding Request Requires Senior Review',
    email_body: 'A funding request exceeding $50,000 has been submitted and requires senior review before processing.',
  },
  {
    name: 'Require Multi-Step Approval for All Requests',
    trigger: 'Funding Request Approved',
    condition: 'Always',
    action_type: 'Enable Multi-Step Payment Approval',
    action_detail: '',
    email_subject: '',
    email_body: '',
  },
  {
    name: 'Notify Subrecipient on Revision Request',
    trigger: 'Application Status Changed',
    condition: 'New status is "RevisionRequested"',
    action_type: 'Send Email to Subrecipient',
    action_detail: '',
    email_subject: 'Action Required: Application Revision Requested',
    email_body: 'Your grant application has been reviewed and revisions are required. Please log in to the GMT Portal to view the reviewer comments and submit an updated application.',
  },
  {
    name: 'Closeout Reminder at 90% Expenditure',
    trigger: 'Funding Request Approved',
    condition: 'expenditure_rate > 90',
    action_type: 'Send Email to Admins',
    action_detail: '',
    email_subject: 'Grant Closeout Planning Required - Expenditure >90%',
    email_body: 'A grant has exceeded 90% expenditure. Please initiate closeout planning and confirm the final report schedule with the subrecipient.',
  },
];