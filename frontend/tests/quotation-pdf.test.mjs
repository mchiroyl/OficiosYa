import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuotationPdfBlob } from '../src/lib/quotationPdf.js';

test('genera una cotización PDF con la información principal', async () => {
  const pdf = createQuotationPdfBlob({
    workerName: 'José Pérez',
    date: '5 de noviembre de 2026',
    description: 'Reparación de instalación eléctrica',
    price: 125.5,
    requestId: 42,
  });
  const contents = await pdf.text();

  assert.equal(pdf.type, 'application/pdf');
  assert.ok(contents.startsWith('%PDF-1.4'));
  assert.ok(contents.includes('<4A6F73E92050E972657A>'));
  assert.ok(contents.includes('<5265706172616369F36E20646520696E7374616C616369F36E20656CE9637472696361>'));
  assert.ok(contents.includes('<51203132352E3530>'));
  const xrefOffset = Number(contents.match(/startxref\n(\d+)/)?.[1]);
  assert.equal(contents.slice(xrefOffset, xrefOffset + 4), 'xref');
});
