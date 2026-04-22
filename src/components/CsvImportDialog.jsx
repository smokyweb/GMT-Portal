import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, AlertTriangle, CheckCircle2, FileText, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { formatCurrency, logAudit, createNotification } from '../lib/helpers';

const VALID_CATEGORIES = ['Personnel', 'Equipment', 'Training', 'Travel', 'Contractual', 'Planning', 'Other'];

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return { rows: [], error: 'CSV must have a header row and at least one data row.' };

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const required = ['budget_category', 'description', 'amount'];
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length) return { rows: [], error: `Missing required columns: ${missing.join(', ')}` };

  const rows = lines.slice(1).map((line, i) => {
    const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((h, j) => row[h] = vals[j] || '');
    row._index = i + 2; // line number for user reference
    return row;
  });
  return { rows, error: null };
}

function validateRows(rows, remainingBalance) {
  let runningTotal = 0;
  return rows.map(row => {
    const errors = [];
    if (!VALID_CATEGORIES.includes(row.budget_category)) {
      errors.push(`Invalid category "${row.budget_category}"`);
    }
    if (!row.description?.trim()) errors.push('Description is required');
    const amount = parseFloat(row.amount);
    if (isNaN(amount) || amount <= 0) errors.push('Amount must be a positive number');
    else runningTotal += amount;
    const cumulativeExceeds = remainingBalance != null && runningTotal > remainingBalance;
    return { ...row, amount: isNaN(amount) ? 0 : amount, errors, cumulativeExceeds };
  });
}

