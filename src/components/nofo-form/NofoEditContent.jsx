import {useState} from 'react';
import NofoFormEditor from './NofoFormEditor';
export default function NofoEditContent({nofo,children,onTabChange}) {
  const [tab,setTab]=useState('details');
  return <div className="space-y-4">
    <div role="tablist" aria-label="NOFO settings" className="flex border-b gap-4">
      {[['details','NOFO Details'],['form','Application Form']].map(([id,label])=><button key={id} type="button" role="tab" aria-selected={tab===id} onClick={()=>{setTab(id);onTabChange?.(id);}} className={'px-1 py-2 text-sm border-b-2 '+(tab===id?'border-primary text-primary font-medium':'border-transparent text-muted-foreground')}>{label}</button>)}
    </div>
    <div role="tabpanel">{tab==='details'?children:nofo?<NofoFormEditor nofo={nofo}/>:<p className="text-sm text-muted-foreground p-4">Create the NOFO in NOFO Details first, then open Application Form to configure its application.</p>}</div>
  </div>;
}
