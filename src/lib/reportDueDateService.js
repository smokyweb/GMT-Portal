import { base44 } from '@/api/base44Client';
import { logAudit } from './helpers';
import moment from 'moment';

const SERVICE_KEY = 'reportDueDateService_lastRun';

/**
 * Daily report due-date service.
 * - Marks Pending schedules as Overdue if due_date has passed.
 * - Sends email reminders for schedules due within 7 days.
 * Throttled to run at most once per 24 hours per browser session.
 */
export async function runReportDueDateService() {
  // Throttle: skip if already ran in the last 24h
  const lastRun = localStorage.getItem(SERVICE_KEY);
  if (lastRun && moment().diff(moment(lastRun), 'hours') < 24) return;

  const today = moment().startOf('day');
  const in7Days = moment().add(7, 'days').endOf('day');

  // Fetch all non-submitted schedules
  const schedules = await base44.entities.ReportSchedule.filter({ status: 'Pending' }, 'due_date', 500);

  // Fetch applications to resolve submitted_by emails (for notifications)
  const applications = await base44.entities.Application.list('-created_date', 500);
  const appMap = {};
  applications.forEach(a => { appMap[a.id] = a; });

  const systemUser = { email: 'system', full_name: 'System' };

  let overdueCount = 0;
  let reminderCount = 0;

  for (const schedule of schedules) {
    const dueDate = moment(schedule.due_date);
    if (!dueDate.isValid()) continue;

    const app = appMap[schedule.application_id];
    const recipientEmail = app?.submitted_by;
    const orgName = schedule.organization_name || app?.organization_name || 'Your organization';
    const appNumber = schedule.application_number || app?.application_number || schedule.application_id;

    // --- Mark Overdue ---
    if (dueDate.isBefore(today)) {
      await base44.entities.ReportSchedule.update(schedule.id, { status: 'Overdue' });

      // Create a compliance flag for overdue report
      await base44.entities.ComplianceFlag.create({
        application_id: schedule.application_id,
        application_number: appNumber,
        organization_name: orgName,
        flag_type: 'OverdueReport',
        description: `${schedule.report_type} report for ${appNumber} was due on ${dueDate.format('MMM DD, YYYY')} and has not been submitted.`,
        severity: 'High',
        is_resolved: false,
      });

      await logAudit(base44, systemUser, 'Updated', 'ReportSchedule', schedule.id,
        `Marked ${schedule.report_type} report for ${appNumber} as Overdue (due ${dueDate.format('MMM DD, YYYY')})`);

      // Notify subrecipient
      if (recipientEmail) {
        await base44.integrations.Core.SendEmail({
          to: recipientEmail,
          subject: `OVERDUE: ${schedule.report_type} Report — ${appNumber}`,
          body: `Dear ${orgName},\n\nYour ${schedule.report_type} progress report for grant application ${appNumber} was due on ${dueDate.format('MMMM DD, YYYY')} and has not been submitted.\n\nThis report is now marked OVERDUE. Please log in to the GMT Portal and submit your report immediately to avoid further compliance issues.\n\nIf you have already submitted this report, please contact your state grant manager.\n\nThank you,\nGMT Portal – Automated Compliance System`,
        });
      }

      overdueCount++;
    }

    // --- Send 7-day reminder ---
    else if (dueDate.isBetween(today, in7Days, null, '[]') && recipientEmail) {
      const daysUntilDue = dueDate.diff(today, 'days');

      await base44.integrations.Core.SendEmail({
        to: recipientEmail,
        subject: `Reminder: ${schedule.report_type} Report Due in ${daysUntilDue} Day${daysUntilDue !== 1 ? 's' : ''} — ${appNumber}`,
        body: `Dear ${orgName},\n\nThis is a friendly reminder that your ${schedule.report_type} progress report for grant application ${appNumber} is due on ${dueDate.format('MMMM DD, YYYY')} — that is ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} from today.\n\nPlease log in to the GMT Portal to submit your report before the deadline.\n\nPerformance Period: ${schedule.period_start} to ${schedule.period_end}\n\nThank you,\nGMT Portal – Automated Reporting System`,
      });

      await logAudit(base44, systemUser, 'NoteAdded', 'ReportSchedule', schedule.id,
        `Sent ${daysUntilDue}-day due-date reminder to ${recipientEmail} for ${schedule.report_type} report (${appNumber})`);

      reminderCount++;
    }
  }

  localStorage.setItem(SERVICE_KEY, moment().toISOString());

  return { overdueCount, reminderCount, total: schedules.length };
}