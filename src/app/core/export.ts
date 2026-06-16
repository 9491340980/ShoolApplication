import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export type ExportFormat = 'excel' | 'pdf';

/** Export rows in the chosen format (Excel or PDF). */
export function exportData(format: ExportFormat, fileName: string, title: string, rows: Record<string, unknown>[]): void {
  if (format === 'pdf') exportPdf(fileName, title, rows);
  else exportRows(fileName, title, rows);
}

/** Export an array of plain objects to a downloadable .xlsx file. */
export function exportRows(fileName: string, sheetName: string, rows: Record<string, unknown>[]): void {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '—': '' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

/** Export rows as a tabular PDF (landscape, auto-fitted). */
export function exportPdf(fileName: string, title: string, rows: Record<string, unknown>[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(13);
  doc.setTextColor(26, 86, 219);
  doc.text(title, 14, 14);
  const headers = rows.length ? Object.keys(rows[0]) : ['—'];
  const body = rows.map((r) => headers.map((h) => String(r[h] ?? '')));
  autoTable(doc, {
    head: [headers],
    body,
    startY: 18,
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [26, 86, 219], fontSize: 8 },
    alternateRowStyles: { fillColor: [244, 247, 255] },
    margin: { left: 10, right: 10 },
  });
  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

/** Export multiple named sheets in one workbook. */
export function exportSheets(fileName: string, sheets: { name: string; rows: Record<string, unknown>[] }[]): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ '—': '' }]);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
