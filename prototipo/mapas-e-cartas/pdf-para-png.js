ObjC.import('Foundation');
ObjC.import('AppKit');
ObjC.import('Quartz');
function run(argv) {
  const [pdf, outdir, widthStr, pagesStr] = argv;
  const width = Number(widthStr || 1600);
  const doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(pdf));
  const n = doc.pageCount;
  const want = pagesStr
    ? pagesStr.split(',').map(Number)
    : Array.from({ length: n }, (_, i) => i + 1);
  const base = pdf.split('/').pop().replace('.pdf', '');
  for (const p of want) {
    if (p < 1 || p > n) continue;
    const page = doc.pageAtIndex(p - 1);
    const b = page.boundsForBox($.kPDFDisplayBoxMediaBox);
    const h = Math.round((width * b.size.height) / b.size.width);
    const img = page.thumbnailOfSizeForBox($.NSMakeSize(width, h), $.kPDFDisplayBoxMediaBox);
    // PDFKit renders in the display's wide-gamut space (e.g. BT.2020); many viewers ignore
    // the embedded profile and show dull colors. Convert to plain sRGB before saving.
    const rep = $.NSBitmapImageRep.imageRepWithData(
      img.TIFFRepresentation,
    ).bitmapImageRepByConvertingToColorSpaceRenderingIntent(
      $.NSColorSpace.sRGBColorSpace,
      $.NSColorRenderingIntentPerceptual,
    );
    const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({}));
    png.writeToFileAtomically(`${outdir}/${base}-p${String(p).padStart(2, '0')}.png`, true);
  }
  return `${n} pages`;
}
