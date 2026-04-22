import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    // Support being called from entity automation (event payload) or directly
    const milestone_id = payload.milestone_id || payload.event?.entity_id;
    const trigger_type = payload.trigger_type || 'created';

    if (!milestone_id) {
      return Response.json({ error: 'milestone_id required' }, { status: 400 });
    }

    // Fetch milestone
    const milestone = await base44.asServiceRole.entities.Milestone.get(milestone_id);
    if (!milestone) {
      return Response.json({ error: 'Milestone not found' }, { status: 404 });
    }

    const assignee = milestone.assigned_to;
    if (!assignee) {
      return Response.json({ success: true, message: 'No assignee, skipping notification' });
    }

    // Determine message based on trigger type
    let subject, body;
    if (trigger_type === 'overdue') {
      subject = `Milestone Overdue: ${milestone.title} — ${milestone.application_number}`;
      body = `This milestone is now overdue:\n\nTitle: ${milestone.title}\nApplication: ${milestone.application_number}\nOrganization: ${milestone.organization_name}\nDue Date: ${milestone.due_date}\n\nPlease log in to the GMT Portal to update the status.`;
    } else if (trigger_type === 'approaching') {
      subject = `Upcoming Milestone Reminder: ${milestone.title} — ${milestone.application_number}`;
      body = `This milestone is approaching:\n\nTitle: ${milestone.title}\nApplication: ${milestone.application_number}\nOrganization: ${milestone.organization_name}\nDue Date: ${milestone.due_date}\n\nPlease log in to the GMT Portal to view details.`;
    } else if (trigger_type === 'created') {
      subject = `New Milestone Assigned: ${milestone.title} — ${milestone.application_number}`;
      body = `You have been assigned a new milestone:\n\nTitle: ${milestone.title}\nApplication: ${milestone.application_number}\nOrganization: ${milestone.organization_name}\nDue Date: ${milestone.due_date}\nType: ${milestone.milestone_type}\n\nPlease log in to the GMT Portal to view full details.`;
    }

    // Send email
    if (subject && body) {
      await base44.integrations.Core.SendEmail({
        to: assignee,
        subject,
        body,
      });
    }

    // Create in-app notification
    await base44.asServiceRole.entities.Notification.create({
      user_email: assignee,
      title: subject,
      message: body,
      type: `milestone_${trigger_type}`,
      entity_type: 'Milestone',
      entity_id: milestone_id,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    return Response.json({ success: true, message: `Notification sent to ${assignee}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});