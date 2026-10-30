export default function FundingSubmissionError({message}) {
  if(!message)return null;
  return <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{message}</p>;
}
