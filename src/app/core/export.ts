import * as XLSX from 'xlsx';

/** Export an array of plain objects to a downloadable .xlsx file. */
export function exportRows(fileName: string, sheetName: string, rows: Record<string, unknown>[]): void {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '—': '' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
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
