import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { SchoolService } from './school.service';
import { TranslateService } from './translate.service';

/**
 * Parent alerts via free click-to-send links (no paid gateway needed):
 * - WhatsApp: https://wa.me/<number>?text=<message> opens WhatsApp pre-filled.
 * - SMS: sms:<number>?body=<message> opens the phone's SMS app pre-filled.
 *
 * For fully-automated bulk sending later, swap these links for a Cloud Function
 * calling a gateway (MSG91 / WhatsApp Business API) — a paid add-on.
 */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private i18n = inject(TranslateService);
  private schoolSvc = inject(SchoolService);

  private school(): string {
    return this.schoolSvc.currentSchool()?.name ?? environment.schoolName;
  }

  private fill(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  }

  absenceMessage(name: string, classId: string, dateStr: string): string {
    return this.fill(this.i18n.t('absenceMsg'), { name, cls: classId, date: dateStr, school: this.school() });
  }

  feeMessage(name: string, classId: string, amount: number, dueDate: string): string {
    return this.fill(this.i18n.t('feeMsg'), { name, cls: classId, amt: amount, due: dueDate, school: this.school() });
  }

  /**
   * Progress report as a *designed* WhatsApp message — bold (*..*), an aligned
   * monospace marks table (```..```), emojis and separators. Auto-targets the
   * parent's number (free), and looks like a card rather than plain text.
   */
  reportMessage(info: {
    name: string;
    classId: string;
    roll: string;
    examLabel: string;
    marks: { subject: string; score: number; max: number }[];
    total: number;
    maxTotal: number;
    pct: number;
    rank: number;
    classSize: number;
    attPct: number | null;
    pass: boolean;
  }): string {
    const t = (k: Parameters<TranslateService['t']>[0]) => this.i18n.t(k);
    const sep = '━━━━━━━━━━━━━━';
    const w = Math.max(7, ...info.marks.map((m) => m.subject.length));
    const table = info.marks
      .map((m) => `${m.subject.padEnd(w)} ${String(m.score).padStart(3)}/${m.max}`)
      .join('\n');
    return [
      `🏫 *${this.school()}*`,
      `📋 *${t('reportCard')}* — ${info.examLabel}`,
      sep,
      `👤 *${info.name}*`,
      `${t('class')} ${info.classId}  •  ${t('rollNo')} ${info.roll}`,
      sep,
      '```',
      table,
      '```',
      `*${t('total')}:* ${info.total}/${info.maxTotal}  (*${info.pct}%*)`,
      `🏆 *${t('rank')}:* ${info.rank}/${info.classSize}`,
      `📅 *${t('attendanceLabel')}:* ${info.attPct === null ? '—' : info.attPct + '%'}`,
      `${info.pass ? '✅' : '❌'} *${t('resultLabel')}:* ${info.pass ? t('pass') : 'FAIL'}`,
      sep,
    ].join('\n');
  }

  /** 10-digit Indian numbers get a 91 country code for wa.me. */
  private intl(phone: string): string {
    const d = (phone || '').replace(/\D/g, '');
    return d.length === 10 ? `91${d}` : d;
  }

  whatsappLink(phone: string, message: string): string {
    return `https://wa.me/${this.intl(phone)}?text=${encodeURIComponent(message)}`;
  }

  smsLink(phone: string, message: string): string {
    const d = (phone || '').replace(/\D/g, '');
    return `sms:${d}?body=${encodeURIComponent(message)}`;
  }
}
