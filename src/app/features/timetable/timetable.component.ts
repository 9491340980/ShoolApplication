import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { TPipe, TranslateService } from '../../core/translate.service';

const DEFAULT_PERIODS = ['8:30-9:15', '9:15-10:00', '10:00-10:45', '10:45-11:00', '11:00-11:45', '11:45-12:30', '12:30-1:15'];

@Component({
  selector: 'app-timetable',
  imports: [FormsModule, TPipe],
  templateUrl: './timetable.component.html',
})
export class TimetableComponent {
  auth = inject(AuthService);
  data = inject(DataService);
  i18n = inject(TranslateService);

  classes = computed(() => this.data.schoolClasses());
  classId = signal(
    this.auth.user()?.classId ?? this.data.student(this.auth.user()?.studentId ?? '')?.classId ?? this.data.schoolClasses()[0] ?? '8A',
  );
  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');

  daysTe = ['సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం'];
  daysEn = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  days = computed(() => (this.i18n.lang() === 'te' ? this.daysTe : this.daysEn));

  /** Editable working copy: periods[] and grid[day][period]. */
  periods = signal<string[]>([]);
  grid = signal<string[][]>([]);
  saved = signal(false);

  /** Suggestions for the cell input: the school's subjects plus common entries. */
  cellOptions = computed(() => [...this.data.subjects().map((s) => s.name), 'BREAK', 'Lunch', 'Library', 'Games', 'PT', 'Free']);

  /** Reload the working copy only when the class changes (not on every edit). */
  private loader = effect(() => {
    const cls = this.classId();
    const doc = untracked(() => this.data.timetable(cls));
    if (doc) {
      this.periods.set([...doc.periods]);
      this.grid.set(doc.grid.map((d) => [...d]));
    } else {
      this.periods.set([...DEFAULT_PERIODS]);
      this.grid.set(Array.from({ length: 6 }, () => DEFAULT_PERIODS.map(() => '')));
    }
    this.saved.set(false);
  });

  hasTimetable = computed(() => this.periods().length > 0);

  setPeriod(p: number, value: string) {
    this.periods.update((arr) => arr.map((v, i) => (i === p ? value : v)));
    this.saved.set(false);
  }
  setCell(day: number, p: number, value: string) {
    this.grid.update((g) => g.map((row, d) => (d === day ? row.map((v, i) => (i === p ? value : v)) : row)));
    this.saved.set(false);
  }
  addPeriod() {
    this.periods.update((arr) => [...arr, '']);
    this.grid.update((g) => g.map((row) => [...row, '']));
    this.saved.set(false);
  }
  removePeriod(p: number) {
    this.periods.update((arr) => arr.filter((_, i) => i !== p));
    this.grid.update((g) => g.map((row) => row.filter((_, i) => i !== p)));
    this.saved.set(false);
  }
  save() {
    this.data.saveTimetable(this.classId(), this.periods(), this.grid());
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2500);
  }
}
