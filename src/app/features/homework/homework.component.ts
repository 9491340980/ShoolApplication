import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { BulkSendService } from '../../core/bulk-send.service';
import { DataService } from '../../core/data.service';
import { Homework } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-homework',
  imports: [FormsModule, TPipe],
  templateUrl: './homework.component.html',
})
export class HomeworkComponent {
  auth = inject(AuthService);
  data = inject(DataService);
  notify = inject(NotifyService);
  bulk = inject(BulkSendService);

  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');

  classes = computed(() => {
    if (this.auth.role() === 'teacher') return this.data.classesForTeacher(this.auth.user()!.id);
    return this.data.schoolClasses();
  });

  /** The class to post for (staff) or the child's/own class (parent/student). */
  classId = signal('');
  subject = signal('');
  text = signal('');
  date = signal(new Date().toISOString().slice(0, 10));
  posted = signal(false);

  private myClassId = computed(() => {
    const u = this.auth.user();
    if (u?.classId) return u.classId;
    const sid = u?.studentId;
    return sid ? (this.data.student(sid)?.classId ?? '') : '';
  });

  private classGuard = effect(() => {
    if (this.isStaff()) {
      const allowed = this.classes();
      if (allowed.length && !allowed.includes(this.classId())) this.classId.set(allowed[0]);
    } else {
      this.classId.set(this.myClassId());
    }
  });

  subjectOptions = computed(() => this.data.subjects().map((s) => s.name));

  /** Homework for the currently selected class, newest first. */
  list = computed(() => this.data.homework().filter((h) => h.classId === this.classId()));

  post() {
    if (!this.subject().trim() || !this.text().trim()) return;
    this.data.addHomework({
      classId: this.classId(),
      date: this.date(),
      subject: this.subject().trim(),
      text: this.text().trim(),
      postedBy: this.auth.user()?.name ?? '',
    });
    this.subject.set('');
    this.text.set('');
    this.posted.set(true);
    setTimeout(() => this.posted.set(false), 2500);
  }

  /** Send a single homework item to the class's parents over WhatsApp (guided bulk). */
  send(h: Homework) {
    const msg = this.notify.homeworkMessage(h.classId, h.date, [{ subject: h.subject, text: h.text }]);
    const seen = new Set<string>();
    const items = this.data
      .studentsOf(h.classId)
      .filter((s) => s.parentPhone)
      .filter((s) => {
        const k = s.parentPhone.replace(/\D/g, '');
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((s) => ({ name: s.name, link: this.notify.whatsappLink(s.parentPhone, msg) }));
    this.bulk.start(items);
  }
}
