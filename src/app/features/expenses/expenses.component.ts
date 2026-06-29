import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { EXPENSE_CATEGORIES, Expense } from '../../core/models';
import { ExportFormat, exportData } from '../../core/export';
import { SchoolService } from '../../core/school.service';
import { environment } from '../../../environments/environment';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-expenses',
  imports: [FormsModule, TPipe],
  templateUrl: './expenses.component.html',
})
export class ExpensesComponent {
  private data = inject(DataService);
  private auth = inject(AuthService);
  private schoolSvc = inject(SchoolService);

  categories = EXPENSE_CATEGORIES;
  private todayStr = new Date().toISOString().slice(0, 10);

  // ---- add form ----
  newDate = signal(this.todayStr);
  newCategory = signal(EXPENSE_CATEGORIES[0]);
  newDesc = signal('');
  newAmount = signal<number | null>(null);
  added = signal(false);

  add() {
    const amount = Number(this.newAmount());
    if (!this.newDate() || !amount || amount <= 0) return;
    this.data.addExpense({
      date: this.newDate(),
      category: this.newCategory(),
      description: this.newDesc().trim(),
      amount,
      createdBy: this.auth.user()?.name ?? '',
    });
    this.newDesc.set('');
    this.newAmount.set(null);
    this.added.set(true);
    setTimeout(() => this.added.set(false), 2000);
  }
  remove(e: Expense) {
    if (confirm(`Delete expense "${e.description || e.category}" — ₹${e.amount}?`)) this.data.deleteExpense(e.id);
  }

  // ---- month browser ----
  month = signal(this.todayStr.slice(0, 7)); // yyyy-mm
  private all = computed(() => this.data.expenses());

  todayTotal = computed(() => this.sum(this.all().filter((e) => e.date === this.todayStr)));
  monthTotal = computed(() => this.sum(this.all().filter((e) => e.date.startsWith(this.month()))));
  yearTotal = computed(() => this.sum(this.all().filter((e) => e.date.startsWith(this.month().slice(0, 4)))));

  /** Expenses of the chosen month, newest first. */
  monthExpenses = computed(() => this.all().filter((e) => e.date.startsWith(this.month())));

  /** Day-wise groups for the chosen month: [{date, items, total}]. */
  byDay = computed(() => {
    const map = new Map<string, Expense[]>();
    for (const e of this.monthExpenses()) (map.get(e.date) ?? map.set(e.date, []).get(e.date)!).push(e);
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({ date, items, total: this.sum(items) }));
  });

  /** Category totals for the chosen month, biggest first. */
  byCategory = computed(() => {
    const map = new Map<string, number>();
    for (const e of this.monthExpenses()) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return [...map.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  });

  private sum(list: Expense[]): number {
    return list.reduce((s, e) => s + e.amount, 0);
  }

  fmtMonth(ym: string): string {
    return new Date(ym + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  export(format: ExportFormat) {
    const brand = { schoolName: this.schoolSvc.currentSchool()?.name ?? environment.schoolName, logo: this.schoolSvc.currentSchool()?.logo || undefined };
    exportData(
      format,
      `Expenses-${this.month()}`,
      `Expenses — ${this.fmtMonth(this.month())}`,
      this.monthExpenses().map((e) => ({ Date: e.date, Category: e.category, Description: e.description, Amount: e.amount, By: e.createdBy })),
      brand,
    );
  }
}
