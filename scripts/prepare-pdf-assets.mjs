import {cp,mkdir,readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const dependency=path.join(root,'node_modules/pdfjs-dist');
const {version}=JSON.parse(await readFile(path.join(dependency,'package.json'),'utf8'));
if(version!=='6.4.299')throw Error('Update the GAN PDF asset URLs before changing pdfjs-dist versions');
const publicDir=path.join(root,'public');
await mkdir(publicDir,{recursive:true});
if(await realpath(publicDir)!==publicDir)throw Error('Public asset directory must stay inside this project');
const parent=path.join(publicDir,'pdfjs');
await mkdir(parent,{recursive:true});
if(await realpath(parent)!==parent)throw Error('PDF asset directory must stay inside this project');
const target=path.join(parent,version);
await mkdir(target,{recursive:true});
if(await realpath(target)!==target)throw Error('PDF version directory must stay inside this project');
for(const directory of ['cmaps','standard_fonts','wasm']){
  const destination=path.join(target,directory);
  await mkdir(destination,{recursive:true});
  if(await realpath(destination)!==destination)throw Error('PDF asset target must stay inside this project');
  await cp(path.join(dependency,directory),destination,{recursive:true});
}
console.log('Prepared private-viewer support assets for pdfjs-dist '+version);
