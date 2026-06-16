import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { Student } from '../../core/models';
import { TPipe } from '../../core/translate.service';
import { TKey } from '../../core/translations';

@Component({
  selector: 'app-students',
  imports: [FormsModule, TPipe],
  templateUrl: './students.component.html',
})
export class StudentsComponent {
  auth = inject(AuthService);
  data = inject(DataService);

  search = signal('');
  classFilter = signal('');

  /** Grid (table) is the default — easier to scan many rows; card view is opt-in. */
  viewMode = signal<'grid' | 'card'>('grid');

  /** Fees/fee status are visible to the Head Master only. */
  isHM = computed(() => this.auth.role() === 'headmaster');

  /** Teacher sees only their assigned classes; Head Master sees all of the school's classes. */
  classes = computed(() => {
    if (this.auth.role() === 'teacher') return this.data.classesForTeacher(this.auth.user()!.id);
    return this.data.schoolClasses();
  });

  private classDefault = effect(() => {
    const allowed = this.classes();
    if (allowed.length && !allowed.includes(this.newClass())) this.newClass.set(allowed[0]);
  });

  attPct(studentId: string): number | null {
    return this.data.studentAttendance(studentId).pct;
  }
  feeStatus(studentId: string): 'paid' | 'pending' | null {
    return this.data.studentFeeStatus(studentId);
  }

  showAdd = signal(false);
  showMore = signal(false);
  added = signal(false);

  // basic
  newRoll = signal('');
  newName = signal('');
  newClass = signal('');
  newPhone = signal('');
  // full register details
  newAdmissionNo = signal('');
  newFather = signal('');
  newMother = signal('');
  newDob = signal('');
  newDoa = signal('');
  newCaste = signal('');
  newMotherTongue = signal('');
  newAadhaar = signal('');
  newPen = signal('');
  newApaar = signal('');
  newAddress = signal('');

  // detail viewer
  viewing = signal<Student | null>(null);

