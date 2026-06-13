import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { CLASSES, Student } from '../../core/models';
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

  /** Fees/fee status are visible to the Head Master only. */
  isHM = computed(() => this.auth.role() === 'headmaster');

  /** Teacher sees only their assigned classes; Head Master sees all. */
  classes = computed(() => {
    if (this.auth.role() === 'teacher') return this.data.classesForTeacher(this.auth.user()!.id);
    return [...CLASSES];
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
}
