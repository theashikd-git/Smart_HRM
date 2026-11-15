// Small helpers shared by the report screens: CSV download and a plain
// print view. Both work from already-formatted strings, so what's exported
// or printed is exactly what's on screen.

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const lines = [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))];
  // BOM so Excel opens non-English names correctly.
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Opens a clean print view (no app chrome) and prints it. Returns false if the browser blocked the popup. */
export function printTable(opts: {
  company?: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  rightAlign?: number[];
}): boolean {
  const w = window.open('', '_blank', 'width=1000,height=700');
  if (!w) return false;
  const right = new Set(opts.rightAlign ?? []);
  const head = opts.headers.map((h, i) => `<th${right.has(i) ? ' class="r"' : ''}>${esc(h)}</th>`).join('');
  const body = opts.rows
    .map((r) => `<tr>${r.map((c, i) => `<td${right.has(i) ? ' class="r"' : ''}>${esc(c)}</td>`).join('')}</tr>`)
    .join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.title)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm 12mm; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; margin: 0; }
  h1 { font-size: 13pt; margin: 0 0 2px; text-align: center; }
  h2 { font-size: 11pt; margin: 0 0 2px; text-align: center; }
  p { margin: 0 0 8px; text-align: center; color: #444; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 3px 6px; text-align: left; }
  th { background: #eee; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  .r { text-align: right; }
</style></head><body>
${opts.company ? `<h1>${esc(opts.company)}</h1>` : ''}
<h2>${esc(opts.title)}</h2>
${opts.subtitle ? `<p>${esc(opts.subtitle)}</p>` : ''}
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
  w.document.close();
  return true;
}
