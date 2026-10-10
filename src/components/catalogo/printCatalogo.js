// Export only the rendered catalog, never the application iframe or dialog portal.
const VISUAL_PROPERTIES = [
  'display', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'align-items', 'justify-content', 'gap', 'min-width', 'box-sizing',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'color', 'background-color', 'text-align', 'text-transform', 'white-space',
  'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-bottom', 'object-fit', 'overflow-wrap'
];

function cloneVisual(source, targetDocument) {
  const clone = targetDocument.importNode(source, true);
  const originals = [source, ...source.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  originals.forEach((original, index) => {
    const copy = copies[index];
    const computed = source.ownerDocument.defaultView.getComputedStyle(original);
    copy.removeAttribute('style');
    copy.removeAttribute('id');
    copy.removeAttribute('aria-hidden');
    copy.removeAttribute('inert');
    for (const property of VISUAL_PROPERTIES) {
      copy.style.setProperty(property, computed.getPropertyValue(property));
    }
    if (original.classList.contains('flex-shrink-0') || ['IMG', 'svg'].includes(original.tagName)) {
      copy.style.setProperty('width', computed.width);
      copy.style.setProperty('height', computed.height);
    }
    if (original.tagName === 'IMG') {
      copy.src = original.currentSrc || original.src;
      copy.removeAttribute('srcset');
      copy.loading = 'eager';
    }
  });
  return clone;
}

function waitForImage(image) {
  if (image.complete) return Promise.resolve();
  return new Promise(resolve => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', resolve, { once: true });
    // Check again after installing listeners, including cached images.
    if (image.complete) resolve();
  });
}

export default async function printCatalogo(printWindow, source, title) {
  const doc = printWindow.document;
  doc.open();
  doc.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"></head><body></body></html>');
  doc.close();
  doc.title = `Catálogo - ${title}`;
  const style = doc.createElement('style');
  style.textContent = `
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: white; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #1e293b; }
    .catalogo-document { width: 100%; table-layout: fixed; border-collapse: collapse; }
    .catalogo-document thead { display: table-header-group; }
    .catalogo-document tbody { display: table-row-group; }
    .catalogo-document td { vertical-align: top; padding: 6px; white-space: normal; }
    .catalogo-document tr { break-inside: avoid; page-break-inside: avoid; }
    .catalogo-category-title { break-after: avoid; page-break-after: avoid; }
    [data-catalogo-header] { margin: 0 0 12px !important; padding: 12px !important; border-radius: 8px; }
    [data-catalogo-card] { height: 100%; break-inside: avoid; page-break-inside: avoid; box-shadow: none; padding: 10px !important; border: 1px solid #e2e8f0 !important; border-radius: 8px; }
    [data-catalogo-photo], [data-catalogo-photo] img { width: 64px !important; height: 64px !important; object-fit: contain; background: #fff; border-radius: 4px; }
    [data-catalogo-card] h5 { display: block !important; overflow: visible !important; margin-bottom: 4px; }
    [data-catalogo-footer] { margin-top: 16px; padding-top: 10px; }
    @media screen { body { max-width: 190mm; margin: 24px auto; padding: 0 8px; } }
  `;
  doc.head.appendChild(style);
  const table = doc.createElement('table');
  table.className = 'catalogo-document';
  const headerCell = table.createTHead().insertRow().insertCell();
  headerCell.colSpan = 3;
  headerCell.appendChild(cloneVisual(source.querySelector('[data-catalogo-header]'), doc));
  const body = table.createTBody();
  source.querySelectorAll('[data-catalogo-category]').forEach(category => {
    const titleRow = body.insertRow();
    titleRow.className = 'catalogo-category-title';
    const categoryCell = titleRow.insertCell();
    categoryCell.colSpan = 3;
    categoryCell.appendChild(cloneVisual(category.querySelector('[data-catalogo-category-title]'), doc));
    const cards = [...category.querySelectorAll('[data-catalogo-card]')];
    for (let index = 0; index < cards.length; index += 3) {
      const row = body.insertRow();
      for (let column = 0; column < 3; column++) {
        const cell = row.insertCell();
        if (cards[index + column]) cell.appendChild(cloneVisual(cards[index + column], doc));
      }
    }
  });
  doc.body.appendChild(table);
  doc.body.appendChild(cloneVisual(source.querySelector('[data-catalogo-footer]'), doc));
  await Promise.all([...doc.images].map(waitForImage));
  await doc.fonts.ready;
  await new Promise(resolve => printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(resolve)));
  printWindow.focus();
  printWindow.print();
}