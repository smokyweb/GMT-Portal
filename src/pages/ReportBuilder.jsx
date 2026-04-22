import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Save, Play, Download, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StepPanel from '../components/reports/StepPanel';
import DataSourceStep from '../components/reports/DataSourceStep';
import FieldsStep from '../components/reports/FieldsStep';
import FiltersStep from '../components/reports/FiltersStep';
import SortStep from '../components/reports/SortStep';
import ReportPreview from '../components/reports/ReportPreview';
import { DATA_SOURCES, SUBRECIPIENT_SOURCES } from '../lib/reportDataSources';
import { runReport, exportToCSV } from '../lib/reportEngine';
import { isSubrecipient } from '../lib/helpers';

const DEFAULT_CONFIG = {
  report_name: 'Untitled Report',
  data_source: '',
  selected_fields: [],
  filters: [],
  filter_logic: 'AND',
  group_by: [],
  sort_rules: [],
};

export default function ReportBuilder() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [openStep, setOpenStep] = useState(1);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      // Load from URL state if passed
      const stored = sessionStorage.getItem('reportBuilderConfig');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setConfig(parsed);
          sessionStorage.removeItem('reportBuilderConfig');
          if (parsed.data_source) runPreview(parsed, u);
        } catch {}
      }
    });
  }, []);

  const isSub = isSubrecipient(user?.role);
  const sources = isSub ? SUBRECIPIENT_SOURCES : DATA_SOURCES;

  const update = (patch) => {
    setConfig(c => ({ ...c, ...patch }));
    setDirty(true);
  };

  const changeDataSource = (ds) => {
    if (config.selected_fields.length > 0) {
      if (!window.confirm('Changing the data source will clear your current field selections. Continue?')) return;
    }
    const src = sources[ds];
    update({ data_source: ds, selected_fields: [], filters: src?.defaultFilters || [], sort_rules: [] });
    setOpenStep(2);
  };

  const runPreview = useCallback(async (cfg = config, u = user) => {
    if (!cfg.data_source || !cfg.selected_fields.length) return;
    setPreviewLoading(true);
    const orgFilter = isSubrecipient(u?.role) ? u?.organization_id : null;
    const rows = await runReport(cfg, orgFilter);
    setPreviewRows(rows);
    setPreviewLoading(false);
  }, [config, user]);

  const handleSave = async (saveAs = false) => {
    let name = config.report_name;
    if (!name || name === 'Untitled Report') {
      name = window.prompt('Enter a name for this report:', 'My Report') || 'My Report';
      update({ report_name: name });
    }
    if (saveAs) {
      name = window.prompt('Save as:', name + ' (Copy)') || name + ' (Copy)';
    }
    setSaveLoading(true);
    const payload = { ...config, report_name: name };
    let result;
    if (savedId && !saveAs) {
      result = await base44.entities.SavedReport.update(savedId, payload);
    } else {
      result = await base44.entities.SavedReport.create(payload);
      setSavedId(result.id);
    }
    setSaveLoading(false);
    setDirty(false);
  };

  const handleRunFull = async () => {
    const orgFilter = isSub ? user?.organization_id : null;
    const rows = await runReport(config, orgFilter);
    // Update last run
    if (savedId) {
      await base44.entities.SavedReport.update(savedId, {
        last_run_at: new Date().toISOString(),
        last_run_row_count: rows.length,
      });
    }
    setPreviewRows(rows);
  };

  // Step completion checks
  const step1Done = !!config.data_source;
  const step2Done = config.selected_fields.length > 0;
  const step3Done = true; // filters optional
  const step5Done = config.sort_rules.length > 0;

  const srcLabel = sources[config.data_source]?.label || '';

  return (
    <div className="flex flex-col h-full min-h-screen bg-background">
      {/* Action Bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/reports-module')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="h-5 w-px bg-border" />
        <Input
          value={config.report_name}
          onChange={e => update({ report_name: e.target.value })}
          className="h-8 text-sm font-semibold w-56 border-0 bg-transparent focus-visible:ring-1"
          placeholder="Untitled Report"
        />
        {dirty && <span className="text-xs text-amber-600">● Unsaved</span>}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saveLoading}>
            <Save className="h-3.5 w-3.5 mr-1" /> {saveLoading ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSave(true)}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Save As
          </Button>
          <Button size="sm" onClick={handleRunFull} disabled={!step1Done || !step2Done}>
            <Play className="h-3.5 w-3.5 mr-1" /> Run Report
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToCSV(previewRows, config.selected_fields, config.report_name)} disabled={!previewRows.length}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Body: Config + Preview */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Config Panel */}
        <div className="w-[400px] flex-shrink-0 border-r overflow-y-auto p-4 space-y-3 bg-background">
          <StepPanel
            number={1} title="Data Source"
            isComplete={step1Done} isActive={openStep === 1}
            summary={srcLabel}
            open={openStep === 1} onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}
          >
            <DataSourceStep
              value={config.data_source}
              onChange={changeDataSource}
              isSubrecipient={isSub}
            />
          </StepPanel>

          <StepPanel
            number={2} title="Select Fields"
            isComplete={step2Done} isActive={openStep === 2}
            summary={step2Done ? `${config.selected_fields.length} fields selected` : ''}
            open={openStep === 2} onToggle={() => setOpenStep(openStep === 2 ? 0 : 2)}
          >
            {!config.data_source ? (
              <p className="text-xs text-muted-foreground">Select a data source first.</p>
            ) : (
              <FieldsStep
                sourceKey={config.data_source}
                selectedFields={config.selected_fields}
                onChange={f => update({ selected_fields: f })}
              />
            )}
          </StepPanel>

          <StepPanel
            number={3} title="Filters"
            isComplete={step3Done} isActive={openStep === 3}
            summary={config.filters.length > 0 ? `${config.filters.length} filter${config.filters.length > 1 ? 's' : ''}` : 'No filters'}
            open={openStep === 3} onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}
          >
            {!config.data_source ? (
              <p className="text-xs text-muted-foreground">Select a data source first.</p>
            ) : (
              <FiltersStep
                sourceKey={config.data_source}
                filters={config.filters}
                onChange={f => update({ filters: f })}
                filterLogic={config.filter_logic}
                onLogicChange={l => update({ filter_logic: l })}
              />
            )}
          </StepPanel>

          <StepPanel
            number={4} title="Sort Order"
            isComplete={step5Done} isActive={openStep === 4}
            summary={config.sort_rules.length > 0 ? `${config.sort_rules.length} sort rule${config.sort_rules.length > 1 ? 's' : ''}` : 'Default order'}
            open={openStep === 4} onToggle={() => setOpenStep(openStep === 4 ? 0 : 4)}
          >
            <SortStep
              selectedFields={config.selected_fields}
              sortRules={config.sort_rules}
              onChange={r => update({ sort_rules: r })}
            />
          </StepPanel>

          {/* Run Preview button */}
          <Button
            className="w-full"
            onClick={() => runPreview()}
            disabled={!step1Done || !step2Done || previewLoading}
          >
            <Play className="h-4 w-4 mr-2" />
            {previewLoading ? 'Loading…' : 'Run Preview'}
          </Button>
        </div>

        {/* Right: Live Preview */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b">
            <p className="text-sm font-semibold">Live Preview</p>
            <p className="text-xs text-muted-foreground">
              {previewRows.length > 0 ? `${previewRows.length} records` : 'Run preview to see results'}
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ReportPreview
              rows={previewRows}
              selectedFields={config.selected_fields}
              loading={previewLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}