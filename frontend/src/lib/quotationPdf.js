const replacements = new Map([
  ['€', 0x80], ['…', 0x85], ['†', 0x86], ['‡', 0x87], ['ˆ', 0x88], ['‰', 0x89],
  ['Š', 0x8a], ['‹', 0x8b], ['Œ', 0x8c], ['Ž', 0x8e], ['‘', 0x91], ['’', 0x92],
  ['“', 0x93], ['”', 0x94], ['•', 0x95], ['–', 0x96], ['—', 0x97], ['™', 0x99],
  ['š', 0x9a], ['›', 0x9b], ['œ', 0x9c], ['ž', 0x9e], ['Ÿ', 0x9f],
]);

function winAnsiHex(value) {
  return Array.from(String(value), (char) => {
    const point = char.codePointAt(0);
    const byte = replacements.get(char) ?? (point <= 0xff ? point : 0x3f);
    return byte.toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}

function wrapText(value, maxLength = 76) {
  const words = String(value).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= maxLength) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['—'];
}

function textCommand(text, x, y, size = 12, font = 'F1', color = '0.12 0.16 0.18') {
  return `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm <${winAnsiHex(text)}> Tj ET`;
}

export function createQuotationPdfBlob({ workerName, date, description, price, requestId }) {
  const commands = [
    'q 0.16 0.58 0.58 rg 0 690 612 102 re f Q',
    textCommand('COTIZACIÓN DE SERVICIO', 48, 744, 20, 'F2', '1 1 1'),
    textCommand(`Solicitud #${requestId}`, 48, 716, 11, 'F1', '1 1 1'),
    textCommand('TRABAJADOR', 48, 650, 9, 'F2', '0.34 0.40 0.42'),
    textCommand(workerName, 48, 628, 15, 'F2'),
    textCommand('FECHA', 48, 584, 9, 'F2', '0.34 0.40 0.42'),
    textCommand(date, 48, 562, 12),
    textCommand('DESCRIPCIÓN DEL SERVICIO', 48, 510, 9, 'F2', '0.34 0.40 0.42'),
  ];

  const descriptionLines = wrapText(description, 78).slice(0, 12);
  let y = 484;
  for (const line of descriptionLines) {
    commands.push(textCommand(line, 48, y, 12));
    y -= 19;
  }

  const priceY = Math.max(174, y - 28);
  commands.push(
    `q 0.94 0.97 0.97 rg 40 ${priceY - 30} 532 76 re f Q`,
    textCommand('PRECIO TOTAL', 58, priceY + 18, 10, 'F2', '0.34 0.40 0.42'),
    textCommand(`Q ${Number(price).toFixed(2)}`, 58, priceY - 8, 20, 'F2', '0.08 0.43 0.45'),
    textCommand('Esta cotización fue enviada por el chat de OficiosYA.', 48, 82, 9, 'F1', '0.42 0.46 0.48'),
  );

  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let document = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(document.length);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = document.length;
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    document += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([document], { type: 'application/pdf' });
}
