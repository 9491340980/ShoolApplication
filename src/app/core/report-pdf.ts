import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportPdfInfo {
  schoolName: string;
  name: string;
  classId: string;
  roll: string;
  admissionNo?: string;
  fatherName?: string;
  examLabel: string;
  marks: { subject: string; score: number; max: number }[];
  total: number;
  maxTotal: number;
  pct: number;
  rank: number;
  classSize: number;
  attPct: number | null;
  pass: boolean;
}

function grade(score: number, max: number): string {
  const p = (score / max) * 100;
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B+';
  if (p >= 60) return 'B';
  if (p >= 50) return 'C+';
  if (p >= 35) return 'C';
  return 'F';
}

/**
 * Build a one-page A4 progress report as a real PDF.
 * Labels are English (jsPDF's built-in fonts don't render Telugu) — standard
 * for Indian report cards.
 */
export function buildReportPdf(info: ReportPdfInfo): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const mid = W / 2;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(26, 86, 219);
  doc.text(info.schoolName, mid, 18, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(`Progress Report — ${info.examLabel}`, mid, 25, { align: 'center' });
  doc.setDrawColor(26, 86, 219);
  doc.setLineWidth(0.5);
  doc.line(14, 29, W - 14, 29);

  // Student details
  doc.setFontSize(10);
  doc.setTextColor(30);
  let y = 38;
  doc.text(`Name: ${info.name}`, 14, y);
  doc.text(`Class: ${info.classId}    Roll: ${info.roll}`, mid, y);
  y += 6;
  doc.text(`Admission No: ${info.admissionNo || '-'}`, 14, y);
  doc.text(`Father: ${info.fatherName || '-'}`, mid, y);

  // Marks table
  autoTable(doc, {
    startY: y + 5,
    head: [['Subject', 'Max Marks', 'Obtained', 'Grade']],
    body: info.marks.map((m) => [m.subject, String(m.max), String(m.score), grade(m.score, m.max)]),
    foot: [['Total', String(info.maxTotal), String(info.total), grade(info.pct, 100)]],
    theme: 'grid',
    headStyles: { fillColor: [26, 86, 219], halign: 'center' },
    footStyles: { fillColor: [232, 240, 254], textColor: 20, fontStyle: 'bold', halign: 'center' },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
    margin: { left: 14, right: 14 },
  });

  // Summary
  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Percentage: ${info.pct}%`, 14, afterTable);
  doc.text(`Rank: ${info.rank}/${info.classSize}`, mid - 10, afterTable);
  doc.text(`Attendance: ${info.attPct === null ? '-' : info.attPct + '%'}`, W - 14, afterTable, { align: 'right' });

  doc.setFontSize(12);
  doc.setTextColor(info.pass ? 16 : 220, info.pass ? 185 : 30, info.pass ? 129 : 30);
  doc.text(`Result: ${info.pass ? 'PASS' : 'FAIL'}`, 14, afterTable + 9);

  // Signature lines
  doc.setTextColor(120);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const sy = afterTable + 35;
  ['Class Teacher', 'Head Master', 'Parent'].forEach((label, i) => {
    const x = 25 + i * ((W - 50) / 2);
    doc.line(x - 12, sy, x + 12, sy);
    doc.text(label, x, sy + 5, { align: 'center' });
  });

  return doc;
}

type ShareResult = 'shared' | 'downloaded' | 'cancelled';

async function shareFile(file: File, text: string, fallback: () => void): Promise<ShareResult> {
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Report Card', text } as ShareData);
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  fallback();
  return 'downloaded';
}

/** Share the PDF via the phone's native share sheet (WhatsApp, etc.). */
export async function sharePdf(doc: jsPDF, fileName: string, text: string): Promise<ShareResult> {
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });
  return shareFile(file, text, () => doc.save(fileName));
}

/**
 * Capture a DOM element as a PNG image and share it (shows inline in WhatsApp).
 * Renders the actual styled card, so Telugu text is preserved.
 */
export async function shareElementImage(el: HTMLElement, fileName: string, text: string): Promise<ShareResult> {
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return 'cancelled';
  const file = new File([blob], fileName, { type: 'image/png' });
  return shareFile(file, text, () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}
