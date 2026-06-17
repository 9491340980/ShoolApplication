/**
 * Runs the E2E suite and produces a PDF report listing every test case with a
 * green tick (passed) or red cross (failed). Local only — never deployed.
 *
 *   npm run test:e2e:pdf            # run tests + build the PDF
 *   node scripts/e2e-report.mjs --no-run   # rebuild PDF from the last run
 *
 * Output: test-report.pdf  (git-ignored)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import jsPDFmod from 'jspdf';
import autoTableMod from 'jspdf-autotable';

const jsPDF = jsPDFmod.jsPDF || jsPDFmod.default || jsPDFmod;
const autoTable = autoTableMod.default || autoTableMod;

const RESULTS = 'test-results/results.json';
const OUT = 'test-report.pdf';

// 1) Run the suite (don't abort on failures — we still want the report).
const args = process.argv.slice(2);
if (!args.includes('--no-run')) {
  console.log('Running E2E tests…');
  spawnSync('npx', ['playwright', 'test', ...args.filter((a) => a !== '--no-run')], { stdio: 'inherit', shell: true });
}

if (!existsSync(RESULTS)) {
  console.error(`No results at ${RESULTS}. Run the tests first.`);
  process.exit(1);
}

// 2) Flatten Playwright's JSON into a flat list of test cases.
const data = JSON.parse(readFileSync(RESULTS, 'utf8'));
const rows = [];
function collect(suite, file) {
  const f = suite.file || file;
  for (const spec of suite.specs || []) {
    const res = (spec.tests?.[0]?.results || []).slice(-1)[0];
    const status = res?.status === 'skipped' ? 'skipped' : spec.ok ? 'passed' : 'failed';
    const duration = (spec.tests || []).reduce((a, t) => a + (t.results || []).reduce((b, r) => b + (r.duration || 0), 0), 0);
    // Use the describe-block name as the group; ignore the file-level suite title.
    const group = suite.title && !suite.title.endsWith('.spec.ts') ? suite.title : '';
    rows.push({ file: basename(f || 'tests'), group, title: spec.title, status, duration });
  }
  for (const s of suite.suites || []) collect(s, f);
}
(data.suites || []).forEach((s) => collect(s, s.file));

const total = rows.length;
const passed = rows.filter((r) => r.status === 'passed').length;
const failed = rows.filter((r) => r.status === 'failed').length;
const skipped = rows.filter((r) => r.status === 'skipped').length;
const durSec = ((data.stats?.duration || 0) / 1000).toFixed(1);

// 3) Build the PDF.
const doc = new jsPDF({ unit: 'mm', format: 'a4' });
const W = doc.internal.pageSize.getWidth();
const BLUE = [26, 86, 219];
const GREEN = [16, 185, 129];
const RED = [220, 38, 38];

doc.setFont('helvetica', 'bold');
doc.setFontSize(17);
doc.setTextColor(...BLUE);
doc.text('VidyaSetu — Automated Test Report', 14, 18);
doc.setFont('helvetica', 'normal');
doc.setFontSize(10);
doc.setTextColor(90);
doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 25);

// summary banner
doc.setDrawColor(...(failed ? RED : GREEN));
doc.setFillColor(failed ? 254 : 240, failed ? 242 : 253, failed ? 242 : 244);
doc.roundedRect(14, 30, W - 28, 16, 2, 2, 'FD');
doc.setFont('helvetica', 'bold');
doc.setFontSize(12);
doc.setTextColor(failed ? RED[0] : GREEN[0], failed ? RED[1] : GREEN[1], failed ? RED[2] : GREEN[2]);
doc.text(failed ? `${failed} FAILED` : 'ALL TESTS PASSED', 18, 40);
doc.setTextColor(60);
doc.setFont('helvetica', 'normal');
doc.setFontSize(10);
doc.text(`Total ${total}   |   Passed ${passed}   |   Failed ${failed}   |   Skipped ${skipped}   |   ${durSec}s`, W - 18, 40, { align: 'right' });

// per-file sections
let y = 54;
const files = [...new Set(rows.map((r) => r.file))];
for (const file of files) {
  const list = rows.filter((r) => r.file === file);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text(`📄 ${file}`.replace('📄 ', ''), 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [['#', 'Test case', 'Result', 'Time']],
    body: list.map((r, i) => [
      String(i + 1),
      r.group ? `${r.group} › ${r.title}` : r.title,
      r.status === 'passed' ? 'Passed' : r.status === 'failed' ? 'Failed' : 'Skipped',
      `${(r.duration / 1000).toFixed(1)}s`,
    ]),
    styles: { fontSize: 9, cellPadding: 1.8, valign: 'middle' },
    headStyles: { fillColor: BLUE, halign: 'left' },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 26 }, 3: { cellWidth: 18, halign: 'right' } },
    margin: { left: 14, right: 14 },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 2) {
        const t = (d.cell.text || []).join('');
        d.cell.styles.textColor = t.includes('Passed') ? GREEN : t.includes('Failed') ? RED : [130, 130, 130];
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.cellPadding = { top: 1.8, bottom: 1.8, left: 8, right: 2 };
      }
    },
    didDrawCell: (d) => {
      if (d.section !== 'body' || d.column.index !== 2) return;
      const t = (d.cell.text || []).join('');
      const cx = d.cell.x + 2.5;
      const cy = d.cell.y + d.cell.height / 2;
      doc.setLineWidth(0.7);
      if (t.includes('Passed')) {
        doc.setDrawColor(...GREEN);
        doc.line(cx, cy + 0.2, cx + 1.6, cy + 1.8);
        doc.line(cx + 1.6, cy + 1.8, cx + 4.4, cy - 2.2);
      } else if (t.includes('Failed')) {
        doc.setDrawColor(...RED);
        doc.line(cx, cy - 2, cx + 4, cy + 2);
        doc.line(cx + 4, cy - 2, cx, cy + 2);
      }
    },
  });
  y = doc.lastAutoTable.finalY + 10;
  if (y > 270) {
    doc.addPage();
    y = 18;
  }
}

writeFileSync(OUT, Buffer.from(doc.output('arraybuffer')));
console.log(`\nPDF report written to ${OUT}  (${passed}/${total} passed)`);