  viewAtt = computed(() => {
    const s = this.viewing();
    return s ? this.data.studentAttendanceDetail(s.id) : null;
  });
  viewFees = computed(() => {
    const s = this.viewing();
    return s ? this.data.feesOf(s.id) : [];
  });
  viewFeeTotal = computed(() => this.viewFees().reduce((a, f) => a + f.amount, 0));
  viewFeePending = computed(() =>
    this.viewFees().filter((f) => f.status === 'pending').reduce((a, f) => a + f.amount, 0),
  );
  viewResults = computed(() => {
    const s = this.viewing();
    if (!s) return [];
    return this.data.schoolExams().map((e) => {
      const marks = this.data.studentMarks(s.id, e.id);
      if (!marks.length) return null;
      const total = marks.reduce((a, m) => a + m.score, 0);
      const max = marks.reduce((a, m) => a + m.max, 0);
      return { label: e.label, marks, total, max, pct: max ? Math.round((total / max) * 1000) / 10 : 0 };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  });

  monthLabel(ym: string): string {
    const [y, m] = ym.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[Number(m) - 1] ?? m} ${y}`;
  }

  detailFields: { label: TKey; key: keyof Student }[] = [
    { label: 'admissionNo', key: 'admissionNo' },
    { label: 'fatherName', key: 'fatherName' },
    { label: 'motherName', key: 'motherName' },
    { label: 'parentPhone', key: 'parentPhone' },
    { label: 'dob', key: 'dob' },
    { label: 'doa', key: 'doa' },
    { label: 'caste', key: 'caste' },
    { label: 'motherTongue', key: 'motherTongue' },
    { label: 'aadhaar', key: 'aadhaar' },
    { label: 'pen', key: 'pen' },
    { label: 'apaarId', key: 'apaarId' },
    { label: 'address', key: 'address' },
  ];

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const cls = this.classFilter();
    const allowed = this.classes();
    const teacher = this.auth.role() === 'teacher';
    return this.data
      .students()
      .filter(
        (s) =>
          (!teacher || allowed.includes(s.classId)) &&
          (!cls || s.classId === cls) &&
          (!q || s.name.toLowerCase().includes(q)),
      );
  });

  addStudent() {
    if (!this.newName().trim() || !this.newRoll().trim()) return;
    this.data.addStudent({
      roll: this.newRoll().trim(),
      name: this.newName().trim(),
      classId: this.newClass(),
      parentPhone: this.newPhone().trim(),
      admissionNo: this.newAdmissionNo().trim() || undefined,
      fatherName: this.newFather().trim() || undefined,
      motherName: this.newMother().trim() || undefined,
      dob: this.newDob() || undefined,
      doa: this.newDoa() || undefined,
      caste: this.newCaste().trim() || undefined,
      motherTongue: this.newMotherTongue().trim() || undefined,
      aadhaar: this.newAadhaar().trim() || undefined,
      pen: this.newPen().trim() || undefined,
      apaarId: this.newApaar().trim() || undefined,
      address: this.newAddress().trim() || undefined,
    });
    for (const s of [
      this.newRoll, this.newName, this.newPhone, this.newAdmissionNo, this.newFather, this.newMother,
      this.newDob, this.newDoa, this.newCaste, this.newMotherTongue, this.newAadhaar, this.newPen,
      this.newApaar, this.newAddress,
    ]) {
      s.set('');
    }
    this.showAdd.set(false);
    this.added.set(true);
    setTimeout(() => this.added.set(false), 2500);
  }

  // ---------- bulk import (Excel / CSV) ----------
  importBusy = signal(false);
  importMsg = signal<string | null>(null);

  /** First matching header value from a row (headers are case/space-insensitive). */
  private pick(row: Record<string, unknown>, ...names: string[]): string {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const map = new Map(Object.keys(row).map((k) => [norm(k), row[k]]));
    for (const n of names) {
      const v = map.get(norm(n));
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }

  async onImportFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importBusy.set(true);
    this.importMsg.set(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      const students = rows
        .map((r) => ({
          roll: this.pick(r, 'roll', 'rollno', 'sno', 'serialno'),
          name: this.pick(r, 'name', 'studentname'),
          classId: this.pick(r, 'class', 'classid', 'section') || this.classFilter() || this.classes()[0] || '',
          parentPhone: this.pick(r, 'parentphone', 'phone', 'mobile', 'contact'),
          admissionNo: this.pick(r, 'admissionno', 'admno') || undefined,
          fatherName: this.pick(r, 'fathername', 'father') || undefined,
          motherName: this.pick(r, 'mothername', 'mother') || undefined,
          dob: this.pick(r, 'dob', 'dateofbirth') || undefined,
          doa: this.pick(r, 'doa', 'dateofadmission') || undefined,
          caste: this.pick(r, 'caste') || undefined,
          motherTongue: this.pick(r, 'mothertongue') || undefined,
          aadhaar: this.pick(r, 'aadhaar', 'aadhar') || undefined,
          pen: this.pick(r, 'pen') || undefined,
          apaarId: this.pick(r, 'apaar', 'apaarid') || undefined,
          address: this.pick(r, 'address') || undefined,
        }))
        .filter((s) => s.name && s.roll);

      if (!students.length) {
        this.importMsg.set('No valid rows found. Check the column headers (Roll, Name, Class…).');
      } else {
        const n = await this.data.addStudentsBulk(students);
        this.importMsg.set(`✓ Imported ${n} students.`);
      }
    } catch {
      this.importMsg.set('Could not read the file. Use the template format (.xlsx or .csv).');
    } finally {
      this.importBusy.set(false);
      input.value = '';
    }
  }

  downloadTemplate() {
    const headers = [
      'Roll', 'Name', 'Class', 'ParentPhone', 'AdmissionNo', 'FatherName', 'MotherName',
      'DOB', 'DOA', 'Caste', 'MotherTongue', 'Aadhaar', 'PEN', 'APAAR', 'Address',
    ];
    const sample = ['1', 'Aarav Reddy', '8A', '9876500011', 'ADM1001', 'Suresh Reddy', 'Latha', '2014-05-10', '2020-06-12', 'OC', 'Telugu', '', '', '', 'Vijayawada'];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'VidyaSetu-Students-Template.xlsx');
  }
}
