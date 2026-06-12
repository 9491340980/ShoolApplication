import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { NoticeType } from '../../core/models';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-notices',
  imports: [FormsModule, TPipe],
  templateUrl: './notices.component.html',
})
export class NoticesComponent {
  auth = inject(AuthService);
  data = inject(DataService);

  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');

  title = signal('');
  body = signal('');
  type = signal<NoticeType>('general');
  audience = signal<'all' | 'teachers' | 'parents' | 'students'>('all');
  posted = signal(false);

  post() {
    if (!this.title().trim() || !this.body().trim()) return;
    this.data.addNotice({
      title: this.title().trim(),
      body: this.body().trim(),
      type: this.type(),
      audience: this.audience(),
      postedBy: this.auth.user()?.name ?? '',
      date: new Date().toISOString().slice(0, 10),
    });
    this.title.set('');
    this.body.set('');
    this.posted.set(true);
    setTimeout(() => this.posted.set(false), 2500);
  }
}
