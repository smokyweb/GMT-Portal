import {renderGanPdfOutput} from './ganPdfRender.js';
// Internal draft-only entry point; request payloads cannot choose an issue mode.
export function renderGanPdfPreview(preview,options) {return renderGanPdfOutput(preview,options);}
