import nodemailer from 'nodemailer';
import 'dotenv/config';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailgun.org',
  port: parseInt(process.env.SMTP_PORT || '2525'),
  auth: {
    user: process.env.SMTP_USER || 'apps@bluesapps.com',
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || '"Bluesapps" <apps@bluesapps.com>';

export async function sendWelcomeEmail(to, name) {
  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: 'Welcome to the GMT Portal',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2>Welcome to the GMT Portal, ${name}!</h2>
          <p>Your account has been created successfully.</p>
          <p>You can now log in at <a href="https://gmt.bluesapps.com">gmt.bluesapps.com</a></p>
          <br><p>The GMT Team</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Welcome email failed:', err.message);
  }
}

export async function sendPasswordResetEmail(to, name, resetToken) {
  const resetUrl = `https://gmt.bluesapps.com/reset-password?token=${resetToken}`;
  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: 'GMT Portal — Password Reset',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hi ${name},</p>
          <p>Click the link below to reset your password:</p>
          <p><a href="${resetUrl}" style="background:#1a73e8;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
          <p>This link expires in 1 hour.</p>
          <br><p>The GMT Team</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Password reset email failed:', err.message);
  }
}

export async function sendInviteEmail(to, name, tempPassword) {
  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: 'You have been invited to the GMT Portal',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2>You're invited to the GMT Portal</h2>
          <p>Hi ${name},</p>
          <p><strong>Email:</strong> ${to}<br>
          <strong>Temporary Password:</strong> ${tempPassword}</p>
          <p><a href="https://gmt.bluesapps.com" style="background:#1a73e8;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Login Now</a></p>
          <p>Please change your password after logging in.</p>
          <br><p>The GMT Team</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Invite email failed:', err.message);
  }
}
