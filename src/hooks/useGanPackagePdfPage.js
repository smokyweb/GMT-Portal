/// <reference path="../lib/documents/ganPdfAssets.d.ts" />
import {useEffect,useRef,useState} from 'react';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
export function useGanPackagePdfPage(url) {
  const canvas=useRef(null),render=useRef(null),[renderedKey,setRenderedKey]=useState(''),[zoom,setZoom]=useState('100'),[document,setDocument]=useState(null),[page,setPage]=useState(1),[pages,setPages]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const targetKey=url+'|'+page+'|'+zoom;
  useEffect(()=>{let active=true,task;setLoading(true);setError('');setPage(1);setPages(0);
    (async()=>{
      const pdfjs=await import('pdfjs-dist');if(!active)return;pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
      task=pdfjs.getDocument({url,enableXfa:false,cMapUrl:'/pdfjs/6.4.299/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdfjs/6.4.299/standard_fonts/',wasmUrl:'/pdfjs/6.4.299/wasm/'});
      const loaded=await task.promise;if(active){setDocument(loaded);setPages(loaded.numPages);}
    })().catch(problem=>{if(active){setError(problem.message||'Unable to preview this PDF');setLoading(false);}});
    return()=>{active=false;render.current?.cancel();task?.destroy().catch(()=>{});};
  },[url]);
  useEffect(()=>{if(!document)return;let active=true;setLoading(true);setError('');
    (async()=>{
      const previous=render.current;previous?.cancel();if(previous)await previous.promise.catch(()=>{});
      const pdfPage=await document.getPage(page);if(!active)return;
      const natural=pdfPage.getViewport({scale:1}),viewport=pdfPage.getViewport({scale:Math.min(1.7,1000/natural.width)*Number(zoom)/100}),density=Math.min(window.devicePixelRatio||1,2),node=canvas.current;
      if(!node)return;node.width=Math.floor(viewport.width*density);node.height=Math.floor(viewport.height*density);
      const job=pdfPage.render({canvas:node,canvasContext:node.getContext('2d'),viewport,transform:density===1?null:[density,0,0,density,0,0]});render.current=job;
      await job.promise;if(active){setRenderedKey(targetKey);setLoading(false);}
    })().catch(problem=>{if(active&&problem.name!=='RenderingCancelledException'){setError(problem.message||'Unable to render this PDF page');setLoading(false);}});
    return()=>{active=false;render.current?.cancel();};
  },[document,page,zoom]);
  return {canvas,page,pages,loading:!error&&(loading||renderedKey!==targetKey),error,zoom,changeZoom:value=>setZoom(['100','150','200'].includes(value)?value:'100'),previous:()=>setPage(current=>Math.max(1,current-1)),next:()=>setPage(current=>Math.min(pages,current+1))};
}