function downloadTemplate() {
  const csv = 'budget_category,description,amount\nPersonnel,Project Coordinator salary Q1,15000\nEquipment,Radio communications equipment,8500\nTraining,ICS training for 20 staff,3000\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'funding_request_template.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function CsvImportDialog({ open, onClose, apps, user, onSuccess }) {
  const [step, setStep] = useState('select'); // select | preview | submitting
  const [selectedAppId, setSelectedAppId] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState(null);
  const [form, setForm] = useState({ period_start: '', period_end: '', match_documented: 0 });
  const fileRef = useRef();

  const selectedApp = apps.find(a => a.id === selectedAppId);
  const remainingBalance = selectedApp?.remaining_balance ?? selectedApp?.awarded_amount ?? null;
  const validatedRows = parsedRows.length ? validateRows(parsedRows, remainingBalance) : [];
  const hasErrors = validatedRows.some(r => r.errors.length > 0);
  const totalRequested = validatedRows.reduce((s, r) => s + (r.amount || 0), 0);
  const exceedsCap = remainingBalance != null && totalRequested > remainingBalance;

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows, error } = parseCSV(ev.target.result);
      if (error) { setParseError(error); setParsedRows([]); }
      else { setParseError(null); setParsedRows(rows); setStep('preview'); }
    };
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) { fileRef.current.files = e.dataTransfer.files; handleFile({ target: { files: [file] } }); }
  }

  async function handleSubmit() {
    setStep('submitting');
    const allReqs = await base44.entities.FundingRequest.list('-created_date', 1000);
    const reqNum = `REQ-${new Date().getFullYear()}-${String(allReqs.length + 1).padStart(5, '0')}`;

    const fr = await base44.entities.FundingRequest.create({
      application_id: selectedAppId,
      application_number: selectedApp?.application_number,
      organization_id: user.organization_id,
      organization_name: selectedApp?.organization_name,
      submitted_by: user.email,
      request_number: reqNum,
      request_type: 'Reimbursement',
      period_start: form.period_start,
      period_end: form.period_end,
      amount_requested: totalRequested,
      match_documented: Number(form.match_documented),
      status: 'Submitted',
      program_code: selectedApp?.program_code,
      expenditure_rate: selectedApp?.expenditure_rate || 0,
      remaining_balance: remainingBalance || 0,
    });

    for (const row of validatedRows) {
      await base44.entities.FundingRequestLineItem.create({
        funding_request_id: fr.id,
        budget_category: row.budget_category,
        description: row.description,
        amount: row.amount,
        is_allowable: true,
      });
    }

    const users = await base44.entities.User.list();
    const reviewers = users.filter(u => u.role === 'admin' || u.role === 'reviewer');
    for (const r of reviewers) {
      await createNotification(base44, r.email, 'New Funding Request (CSV Import)',
        `${selectedApp?.organization_name} submitted ${reqNum} via CSV import with ${validatedRows.length} line items.`,
        'fr_submitted', 'FundingRequest', fr.id, '/funding-requests');
    }

    await logAudit(base44, user, 'CSVImport', 'FundingRequest', fr.id,
      `CSV import: submitted ${reqNum} with ${validatedRows.length} line items totaling ${formatCurrency(totalRequested)}`);

    handleClose();
    onSuccess();
  }

  function handleClose() {
    setStep('select'); setSelectedAppId(''); setParsedRows([]);
    setParseError(null); setForm({ period_start: '', period_end: '', match_documented: 0 });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Bulk CSV Import — Funding Request
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-5">
            {/* Grant selector */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Select Grant</Label>
                <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                  <SelectTrigger><SelectValue placeholder="Choose approved grant" /></SelectTrigger>
                  <SelectContent>
                    {apps.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.application_number} — {a.project_title || a.organization_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Period Start</Label>
                <input type="date" value={form.period_start}
                  onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
              </div>
              <div>
                <Label>Period End</Label>
                <input type="date" value={form.period_end}
                  onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" />
              </div>
            </div>

            {selectedApp && (
              <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Awarded</p><p className="font-bold">{formatCurrency(selectedApp.awarded_amount)}</p></div>
                <div><p className="text-xs text-muted-foreground">Expended</p><p className="font-bold">{formatCurrency(selectedApp.total_expended)}</p></div>
                <div><p className="text-xs text-muted-foreground">Remaining Balance</p><p className="font-bold text-green-700">{formatCurrency(remainingBalance)}</p></div>
              </div>
            )}

            {/* Template download */}
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Download the CSV template with required columns: <code className="font-mono bg-blue-100 px-1 rounded">budget_category, description, amount</code>
              </p>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="ml-3 flex-shrink-0">
                <Download className="h-3.5 w-3.5 mr-1" /> Template
              </Button>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop} onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition"
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Drop your CSV file here, or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Columns: budget_category, description, amount</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </div>

            {parseError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertTriangle className="h-4 w-4" /> {parseError}
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {/* Summary banner */}
            <div className={`flex items-center justify-between p-3 rounded-lg border ${exceedsCap || hasErrors ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-center gap-2">
                {exceedsCap || hasErrors
                  ? <AlertTriangle className="h-4 w-4 text-red-600" />
                  : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                <span className={`text-sm font-medium ${exceedsCap || hasErrors ? 'text-red-700' : 'text-green-700'}`}>
                  {hasErrors ? 'Validation errors found — fix before submitting'
                    : exceedsCap ? `Total (${formatCurrency(totalRequested)}) exceeds remaining balance (${formatCurrency(remainingBalance)})`
                    : `${validatedRows.length} rows validated — ready to submit`}
                </span>
              </div>
              <div className="text-sm font-bold">Total: {formatCurrency(totalRequested)}</div>
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-medium text-muted-foreground w-8">#</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Description</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {validatedRows.map((row, i) => (
                    <tr key={i} className={`border-b last:border-0 ${row.errors.length ? 'bg-red-50' : row.cumulativeExceeds ? 'bg-amber-50' : ''}`}>
                      <td className="p-2 text-muted-foreground text-xs">{row._index}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${VALID_CATEGORIES.includes(row.budget_category) ? 'bg-primary/10 text-primary' : 'bg-red-100 text-red-700'}`}>
                          {row.budget_category || '—'}
                        </span>
                      </td>
                      <td className="p-2 text-sm">{row.description || <span className="text-muted-foreground italic">empty</span>}</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(row.amount)}</td>
                      <td className="p-2">
                        {row.errors.length ? (
                          <div className="flex flex-col gap-0.5">
                            {row.errors.map((err, j) => (
                              <span key={j} className="flex items-center gap-1 text-xs text-red-600">
                                <X className="h-3 w-3" />{err}
                              </span>
                            ))}
                          </div>
                        ) : row.cumulativeExceeds ? (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="h-3 w-3" />Exceeds cap
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />Valid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold">
                    <td colSpan={3} className="p-2 text-sm">Total ({validatedRows.length} items)</td>
                    <td className="p-2 text-right">{formatCurrency(totalRequested)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setStep('select'); setParsedRows([]); }}>
                ← Re-upload
              </Button>
            </div>
          </div>
        )}

        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Submitting {validatedRows.length} line items…</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={step === 'submitting'}>Cancel</Button>
          {step === 'preview' && (
            <Button
              onClick={handleSubmit}
              disabled={hasErrors || exceedsCap || !form.period_start || !form.period_end}
            >
              Submit {validatedRows.length} Line Items
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}