import {useNofoFormBuilder} from '@/hooks/useNofoFormBuilder';
import FormEditorView from './FormEditorView';
export default function NofoFormEditor({nofo,mode='nofo',scopeState=''}) {
  const state=useNofoFormBuilder(nofo,mode,scopeState);
  const description=mode==='program'?
    'Defaults for '+(scopeState||'all states')+'. Configured NOFO forms and started applications retain their saved versions.'+(state.version?.inherited_from_version?' Currently inherits all-state version '+state.version.inherited_from_version+'.':''):
    state.version?.locked_at?'This version is locked. Saving creates a new version for future applications.':'The form locks as soon as an application starts.';
  return <FormEditorView state={state} title={mode==='program'?'Program Application Defaults':'Application Form'} description={description} saveLabel={mode==='program'?'Save Program Defaults':'Save Application Form'}/>;
}
