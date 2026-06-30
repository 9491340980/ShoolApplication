import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { DataService } from '../../core/data.service';
import { SchoolService } from '../../core/school.service';
import { Student } from '../../core/models';
import { buildExportName } from '../../core/export';
import { downloadElementPdf } from '../../core/report-pdf';
import { TPipe } from '../../core/translate.service';

type CertType = 'bonafide' | 'tc';

const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const ORDINAL_DAYS = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth', 'Twenty-first', 'Twenty-second', 'Twenty-third', 'Twenty-fourth', 'Twenty-fifth', 'Twenty-sixth', 'Twenty-seventh', 'Twenty-eighth', 'Twenty-ninth', 'Thirtieth', 'Thirty-first'];

function below100(n: number): string {
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
}
function numWords(n: number): string {
  if (n < 100) return below100(n);
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + below100(n % 100) : '');
  const th = Math.floor(n / 1000);
  return below100(th) + ' Thousand' + (n % 1000 ? ' ' + numWords(n % 1000) : '');
}

@Component({
  selector: 'app-certificates',
  imports: [FormsModule, TPipe],
  templateUrl: './certificates.component.html',
})
export class CertificatesComponent {
  data = inject(DataService);
  private schoolSvc = inject(SchoolService);

  schoolName = computed(() => this.schoolSvc.currentSchool()?.name ?? environment.schoolName);
  schoolAddress = computed(() => this.schoolSvc.currentSchool()?.address || '');
  schoolPhone = computed(() => this.schoolSvc.currentSchool()?.phone || '');
  logo = computed(() => this.schoolSvc.currentSchool()?.logo || '');
  classes = computed(() => this.data.schoolClasses());

  tab = signal<CertType>('bonafide');
  today = new Date().toISOString().slice(0, 10);

  classFilter = signal('');
  studentId = signal('');
  /** Pick from current students or passed-out (left) students. */
  source = signal<'current' | 'left'>('current');
  studentList = computed(() => {
    if (this.source() === 'left') return this.data.leftStudents();
    return this.classFilter() ? this.data.studentsOf(this.classFilter()) : this.data.students();
  });
  student = computed<Student | undefined>(() => this.data.student(this.studentId()));

  // ---- shared ----
  date = signal(this.today);
  academicYear = signal(this.defaultAY());
  private defaultAY(): string {
    const d = new Date();
    const y = d.getFullYear();
    return d.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  }
  private compact(d: string): string {
    return d.replace(/-/g, '');
  }

  // ---- bonafide ----
  purpose = signal('');
  bonafideConduct = signal('Good and satisfactory');
  bonafideNo = computed(() => `BNF/${this.student()?.roll ?? 'XX'}/${this.compact(this.date())}`);

  // ---- transfer certificate ----
  tcNo = computed(() => `TC/${this.tcAdmissionNo() || this.student()?.roll || 'XX'}/${this.compact(this.date())}`);
  tcAdmissionNo = signal('');
  tcFather = signal('');
  tcMother = signal('');
  tcCaste = signal('');
  tcNationality = signal('Indian');
  tcReligion = signal('Hindu');
  tcDob = signal('');
  tcDoa = signal('');
  tcClassStudying = signal('');
  tcPromoted = signal('Promoted to the next higher class');
  tcLastAttended = signal(this.today);
  tcLeaving = signal(this.today);
  tcReason = signal("At the parent's request");
  tcMedium = signal('English');
  tcSubjects = signal('');
  tcWorkingDays = signal('');
  tcDaysPresent = signal('');
  tcDues = signal('All dues paid — no dues pending');
  tcConduct = signal('Good');
  tcRemarks = signal('Nil');

  /** Picking a student prefills both certificates from the register + live records. */
  pickStudent(id: string) {
    this.studentId.set(id);
    const s = this.data.student(id);
    if (!s) return;
    this.tcAdmissionNo.set(s.admissionNo ?? '');
    this.tcFather.set(s.fatherName ?? '');
    this.tcMother.set(s.motherName ?? '');
    this.tcCaste.set(s.caste ?? '');
    this.tcDob.set(s.dob ?? '');
    this.tcDoa.set(s.doa ?? '');
    this.tcClassStudying.set(s.classId);
    this.tcSubjects.set(this.data.subjects().map((x) => x.name).join(', '));
    const att = this.data.studentAttendance(id);
    this.tcWorkingDays.set(att.total ? String(att.total) : '');
    this.tcDaysPresent.set(att.total ? String(att.present) : '');
    const balance = this.data.feesOf(id).reduce((a, f) => a + this.data.feeBalance(f), 0);
    this.tcDues.set(balance > 0 ? `₹${balance.toLocaleString('en-IN')} pending` : 'All dues paid — no dues pending');
  }

  dateWords(d: string): string {
    if (!d) return '—';
    const [y, m, day] = d.split('-').map(Number);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${ORDINAL_DAYS[day] ?? day} ${months[m - 1]} ${numWords(y)}`;
  }
  fmtDate(d: string): string {
    return d ? d.split('-').reverse().join('-') : '—';
  }

  downloading = signal(false);
  async download() {
    const el = document.getElementById('cert-print');
    const s = this.student();
    if (!el || !s) return;
    this.downloading.set(true);
    const module = this.tab() === 'bonafide' ? 'Bonafide' : 'TC';
    const name = buildExportName({ module, target: s.name }, this.schoolName());
    try {
      await downloadElementPdf(el, `${name}.pdf`);
    } finally {
      this.downloading.set(false);
    }
  }
}
