import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { BulkSendService } from '../../core/bulk-send.service';
import { DataService } from '../../core/data.service';
import { ExportFormat, exportData } from '../../core/export';
import { Notice, NoticeType } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { SchoolService } from '../../core/school.service';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-notices',
  imports: [FormsModule, TPipe],
  templateUrl: './notices.component.html',
})
export class NoticesComponent {
  auth = inject(AuthService);
  data = inject(DataService);
  notify = inject(NotifyService);
  bulk = inject(BulkSendService);
  private schoolSvc = inject(SchoolService);

  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');
  schoolName = computed(() => this.schoolSvc.currentSchool()?.name ?? environment.schoolName);
  logo = computed(() => this.schoolSvc.currentSchool()?.logo || '');
  schoolAddress = computed(() => this.schoolSvc.currentSchool()?.address || '');
  schoolPhone = computed(() => this.schoolSvc.currentSchool()?.phone || '');

  /** Notice currently shown in the printable board view. */
  printing = signal<Notice | null>(null);
  openPrint(n: Notice) {
    this.printing.set(n);
  }
  closePrint() {
    this.printing.set(null);
  }
  printNow() {
    window.print();
  }
  typeIcon(t: NoticeType): string {
    return t === 'urgent' ? '⚠️' : t === 'event' ? '🎉' : '📌';
  }

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

  exportNotices(format: ExportFormat) {
    exportData(
      format,
      'Notices',
      'Notices',
      this.data.notices().map((n) => ({ Date: n.date, Title: n.title, Type: n.type, Audience: n.audience, By: n.postedBy, Body: n.body })),
      { schoolName: this.schoolName(), logo: this.logo() || undefined },
    );
  }

  /** Phone recipients for a notice's audience (dedupes parents by phone). */
  private recipients(audience: Notice['audience']): { name: string; phone: string }[] {
    const teachers = this.data
      .teachers()
      .filter((t) => t.phone)
      .map((t) => ({ name: t.name, phone: t.phone }));
    const seen = new Set<string>();
    const parents = this.data
      .students()
      .filter((s) => s.parentPhone)
      .map((s) => ({ name: s.name, phone: s.parentPhone }))
      .filter((p) => {
        const k = p.phone.replace(/\D/g, '');
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    if (audience === 'teachers') return teachers;
    if (audience === 'parents' || audience === 'students') return parents;
    return [...teachers, ...parents]; // all
  }

  recipientCount(n: Notice): number {
    return this.recipients(n.audience).length;
  }

  /** Start a guided bulk send of the notice over WhatsApp or SMS. */
  send(n: Notice, channel: 'wa' | 'sms') {
    const msg = this.notify.noticeMessage(n.title, n.body, n.type);
    const items = this.recipients(n.audience).map((r) => ({
      name: r.name,
      link: channel === 'wa' ? this.notify.whatsappLink(r.phone, msg) : this.notify.smsLink(r.phone, msg),
    }));
    this.bulk.start(items);
  }
}
