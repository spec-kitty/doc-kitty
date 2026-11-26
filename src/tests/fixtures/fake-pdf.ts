/**
 * A synthetic PDF shaped like Chromium's output (ADR-0081): classic xref, an info
 * dictionary with wall-clock dates, a tagged catalog with an outline, and drifting
 * structure ids. Shared by the post-pass tests and the dockitty-pdf error-path tests.
 */
/** A minimal Chromium-like PDF: `created` is the wall clock, `idBase` the DOM node counter. */
export function fakePdf({ created = "D:20261120175635+00'00'", idBase = 922, lang = 'en' } = {}) {
  const objects = [
    `<</Title (Architecture | Site)\n/Creator (Chromium)\n/Producer (Skia/PDF m157)\n/CreationDate (${created})\n/ModDate (${created})>>`,
    `<</Type /Catalog\n/Pages 3 0 R\n/MarkInfo <</Type /MarkInfo\n/Marked true>>\n/StructTreeRoot 4 0 R\n/Outlines 5 0 R\n/Lang (${lang})>>`,
    '<</Type /Pages\n/Count 2\n/Kids []>>',
    `<</Type /StructTreeRoot\n/K [8 0 R]\n/IDTree <</Names [(node${String(idBase).padStart(8, '0')}) 8 0 R (node${String(idBase + 1).padStart(8, '0')}) 9 0 R]>>>>`,
    '<</Type /Outlines\n/First 6 0 R\n/Last 6 0 R\n/Count 2>>',
    '<</Title (Architecture)\n/Parent 5 0 R\n/First 7 0 R\n/Last 7 0 R>>',
    '<</Title <FEFF004F0076006500720076006900650077>\n/Parent 6 0 R>>',
    `<</Type /StructElem\n/S /H1\n/ID (node${String(idBase).padStart(8, '0')})>>`,
    `<</Type /StructElem\n/S /P\n/ID (node${String(idBase + 1).padStart(8, '0')})>>`,
  ];
  let body = '%PDF-1.7\n%\xb5\xed\xae\xfb\n';
  const offsets: number[] = [];
  objects.forEach((dict, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${dict}\nendobj\n`;
  });
  const xrefAt = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) body += `${String(o).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<</Size ${objects.length + 1}\n/Root 2 0 R\n/Info 1 0 R>>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(body, 'latin1');
}
