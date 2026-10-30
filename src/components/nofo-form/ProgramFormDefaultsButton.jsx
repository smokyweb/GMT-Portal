import {useState} from 'react';
import ProgramFormDefaultsDialog from './ProgramFormDefaultsDialog';
export default function ProgramFormDefaultsButton({program}) {
  const [open,setOpen]=useState(false);
  return <><button type="button" onClick={()=>setOpen(true)} className="w-full border rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/30">Application Defaults</button>{open&&<ProgramFormDefaultsDialog program={program} onClose={()=>setOpen(false)}/>}</>;
}
