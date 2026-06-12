import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-teachers',
  imports: [FormsModule, TPipe],
  templateUrl: './teachers.component.html',
})
export class TeachersComponent {
  auth = inject(AuthService);
  data = inject(DataService);

  search = signal('');
  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.data.teachers().filter((t) => !q || t.name.toLowerCase().includes(q));
  });

  showAdd = signal(false);
  newName = signal('');
  newSubjects = signal('');
  newClasses = signal('');
  newExp = signal(0);
  newPhone = signal('');
  added = signal(false);

  addTeacher() {
    if (!this.newName().trim()) return;
    this.data.addTeacher({
      name: this.newName().trim(),
      subjects: this.newSubjects().split(',').map((s) => s.trim()).filter(Boolean),
      classes: this.newClasses().split(',').map((s) => s.trim()).filter(Boolean),
      experienceYears: Number(this.newExp()) || 0,
      phone: this.newPhone().trim(),
      active: true,
    });
    this.newName.set('');
    this.newSubjects.set('');
    this.newClasses.set('');
    this.newExp.set(0);
    this.newPhone.set('');
    this.showAdd.set(false);
    this.added.set(true);
    setTimeout(() => this.added.set(false), 2500);
  }
}
