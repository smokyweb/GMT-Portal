import json,sys
import pypdfium2 as pdfium

doc=pdfium.PdfDocument(sys.stdin.buffer.read())
pages=[]
for page in doc:
    textpage=page.get_textpage()
    text=textpage.get_text_bounded()
    boxes=[textpage.get_charbox(i) for i in range(textpage.count_chars()) if textpage.get_text_range(i,1).strip()]
    width,height=page.get_size()
    pages.append({"text":text,"width":width,"height":height,
        "bounds":[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)]})
print(json.dumps({"pages":pages},ensure_ascii=False))
