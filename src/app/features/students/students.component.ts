import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { CLASSES } from '../../core/models';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-students',
  imports: [FormsModule, TPipe],
  templateUrl: './students.component.html',
})
export class StudentsComponent {
  auth = inject(AuthService);
  data = inject(DataService);

  classes = CLASSES;
  search = signal('');
  classFilter = signal(this.auth.user()?.classId ?? '');

  showAdd = signal(false);
  newRoll = signal('');
  newName = signal('');
  newClass = signal('8A');
  newPhone = signal('');
  added = signal(false);

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const cls = this.classFilter();
    return this.data
      .students()
      .filter((s) => (!cls || s.classId === cls) && (!q || s.name.toLowerCase().includes(q)));
  });

  addStudent() {
    if (!this.newName().trim() || !this.newRoll().trim()) return;
    this.data.addStudent({
      roll: this.newRoll().trim(),
      name: this.newName().trim(),
      classId: this.newClass(),
      parentPhone: this.newPhone().trim(),
      attendancePct: 100,
      feeStatus: 'paid',
    });
    this.newRoll.set('');
    this.newName.set('');
    this.newPhone.set('');
    this.showAdd.set(false);
    this.added.set(true);
    setTimeout(() => this.added.set(false), 2500);
  }
}
