import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { environment } from '../../../environments/environment';
import { AttendanceHistoryService } from '../../core/attendance-history.service';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { ExportFormat, exportData } from '../../core/export';
import { Student } from '../../core/models';
import { fileToSquarePhoto } from '../../core/image';
import { SchoolService } from '../../core/school.service';
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
  hist = inject(AttendanceHistoryService);
  private schoolSvc = inject(SchoolService);

  openHistory(s: Student) {
    this.hist.open(s.name, this.data.studentAttendanceMap(s.id));
  }

  private brand() {
    const s = this.schoolSvc.currentSchool();
    return { schoolName: s?.name ?? environment.schoolName, logo: s?.logo || undefined };
  }

  search = signal('');
  classFilter = signal('');

  /** Grid (table) is the default — easier to scan many rows; card view is opt-in. */
  viewMode = signal<'grid' | 'card'>('grid');

  /** Fees/fee status are visible to the Head Master only. */
  isHM = computed(() => this.auth.role() === 'headmaster');

  // ---- active vs recycle bin ----
  tab = signal<'active' | 'bin'>('active');
  deactivated = computed(() => this.data.deactivatedStudents());
  openBin() {
    this.data.purgeExpired(); // clear anything past 30 days
    this.tab.set('bin');
  }
  daysLeft(s: Student): number {
    return this.data.daysLeft(s.deactivatedAt);
  }

  /** Always soft-delete to the recycle bin (Gmail-style); hard delete is explicit, from the bin. */
  remove(s: Student) {
    const d = this.data.studentDeps(s.id);
    const note = d.has ? `\nLinked records (attendance ${d.attendance}, marks ${d.marks}, fees ${d.fees}) are kept and return if you restore.` : '';
    const msg = `Move "${s.name}" to Deactivated?${note}\n\nIt is removed permanently after ${this.data.RETENTION_DAYS} days unless you restore it.`;
    if (confirm(msg)) this.data.deactivateStudent(s.id);
  }
  restore(s: Student) {
    this.data.restoreStudent(s.id);
  }
  deleteNow(s: Student) {
    if (confirm(`Permanently delete "${s.name}" now? This cannot be undone.`)) this.data.deleteStudent(s.id);
  }

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
  editingId = signal<string | null>(null);

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
  newPhoto = signal('');
  photoBusy = signal(false);
  async onPhotoPick(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.photoBusy.set(true);
    try {
      this.newPhoto.set(await fileToSquarePhoto(file));
    } catch {
      /* ignore a bad image */
    } finally {
      this.photoBusy.set(false);
    }
  }

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

  startAdd() {
    this.editingId.set(null);
    for (const s of [
      this.newRoll, this.newName, this.newPhone, this.newAdmissionNo, this.newFather, this.newMother,
      this.newDob, this.newDoa, this.newCaste, this.newMotherTongue, this.newAadhaar, this.newPen,
      this.newApaar, this.newAddress, this.newPhoto,
    ]) {
      s.set('');
    }
    this.showAdd.set(!this.showAdd());
  }

  startEdit(s: Student) {
    this.editingId.set(s.id);
    this.newRoll.set(s.roll);
    this.newName.set(s.name);
    this.newClass.set(s.classId);
    this.newPhone.set(s.parentPhone);
    this.newAdmissionNo.set(s.admissionNo ?? '');
    this.newFather.set(s.fatherName ?? '');
    this.newMother.set(s.motherName ?? '');
    this.newDob.set(s.dob ?? '');
    this.newDoa.set(s.doa ?? '');
    this.newCaste.set(s.caste ?? '');
    this.newMotherTongue.set(s.motherTongue ?? '');
    this.newAadhaar.set(s.aadhaar ?? '');
    this.newPen.set(s.pen ?? '');
    this.newApaar.set(s.apaarId ?? '');
    this.newAddress.set(s.address ?? '');
    this.newPhoto.set(s.photo ?? '');
    this.showMore.set(true);
    this.showAdd.set(true);
    this.viewing.set(null);
  }

  saveStudent() {
    if (!this.newName().trim() || !this.newRoll().trim()) return;
    const data = {
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
      photo: this.newPhoto() || undefined,
    };
    const id = this.editingId();
    if (id) this.data.updateStudent(id, data);
    else this.data.addStudent(data);
    for (const s of [
      this.newRoll, this.newName, this.newPhone, this.newAdmissionNo, this.newFather, this.newMother,
      this.newDob, this.newDoa, this.newCaste, this.newMotherTongue, this.newAadhaar, this.newPen,
      this.newApaar, this.newAddress, this.newPhoto,
    ]) {
      s.set('');
    }
    this.showAdd.set(false);
    this.editingId.set(null);
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

  /** Export the currently filtered students (full register + live attendance/fee). */
  exportStudents(format: ExportFormat) {
    const rows = this.filtered().map((s) => ({
      Roll: s.roll,
      Name: s.name,
      Class: s.classId,
      ParentPhone: s.parentPhone,
      AdmissionNo: s.admissionNo ?? '',
      FatherName: s.fatherName ?? '',
      MotherName: s.motherName ?? '',
      DOB: s.dob ?? '',
      DOA: s.doa ?? '',
      Caste: s.caste ?? '',
      MotherTongue: s.motherTongue ?? '',
      Aadhaar: s.aadhaar ?? '',
      PEN: s.pen ?? '',
      APAAR: s.apaarId ?? '',
      Address: s.address ?? '',
      'Attendance%': this.attPct(s.id) ?? '',
      FeeStatus: this.feeStatus(s.id) ?? '',
    }));
    const tag = this.classFilter() || 'All';
    exportData(format, `Students-${tag}-${new Date().toISOString().slice(0, 10)}`, `Students — ${tag}`, rows, this.brand());
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
