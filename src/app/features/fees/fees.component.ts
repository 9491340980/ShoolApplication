import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { CLASSES } from '../../core/models';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-fees',
  imports: [FormsModule, TPipe],
  templateUrl: './fees.component.html',
})
export class FeesComponent {
  auth = inject(AuthService);
  data = inject(DataService);

  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');
  classes = CLASSES;

  // ---- staff ----
  collected = computed(() =>
    this.data.fees().filter((f) => f.status === 'paid').reduce((s, f) => s + f.amount, 0),
  );
  pendingTotal = computed(() => this.data.pendingFees().reduce((s, f) => s + f.amount, 0));
  paidStudents = computed(() => this.data.students().filter((s) => s.feeStatus === 'paid').length);
  pendingRows = computed(() =>
    this.data.pendingFees().map((f) => ({ fee: f, student: this.data.student(f.studentId) })),
  );

  smsSent = false;
  sendSms() {
    this.smsSent = true;
    setTimeout(() => (this.smsSent = false), 2500);
  }

  showAdd = signal(false);
  applyMode = signal<'one' | 'class'>('one');
  feeStudentId = signal('');
  feeClassId = signal('8A');
  feeLabel = signal('');
  feeAmount = signal<number | null>(null);
  feeDue = signal(new Date().toISOString().slice(0, 10));
  feeAdded = signal(false);

  addFee() {
    if (!this.feeLabel().trim() || !this.feeAmount()) return;
    const base = {
      label: this.feeLabel().trim(),
      amount: Number(this.feeAmount()),
      dueDate: this.feeDue(),
      status: 'pending' as const,
    };
    if (this.applyMode() === 'class') {
      // e.g. "Term 1 Tuition ₹2000" assigned to every student of the class at once
      for (const s of this.data.studentsOf(this.feeClassId())) {
        this.data.addFee({ ...base, studentId: s.id });
      }
    } else {
      if (!this.feeStudentId()) return;
      this.data.addFee({ ...base, studentId: this.feeStudentId() });
    }
    this.feeLabel.set('');
    this.feeAmount.set(null);
    this.showAdd.set(false);
    this.feeAdded.set(true);
    setTimeout(() => this.feeAdded.set(false), 2500);
  }

  // ---- parent / student ----
  myStudent = computed(() => {
    const sid = this.auth.user()?.studentId;
    return sid ? this.data.student(sid) : undefined;
  });
  myFees = computed(() => {
    const sid = this.auth.user()?.studentId;
    return sid ? this.data.feesOf(sid) : [];
  });
  myPending = computed(() =>
    this.myFees().filter((f) => f.status === 'pending').reduce((s, f) => s + f.amount, 0),
  );
}
