import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Mail, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function EmailSettings() {
  const [form, setForm] = useState({ host: 'smtp.gmail.com', port: '587', user: '', pass: '', from: '', secure: false });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/smtp').then(r => r.json()).then(d => {
      setForm(f => ({ ...f, host: d.host || 'smtp.gmail.com', port: d.port || '587', user: d.user || '', from: d.from || '' }));
      setConfigured(d.configured);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('SMTP settings saved');
        setConfigured(!!form.user);
      } else {
        toast.error('Failed to save settings');
      }
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!testEmail) { toast.error('Enter a test email address'); return; }
    setTesting(true);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail,
          subject: 'GMT Portal - Email Test',
          html: '<p>This is a test email from GMT Portal. Email delivery is working correctly.</p>',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) toast.success('Test email sent successfully!');
      else toast.error('Email failed: ' + (data.error || data.message || 'Check SMTP settings'));
    } catch (e) { toast.error(e.message); }
    setTesting(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure SMTP to enable automatic user invitation emails</p>
      </div>

      <div className={`rounded-xl border p-4 flex items-start gap-3 ${configured ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        {configured ? <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />}
        <div>
          <p className={`font-semibold text-sm ${configured ? 'text-green-800' : 'text-amber-800'}`}>
            {configured ? 'Email configured — invites will be sent automatically' : 'Email not configured — users receive credentials on screen only'}
          </p>
          {!configured && <p className="text-xs text-amber-700 mt-0.5">Fill in your SMTP details below to enable automatic email invites.</p>}
        </div>
      </div>

      <div className="bg-card border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Mail className="h-4 w-4" /> SMTP Configuration</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>SMTP Host</Label>
            <Input className="mt-1" value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="smtp.gmail.com" />
            <p className="text-xs text-muted-foreground mt-1">For Gmail/Google Workspace: smtp.gmail.com. For Office365: smtp.office365.com</p>
          </div>
          <div>
            <Label>Port</Label>
            <Input className="mt-1" value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} placeholder="587" />
          </div>
          <div className="flex items-center gap-2 pt-7">
            <input type="checkbox" id="secure" checked={form.secure} onChange={e => setForm(f => ({ ...f, secure: e.target.checked }))} className="w-4 h-4" />
            <label htmlFor="secure" className="text-sm">Use SSL (port 465)</label>
          </div>
          <div className="col-span-2">
            <Label>Email Address (SMTP Username)</Label>
            <Input className="mt-1" type="email" value={form.user} onChange={e => setForm(f => ({ ...f, user: e.target.value }))} placeholder="noreply@yourdomain.com" />
          </div>
          <div className="col-span-2">
            <Label>Password / App Password</Label>
            <Input className="mt-1" type="password" value={form.pass} onChange={e => setForm(f => ({ ...f, pass: e.target.value }))} placeholder="••••••••••••••••" />
            <p className="text-xs text-muted-foreground mt-1">
              For Gmail: Use an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary underline">App Password</a> (16 characters, no spaces). Regular Gmail passwords won't work.
            </p>
          </div>
          <div className="col-span-2">
            <Label>From Name / Address (optional)</Label>
            <Input className="mt-1" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} placeholder="GMT Portal <noreply@gmt.bluesapps.com>" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save SMTP Settings'}
        </Button>
      </div>

      {configured && (
        <div className="bg-card border rounded-xl p-6 space-y-3">
          <h2 className="font-semibold">Test Email</h2>
          <p className="text-sm text-muted-foreground">Send a test email to verify your SMTP settings are working.</p>
          <div className="flex gap-2">
            <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com" type="email" />
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? 'Sending...' : 'Send Test'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
