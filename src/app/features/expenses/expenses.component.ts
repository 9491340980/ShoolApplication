import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { EXPENSE_CATEGORIES, Expense, INCOME_CATEGORIES, PAYMENT_METHODS } from '../../core/models';
import { ExportFormat, buildExportName, exportData } from '../../core/export';
import { downloadElementPdf } from '../../core/report-pdf';
import { SchoolService } from '../../core/school.service';
import { TPipe } from '../../core/translate.service';

type EType = 'expense' | 'income';

@Component({
  selector: 'app-expenses',
  imports: [FormsModule, TPipe],
  templateUrl: './expenses.component.html',
})
export class ExpensesComponent {
  private data = inject(DataService);
  private auth = inject(AuthService);
  private schoolSvc = inject(SchoolService);

  methods = PAYMENT_METHODS;
  expenseCats = EXPENSE_CATEGORIES;
  incomeCats = INCOME_CATEGORIES;
  private todayStr = new Date().toISOString().slice(0, 10);

  schoolName = computed(() => this.schoolSvc.currentSchool()?.name ?? environment.schoolName);
  schoolAddress = computed(() => this.schoolSvc.currentSchool()?.address || '');
  logo = computed(() => this.schoolSvc.currentSchool()?.logo || '');

  // ---- add / edit form ----
  entryType = signal<EType>('expense');
  formCategories = computed(() => (this.entryType() === 'income' ? this.incomeCats : this.expenseCats));
  editingId = signal<string | null>(null);
  fDate = signal(this.todayStr);
  fCategory = signal(EXPENSE_CATEGORIES[0]);
  fPayee = signal('');
  fMethod = signal(PAYMENT_METHODS[0]);
  fDesc = signal('');
  fAmount = signal<number | null>(null);
  added = signal(false);

