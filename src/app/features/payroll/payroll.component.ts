import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { DataService } from '../../core/data.service';
import { SchoolService } from '../../core/school.service';
import { StaffSalary } from '../../core/models';
import { buildExportName } from '../../core/export';
import { downloadElementPdf } from '../../core/report-pdf';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-payroll',
  imports: [FormsModule, TPipe],
  templateUrl: './payroll.component.html',
})
export class PayrollComponent {
  data = inject(DataService);
  private schoolSvc = inject(SchoolService);

  schoolName = computed(() => this.schoolSvc.currentSchool()?.name ?? environment.schoolName);
  schoolAddress = computed(() => this.schoolSvc.currentSchool()?.address || '');
  logo = computed(() => this.schoolSvc.currentSchool()?.logo || '');

  month = signal(new Date().toISOString().slice(0, 7));
  staff = computed(() => this.data.salaries());

  total = computed(() => this.staff().reduce((a, s) => a + s.monthlySalary, 0));
  paidTotal = computed(() => this.staff().filter((s) => this.isPaid(s)).reduce((a, s) => a + s.monthlySalary, 0));
  paidCount = computed(() => this.staff().filter((s) => this.isPaid(s)).length);

  isPaid(s: StaffSalary): boolean {
    return (s.paidMonths ?? []).includes(this.month());
  }
  fmtMonth(m: string): string {
    return new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  flash = signal('');
  private toast(m: string) {
    this.flash.set(m);
    setTimeout(() => this.flash.set(''), 2500);
  }

  // ---- add / edit staff ----
  editingId = signal<string | null>(null);
  fName = signal('');
  fRole = signal('');
  fAmount = signal<number | null>(null);
  private reset() {
    this.editingId.set(null);
    this.fName.set('');
    this.fRole.set('');
    this.fAmount.set(null);
  }
  cancel() {
    this.reset();
  }
  edit(s: StaffSalary) {
    this.editingId.set(s.id);
    this.fName.set(s.name);
    this.fRole.set(s.role ?? '');
    this.fAmount.set(s.monthlySalary);
  }
  save() {
    if (!this.fName().trim() || !this.fAmount()) return;
    this.data.setSalary({ id: this.editingId() ?? undefined, name: this.fName(), role: this.fRole(), monthlySalary: Number(this.fAmount()) });
    this.reset();
  }
  remove(s: StaffSalary) {
    if (confirm(`Remove ${s.name} from payroll?`)) this.data.removeSalary(s.id);
  }

  // ---- pay ----
  pay(s: StaffSalary) {
    if (this.data.payStaff(s.id, this.month())) this.toast(`Paid ${s.name} for ${this.fmtMonth(this.month())}.`);
  }
  payAll() {
    const n = this.data.payAllStaff(this.month());
    this.toast(n ? `Posted ${n} salary payment(s) to the cash book.` : 'Everyone is already paid for this month.');
  }

  // ---- salary slip ----
  slipStaff = signal<StaffSalary | null>(null);
  openSlip(s: StaffSalary) {
    this.slipStaff.set(s);
  }
  closeSlip() {
    this.slipStaff.set(null);
  }
  downloading = signal(false);
  async downloadSlip() {
    const el = document.getElementById('slip-print');
    const s = this.slipStaff();
    if (!el || !s) return;
    this.downloading.set(true);
    const name = buildExportName({ module: 'SalarySlip', category: this.month(), target: s.name }, this.schoolName());
    try {
      await downloadElementPdf(el, `${name}.pdf`);
    } finally {
      this.downloading.set(false);
    }
  }
}
