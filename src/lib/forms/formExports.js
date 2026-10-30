import {readableValue} from './formPresentation.js';
export function formExportCsv(fields) {
  const cell=value=>{let text=readableValue(value);if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  return [['Section','Field','Value'],...fields.map(field=>[field.sectionLabel||field.sectionId,field.label,readableValue(field.value,field)])].map(row=>row.map(cell).join(',')).join('\r\n');
}
