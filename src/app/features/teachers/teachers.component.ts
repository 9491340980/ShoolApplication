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
}