  setType(t: EType) {
    this.entryType.set(t);
    this.fCategory.set((t === 'income' ? this.incomeCats : this.expenseCats)[0]);
  }
  private resetForm() {
    this.editingId.set(null);
    this.fDate.set(this.todayStr);
    this.fPayee.set('');
    this.fDesc.set('');
    this.fAmount.set(null);
    this.fMethod.set(PAYMENT_METHODS[0]);
  }
  startEdit(e: Expense) {
    this.editingId.set(e.id);
    this.entryType.set(e.type ?? 'expense');
    this.fDate.set(e.date);
    this.fCategory.set(e.category);
    this.fPayee.set(e.payee ?? '');
    this.fMethod.set(e.method ?? PAYMENT_METHODS[0]);
    this.fDesc.set(e.description ?? '');
    this.fAmount.set(e.amount);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  cancelEdit() {
    this.resetForm();
  }
  save() {
    const amount = Number(this.fAmount());
    if (!this.fDate() || !amount || amount <= 0) return;
    const payload = {
      type: this.entryType(),
      date: this.fDate(),
      category: this.fCategory().trim() || (this.entryType() === 'income' ? 'Other Income' : 'Miscellaneous'),
      description: this.fDesc().trim(),
      amount,
      method: this.fMethod(),
      payee: this.fPayee().trim(),
      createdBy: this.auth.user()?.name ?? '',
    };
    const id = this.editingId();
    if (id) this.data.updateExpense(id, payload);
    else this.data.addExpense(payload);
    this.resetForm();
    this.added.set(true);
    setTimeout(() => this.added.set(false), 2000);
  }
  remove(e: Expense) {
    if (confirm(`Delete "${e.description || e.category}" — ₹${e.amount}?`)) {
      this.data.deleteExpense(e.id);
      if (this.editingId() === e.id) this.resetForm();
    }
  }

  // ---- period selector (Month / Year) ----
  view = signal<'month' | 'year'>('month');
  month = signal(this.todayStr.slice(0, 7));
  year = signal(this.todayStr.slice(0, 4));
  filterType = signal<'all' | EType>('all');
  filterCategory = signal('');
  search = signal('');

  private shiftMonth(ym: string, delta: number): string {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  prevPeriod() {
    if (this.view() === 'month') this.month.update((m) => this.shiftMonth(m, -1));
    else this.year.update((y) => String(Number(y) - 1));
  }
  nextPeriod() {
    if (this.view() === 'month') this.month.update((m) => this.shiftMonth(m, 1));
    else this.year.update((y) => String(Number(y) + 1));
  }
  /** Jump from the year view's month list into that month. */
  openMonth(ym: string) {
    this.month.set(ym);
    this.view.set('month');
  }

  /** Date prefix the current period matches: "2026-06" for a month, "2026" for a year. */
  periodPrefix = computed(() => (this.view() === 'month' ? this.month() : this.year()));
  periodLabel = computed(() => (this.view() === 'month' ? this.fmtMonth(this.month()) : this.year()));

  private isIncome = (e: Expense) => e.type === 'income';
  private all = computed(() => this.data.expenses());
  /** Every entry inside the selected month or year. */
  scopeAll = computed(() => this.all().filter((e) => e.date.startsWith(this.periodPrefix())));

  incomeTotal = computed(() => this.sum(this.scopeAll().filter(this.isIncome)));
  expenseTotal = computed(() => this.sum(this.scopeAll().filter((e) => !this.isIncome(e))));
  balance = computed(() => this.incomeTotal() - this.expenseTotal());
  /** Today's spend — a quick at-a-glance figure regardless of the period. */
  todayTotal = computed(() => this.sum(this.all().filter((e) => e.date === this.todayStr && !this.isIncome(e))));
  entryCount = computed(() => this.scopeAll().length);

  /** Categories present in the period (for the filter dropdown). */
  scopeCategories = computed(() => [...new Set(this.scopeAll().map((e) => e.category))].sort());

  /** List after the type / category / search filters. */
  filtered = computed(() => {
    const t = this.filterType();
    const cat = this.filterCategory();
    const q = this.search().trim().toLowerCase();
    return this.scopeAll().filter(
      (e) =>
        (t === 'all' || (t === 'income' ? this.isIncome(e) : !this.isIncome(e))) &&
        (!cat || e.category === cat) &&
        (!q || (e.description + ' ' + (e.payee ?? '') + ' ' + e.category).toLowerCase().includes(q)),
    );
  });

  /** Month view: entries grouped by day (newest first). */
  byDay = computed(() => {
    const map = new Map<string, Expense[]>();
    for (const e of this.filtered()) (map.get(e.date) ?? map.set(e.date, []).get(e.date)!).push(e);
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        items,
        in: this.sum(items.filter(this.isIncome)),
        out: this.sum(items.filter((e) => !this.isIncome(e))),
      }));
  });

  /** Year view: each month's income / expense / balance (newest first). */
  byMonth = computed(() => {
    const map = new Map<string, Expense[]>();
    for (const e of this.filtered()) {
      const m = e.date.slice(0, 7);
      (map.get(m) ?? map.set(m, []).get(m)!).push(e);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([m, items]) => ({
        month: m,
        label: this.fmtMonth(m),
        count: items.length,
        in: this.sum(items.filter(this.isIncome)),
        out: this.sum(items.filter((e) => !this.isIncome(e))),
        net: this.sum(items.filter(this.isIncome)) - this.sum(items.filter((e) => !this.isIncome(e))),
      }));
  });

  byCategory = computed(() => {
    const map = new Map<string, number>();
    for (const e of this.scopeAll().filter((e) => !this.isIncome(e))) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return [...map.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  });

  private sum(list: Expense[]): number {
    return list.reduce((s, e) => s + e.amount, 0);
  }
  fmtMonth(ym: string): string {
    return new Date(ym + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
  isInc(e: Expense): boolean {
    return e.type === 'income';
  }

  downloading = signal(false);
  async print() {
    const el = document.getElementById('exp-print');
    if (!el) return;
    this.downloading.set(true);
    const name = buildExportName({ module: 'CashBook', category: this.periodPrefix() }, this.schoolName());
    try {
      await downloadElementPdf(el, `${name}.pdf`);
    } finally {
      this.downloading.set(false);
    }
  }
  export(format: ExportFormat) {
    const brand = { schoolName: this.schoolName(), logo: this.logo() || undefined };
    exportData(
      format,
      `Cashbook-${this.periodPrefix()}`,
      `Cash Book — ${this.periodLabel()}`,
      this.scopeAll().map((e) => ({
        Date: e.date,
        Type: this.isIncome(e) ? 'Income' : 'Expense',
        Category: e.category,
        Payee: e.payee ?? '',
        Description: e.description,
        Method: e.method ?? '',
        Amount: e.amount,
      })),
      brand,
    );
  }
}
