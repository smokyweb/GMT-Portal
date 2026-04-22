import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import moment from 'npm:moment@2.30.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all upcoming/in-progress milestones
    const milestones = await base44.asServiceRole.entities.Milestone.list('-due_date', 1000);
    const today = moment();
    let count = 0;

    for (const m of milestones) {
      if (m.status === 'Completed' || m.status === 'Waived') continue;

      const dueDate = moment(m.due_date);
      const isOverdue = dueDate.isBefore(today, 'day');
      const daysUntil = dueDate.diff(today, 'days');

      // Mark as overdue if applicable
      if (isOverdue && m.status !== 'Overdue') {
        await base44.asServiceRole.entities.Milestone.update(m.id, { status: 'Overdue' });
        // Send notification
        if (m.assigned_to) {
          await base44.functions.invoke('notifyMilestoneAssignee', {
            milestone_id: m.id,
            trigger_type: 'overdue',
          });
          count++;
        }
      }

      // Notify if approaching (due within 7 days)
      if (!isOverdue && daysUntil >= 0 && daysUntil <= 7 && m.status !== 'Completed' && m.status !== 'Waived') {
        if (m.assigned_to && !m.reminder_sent) {
          await base44.functions.invoke('notifyMilestoneAssignee', {
            milestone_id: m.id,
            trigger_type: 'approaching',
          });
          await base44.asServiceRole.entities.Milestone.update(m.id, { reminder_sent: true });
          count++;
        }
      }
    }

    return Response.json({
      success: true,
      message: `Checked ${milestones.length} milestones, sent ${count} notifications`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});