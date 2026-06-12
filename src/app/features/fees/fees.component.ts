import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-fees',
  imports: [TPipe],
  templateUrl: './fees.component.html',
})
export class FeesComponent {
  auth = inject(AuthService);
  data = inject(DataService);

  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');

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
