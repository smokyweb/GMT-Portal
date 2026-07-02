import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Upload, X, Download, CheckCircle, AlertCircle, Users, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Progress } from '@/components/ui/progress';

const TEMPLATE_CSV = `email,role,name,organization_name,scope_state,phone
john.doe@example.com,user,John Doe,Douglas County,,555-123-4567
jane.admin@state.gov,admin,Jane Admin,,NE,555-987-6543
reviewer@agency.gov,reviewer,Sam Reviewer,,NE,`;

const VALID_ROLES = ['user', 'reviewer', 'admin', 'federal_officer', 'federal_admin'];

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'user_upload_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkUserUpload({ onSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [csvData, setCsvData] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const fileInputRef = useRef();

  const reset = () => {
    setCsvData([]);
    setError('');
    setProgress(0);
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    setIsOpen(false);
    reset();
    if (results?.succeeded > 0) onSuccess?.();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setResults(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        if (lines.length < 2) {
          setError('CSV must have a header row and at least one data row.');
          return;
        }

        const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        const emailIdx = headers.indexOf('email');
        if (emailIdx === -1) {
          setError('CSV must include an "email" column.');
          return;
        }

        const roleIdx = headers.indexOf('role');
        const nameIdx = headers.indexOf('name');
        const orgIdx = headers.indexOf('organization_name');
        const stateIdx = headers.indexOf('scope_state');
        const phoneIdx = headers.indexOf('phone');

        const parseRow = (line) => {
          // Handle quoted CSV fields
          const cols = [];
          let cur = '', inQuote = false;
          for (const ch of line) {
            if (ch === '"') { inQuote = !inQuote; }
            else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
            else { cur += ch; }
          }
          cols.push(cur.trim());
          return cols;
        };

        const users = [];
        const validationErrors = [];

        lines.slice(1).forEach((line, idx) => {
          const cols = parseRow(line);
          const email = cols[emailIdx]?.replace(/"/g, '').trim();
          if (!email) return;

          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            validationErrors.push(`Row ${idx + 2}: Invalid email "${email}"`);
            return;
          }

          const role = (cols[roleIdx]?.toLowerCase().trim() || 'user');
          if (!VALID_ROLES.includes(role)) {
            validationErrors.push(`Row ${idx + 2}: Invalid role "${role}" for ${email}. Use: ${VALID_ROLES.join(', ')}`);
            return;
          }

          users.push({
            email,
            role,
            name: nameIdx !== -1 ? cols[nameIdx]?.trim() || '' : '',
            organization_name: orgIdx !== -1 ? cols[orgIdx]?.trim() || '' : '',
            scope_state: stateIdx !== -1 ? cols[stateIdx]?.trim().toUpperCase() || '' : '',
            phone: phoneIdx !== -1 ? cols[phoneIdx]?.trim() || '' : '',
          });
        });

        if (validationErrors.length > 0) {
          setError(validationErrors.join('\n'));
          return;
        }

        if (users.length === 0) {
          setError('No valid users found in the CSV.');
          return;
        }

        // Check for duplicate emails
        const seen = new Set();
        const dupes = users.filter(u => { if (seen.has(u.email)) return true; seen.add(u.email); return false; });
        if (dupes.length > 0) {
          setError(`Duplicate emails found: ${dupes.map(u => u.email).join(', ')}`);
          return;
        }

        setCsvData(users);
      } catch {
        setError('Failed to parse CSV. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (csvData.length === 0) return;
    setUploading(true);
    setProgress(0);
    setResults(null);

    const succeeded = [];
    const failed = [];

    for (let i = 0; i < csvData.length; i++) {
      const u = csvData[i];
      try {
        await base44.users.inviteUser(u.email, u.role);

        // If extra fields set, wait briefly and update user record
        if (u.organization_name || u.scope_state || u.phone) {
          await new Promise(r => setTimeout(r, 1200));
          const allUsers = await base44.entities.User.list('-created_date', 200);
          const newUser = allUsers.find(usr => usr.email === u.email);
          if (newUser) {
            const updates = {};
            if (u.phone) updates.phone = u.phone;
            if (u.scope_state) updates.scope_state = u.scope_state;
            await base44.entities.User.update(newUser.id, updates);
          }
        }

        succeeded.push(u.email);
      } catch (err) {
        failed.push({ email: u.email, reason: err.message || 'Unknown error' });
      }
      setProgress(Math.round(((i + 1) / csvData.length) * 100));
    }

    setResults({ succeeded: succeeded.length, failed, total: csvData.length });
    setCsvData([]);
    setUploading(false);
  };

  const roleLabel = (role) => {
    const map = { user: 'Subrecipient', reviewer: 'Reviewer', admin: 'State Admin', federal_officer: 'Federal Officer', federal_admin: 'Federal Admin' };
    return map[role] || role;
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="gap-2">
        <Users className="h-3.5 w-3.5" /> Bulk Upload
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Upload Users</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Step 1 - Template */}
            <div className="bg-muted/40 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Step 1 - Download the Template</p>
              <p className="text-xs text-muted-foreground">Use the CSV template below. Fill in user details, then upload the completed file.</p>
              <div className="bg-background border rounded text-xs font-mono p-2 overflow-x-auto whitespace-pre">{TEMPLATE_CSV.trim()}</div>
              <div className="pt-1">
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download Template
                </Button>
              </div>
              <div className="text-xs text-muted-foreground pt-1 space-y-0.5">
                <p><strong>role</strong> values: <code>user</code> (subrecipient), <code>reviewer</code>, <code>admin</code>, <code>federal_officer</code>, <code>federal_admin</code></p>
                <p><strong>scope_state</strong> - 2-letter state code (e.g. NE) for state-scoped admins/reviewers</p>
                <p><strong>organization_name</strong> - optional, for subrecipient users</p>
              </div>
            </div>

            {/* Step 2 - Upload */}
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /> Step 2 - Upload Your CSV</p>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to select a CSV file</p>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg whitespace-pre-wrap">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Preview */}
            {csvData.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{csvData.length} user{csvData.length !== 1 ? 's' : ''} ready to invite</p>
                <div className="max-h-52 overflow-y-auto rounded-lg border divide-y">
                  {csvData.map((u, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 text-xs bg-card hover:bg-muted/30">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.name || u.email}</p>
                        <p className="text-muted-foreground truncate">{u.email} · {roleLabel(u.role)}{u.scope_state ? ` · ${u.scope_state}` : ''}{u.organization_name ? ` · ${u.organization_name}` : ''}</p>
                      </div>
                      <button
                        onClick={() => setCsvData(prev => prev.filter((_, idx) => idx !== i))}
                        className="ml-2 p-1 hover:bg-muted rounded flex-shrink-0"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress */}
            {uploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Sending invites…</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Results */}
            {results && (
              <div className={`rounded-lg p-4 space-y-2 ${results.failed.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`h-4 w-4 ${results.failed.length === 0 ? 'text-green-600' : 'text-amber-600'}`} />
                  <p className={`text-sm font-semibold ${results.failed.length === 0 ? 'text-green-800' : 'text-amber-800'}`}>
                    {results.succeeded} of {results.total} invite{results.total !== 1 ? 's' : ''} sent successfully
                  </p>
                </div>
                {results.failed.length > 0 && (
                  <div className="space-y-1">
                    {results.failed.map((f, i) => (
                      <div key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <span><strong>{f.email}</strong>: {f.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {results ? 'Close' : 'Cancel'}
            </Button>
            {!results && (
              <Button onClick={handleUpload} disabled={csvData.length === 0 || uploading}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {uploading ? 'Uploading…' : `Invite ${csvData.length || ''} User${csvData.length !== 1 ? 's' : ''}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}