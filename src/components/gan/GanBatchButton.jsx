export default function GanBatchButton({children,onClick,disabled=false,outline=false}) {
  return <button type="button" onClick={onClick} disabled={disabled}
    className={'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium disabled:pointer-events-none disabled:opacity-50 '+(outline?'border bg-background hover:bg-muted':'bg-primary text-primary-foreground hover:opacity-90')}>{children}</button>;
}
