import GanIssuedPdf from './GanIssuedPdf';
import GanUploadedPdf from './GanUploadedPdf';
import GanBatchButton from './GanBatchButton';
export default function GanReviewDocuments({workflow,review}) {
  return <div className="min-w-0 space-y-4">
    {review.submission&&<div aria-label="Compare award documents" className="flex flex-wrap gap-2"><GanBatchButton outline={review.view!=='issued'} onClick={()=>review.choose('issued')}>Generated GAN package</GanBatchButton>
      <GanBatchButton outline={review.view!=='uploaded'} onClick={()=>review.choose('uploaded')}>Uploaded signed copy</GanBatchButton></div>}
    {review.view==='uploaded'&&review.submission?<GanUploadedPdf review={review}/>:<GanIssuedPdf workflow={workflow}/>}
  </div>;
}
