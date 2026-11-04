import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

export function templateTokens(text='') {
  return [...new Set([...String(text).matchAll(/\{\{\s*([#/]?[^}]+?)\s*\}\}/g)]
    .map(match=>match[1].trim())
    .filter(token=>!['#each','/each'].some(prefix=>token===prefix))
    .map(token=>token.replace(/^#each\s+/,'').replace(/^\/each\s*/,'')))];
}

function xmlText(xml) {
  return String(xml).replace(/<w:tab[^>]*\/>/g,' ').replace(/<[^>]+>/g,'')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'");
}

export async function inspectTemplateFile(filePath,originalName='') {
  if (!/\.docx$/i.test(originalName||filePath)) return {tokens:[]};
  const zip=await JSZip.loadAsync(await fs.readFile(filePath));
  const names=Object.keys(zip.files).filter(name=>/^word\/(document|header\d*|footer\d*)\.xml$/i.test(name));
  const text=await Promise.all(names.map(name=>zip.file(name).async('string'))).then(parts=>parts.map(xmlText).join('\n'));
  return {tokens:templateTokens(text)};
}

export async function templateFilePath(uploadRoot,filename) {
  const target=path.resolve(uploadRoot,path.basename(filename||''));
  if(path.dirname(target)!==path.resolve(uploadRoot))throw new Error('Invalid uploaded template path');
  return target;
}
