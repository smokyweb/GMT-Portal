import {useState} from 'react';
import {base44} from '@/api/base44Client';
import {parseAccountCsv} from '@/lib/accountCsv';
export function useBulkAccountUpload(onSuccess) {
  const [open,setOpen]=useState(false),[rows,setRows]=useState([]),[preview,setPreview]=useState(null),[result,setResult]=useState(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const upload=async file=>{
    if(!file)return;
    setBusy(true);setError('');setPreview(null);setResult(null);setRows([]);
    try {
      if(!file.name.toLowerCase().endsWith('.csv')||file.size>2*1024*1024)throw new Error('Choose a CSV file under 2 MB');
      const data=parseAccountCsv(await file.text());
      const review=await base44.accounts.previewImport(data);setRows(data);setPreview(review);
    }catch(err){setError(err.message);}finally{setBusy(false);}
  };
  const commit=async()=>{
    setBusy(true);setError('');
    try{setResult(await base44.accounts.commitImport(rows,preview.fingerprint));setPreview(null);}
    catch(err){setError(err.message);}finally{setBusy(false);}
  };
  const close=()=>{
    if(busy)return;
    if(result?.succeeded)onSuccess?.();
    setOpen(false);setRows([]);setPreview(null);setResult(null);setError('');
  };
  return {open,setOpen,rows,preview,result,busy,error,upload,commit,close};
}
