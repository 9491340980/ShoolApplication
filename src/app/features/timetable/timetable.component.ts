import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { CLASSES } from '../../core/models';
import { TPipe, TranslateService } from '../../core/translate.service';

@Component({
  selector: 'app-timetable',
  imports: [FormsModule, TPipe],
  templateUrl: './timetable.component.html',
})
export class TimetableComponent {
  auth = inject(AuthService);
  data = inject(DataService);
  i18n = inject(TranslateService);

  classes = CLASSES;
  classId = signal(this.auth.user()?.classId ?? this.data.student(this.auth.user()?.studentId ?? '')?.classId ?? '8A');

  doc = computed(() => this.data.timetable(this.classId()));
  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');

  daysTe = ['సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం'];
  daysEn = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  days = computed(() => (this.i18n.lang() === 'te' ? this.daysTe : this.daysEn));
}
