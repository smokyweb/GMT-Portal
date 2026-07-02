import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck, CheckCircle, FileText, Plus, Trash2 } from 'lucide-react';

const DOC_TYPES = [
  'Invoice',
  'PerformanceEvidence',
  'Contract',
  'BudgetJustification',
  'MatchDocumentation',
  'ProgressNarrative',
  'FinalReport',
  'Other',
];

const DOC_TYPE_LABELS = {
  Invoice: 'Invoice',
  PerformanceEvidence: 'Performance Evidence',
  Contract: 'Contract',
  BudgetJustification: 'Budget Justification',
  MatchDocumentation: 'Match Documentation',
  ProgressNarrative: 'Progress Narrative',
  FinalReport: 'Final Report',
  Other: 'Other',
};

const SETTINGS_KEY = 'document_review';

export default function DocumentReviewSettings({ user }) {
  const [settingsRecord, setSettingsRecord] = useState(null);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [docTypeSettings, setDocTypeSettings] = useState({});
  const [customTypes, setCustomTypes] = useState([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const records = await base44.entities.AppSettings.filter({ key: SETTINGS_KEY });
    if (records.length > 0) {
      const rec = records[0];
      setSettingsRecord(rec);
      setGlobalEnabled(rec.value?.global_enabled ?? false);
      setDocTypeSettings(rec.value?.doc_types ?? {});
      setCustomTypes(rec.value?.custom_types ?? []);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const value = {
      global_enabled: globalEnabled,
      doc_types: docTypeSettings,
      custom_types: customTypes,
    };
    if (settingsRecord) {
      await base44.entities.AppSettings.update(settingsRecord.id, { value, updated_by: user?.email });
    } else {
      const rec = await base44.entities.AppSettings.create({ key: SETTINGS_KEY, value, updated_by: user?.email });
      setSettingsRecord(rec);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggleDocType = (type) => {
    setDocTypeSettings(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const addCustomType = () => {
    const trimmed = newTypeName.trim();
    if (!trimmed || customTypes.includes(trimmed)) return;
    setCustomTypes(prev => [...prev, trimmed]);
    setNewTypeName('');
  };

  const removeCustomType = (type) => {
    setCustomTypes(prev => prev.filter(t => t !== type));
    setDocTypeSettings(prev => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };

  if (loading) return <div className="flex items-center justify-center h-24"><div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Global Toggle */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Enable Document Review</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Master switch - when off, no documents require individual review regardless of type settings.
              </p>
            </div>
          </div>
          <Switch
            checked={globalEnabled}
            onCheckedChange={setGlobalEnabled}
          />
        </div>
      </div>

      {/* Per Doc Type */}
      <div className={`bg-card border rounded-xl overflow-hidden transition-opacity ${!globalEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Review Required by Document Type</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-6">
            Enable review for specific document types. Only active when the master switch is on.
          </p>
        </div>
        <div className="divide-y">
          {DOC_TYPES.map(type => (
            <div key={type} className="flex items-center justify-between px-5 py-3">
              <Label className="text-sm cursor-pointer select-none">{DOC_TYPE_LABELS[type]}</Label>
              <Switch
                checked={!!docTypeSettings[type]}
                onCheckedChange={() => toggleDocType(type)}
              />
            </div>
          ))}
          {customTypes.map(type => (
            <div key={type} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm cursor-pointer select-none">{type}</Label>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Custom</span>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={!!docTypeSettings[type]}
                  onCheckedChange={() => toggleDocType(type)}
                />
                <button
                  onClick={() => removeCustomType(type)}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {/* Add custom type */}
          <div className="flex items-center gap-2 px-5 py-3 bg-muted/20">
            <Input
              placeholder="New document type name…"
              value={newTypeName}
              onChange={e => setNewTypeName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomType()}
              className="h-8 text-sm"
            />
            <Button size="sm" variant="outline" onClick={addCustomType} disabled={!newTypeName.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
        {saved && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> Settings saved
          </span>
        )}
      </div>
    </div>
  );
}