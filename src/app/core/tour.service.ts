import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';
import { TranslateService } from './translate.service';

interface TourStep {
  route: string;
  roles?: Role[]; // limit to these roles; absent → staff (HM + teacher)
  en: { title: string; desc: string };
  te: { title: string; desc: string };
}

const STEPS: TourStep[] = [
  {
    route: '/dashboard',
    en: { title: '📊 Dashboard', desc: 'Your live overview — today’s attendance %, class-wise bars, fees collected and teachers present. Everything updates in real time.' },
    te: { title: '📊 డాష్‌బోర్డ్', desc: 'ప్రత్యక్ష సమాచారం — నేటి హాజరు %, క్లాస్ వారీ, వసూలైన ఫీజు, హాజరైన టీచర్లు. అన్నీ లైవ్‌గా అప్‌డేట్ అవుతాయి.' },
  },
  {
    route: '/students',
    en: { title: '🧒 Students', desc: 'Add students one by one, or bulk-import a whole school from Excel. Tap View for the full profile (attendance, fees, results) or ✏️ Edit to update.' },
    te: { title: '🧒 విద్యార్థులు', desc: 'ఒక్కొక్కరిగా చేర్చండి లేదా Excel నుండి మొత్తం పాఠశాలను దిగుమతి చేయండి. పూర్తి వివరాలకు View, మార్చడానికి ✏️ Edit.' },
  },
  {
    route: '/attendance',
    en: { title: '✅ Attendance', desc: 'Class teachers mark daily attendance — tap “All Present”, then flip the few absentees. Send absence alerts to parents on WhatsApp instantly.' },
    te: { title: '✅ హాజరు', desc: 'క్లాస్ టీచర్లు రోజువారీ హాజరు వేస్తారు — “అందరూ హాజరు” నొక్కి, గైర్హాజరైన వారిని మార్చండి. తల్లిదండ్రులకు వాట్సాప్‌లో అలర్ట్‌లు పంపండి.' },
  },
  {
    route: '/marks',
    en: { title: '📝 Marks & Results', desc: 'Enter all subjects for the whole class in one grid. Split subjects into Theory/Lab. View the Result Sheet, then print or WhatsApp report cards.' },
    te: { title: '📝 మార్కులు & ఫలితాలు', desc: 'మొత్తం క్లాస్ మార్కులు ఒకే గ్రిడ్‌లో నమోదు చేయండి. సబ్జెక్ట్‌లను Theory/Lab గా విభజించండి. రిపోర్ట్ కార్డులను ప్రింట్/వాట్సాప్ చేయండి.' },
  },
  {
    route: '/fees',
    roles: ['headmaster'],
    en: { title: '💰 Fee Management', desc: 'Set each student’s fee (they can differ), and collect by installments — pay ₹500 today, the balance reduces automatically. Print or WhatsApp receipts.' },
    te: { title: '💰 ఫీజు నిర్వహణ', desc: 'ప్రతి విద్యార్థి ఫీజు సెట్ చేయండి, వాయిదాలుగా వసూలు చేయండి — ₹500 చెల్లిస్తే బ్యాలెన్స్ తగ్గుతుంది. రసీదులు ప్రింట్/వాట్సాప్.' },
  },
  {
    route: '/homework',
    en: { title: '📔 Homework / Diary', desc: 'Teachers post each class’s daily homework. Parents and students see it, and you can send it to all class parents on WhatsApp.' },
    te: { title: '📔 హోంవర్క్ / డైరీ', desc: 'టీచర్లు రోజువారీ హోంవర్క్ పెడతారు. తల్లిదండ్రులు, విద్యార్థులు చూస్తారు; వాట్సాప్‌లో పంపవచ్చు.' },
  },
  {
    route: '/notices',
    en: { title: '📢 Notice Board', desc: 'Post notices and broadcast them to all parents and/or teachers over WhatsApp and SMS — sent in batches of 45.' },
    te: { title: '📢 నోటీసు బోర్డు', desc: 'నోటీసులు పెట్టి తల్లిదండ్రులు/టీచర్లకు వాట్సాప్, SMS ద్వారా పంపండి — 45 బ్యాచ్‌లుగా.' },
  },
  {
    route: '/reports',
    roles: ['headmaster'],
    en: { title: '📈 Reports', desc: 'Fee, attendance and exam reports for every class, with overall totals. Export any report to Excel or PDF.' },
    te: { title: '📈 రిపోర్టులు', desc: 'ప్రతి క్లాస్‌కు ఫీజు, హాజరు, పరీక్ష రిపోర్టులు. ఏదైనా రిపోర్ట్‌ను Excel/PDF గా ఎక్స్‌పోర్ట్ చేయండి.' },
  },
  {
    route: '/users',
    roles: ['headmaster'],
    en: { title: '👥 Users & Setup', desc: 'Create teacher/parent logins, assign class teachers, disable access if a teacher leaves, and manage your school’s classes — all here.' },
    te: { title: '👥 వినియోగదారులు & సెటప్', desc: 'టీచర్/పేరెంట్ లాగిన్‌లు సృష్టించండి, క్లాస్ టీచర్లను కేటాయించండి, యాక్సెస్ నిలిపివేయండి, క్లాసులు నిర్వహించండి.' },
  },
  {
    route: '/dashboard',
    en: { title: '🎉 You’re all set!', desc: 'That’s VidyaSetu — bilingual, installable on phones as an app, with WhatsApp built in. Explore freely; this tour is always here under “Take a tour”.' },
    te: { title: '🎉 సిద్ధం!', desc: 'ఇదే విద్యాసేతు — ద్విభాషా, ఫోన్‌లో యాప్‌గా, వాట్సాప్‌తో. స్వేచ్ఛగా అన్వేషించండి; “టూర్” ఎప్పుడైనా ఇక్కడ ఉంటుంది.' },
  },
];

@Injectable({ providedIn: 'root' })
export class TourService {
  private router = inject(Router);
  private auth = inject(AuthService);
  private i18n = inject(TranslateService);

  private steps = signal<TourStep[]>([]);
  readonly index = signal(0);
  readonly active = signal(false);

  readonly total = computed(() => this.steps().length);
  readonly current = computed(() => {
    const s = this.steps()[this.index()];
    if (!s) return null;
    return this.i18n.lang() === 'te' ? s.te : s.en;
  });
  readonly isLast = computed(() => this.index() >= this.steps().length - 1);

  /** Only the Head Master / Teacher can take the tour. */
  readonly canTour = computed(() => {
    const r = this.auth.role();
    return r === 'headmaster' || r === 'teacher';
  });

  start() {
    const role = this.auth.role();
    const steps = STEPS.filter((s) => !s.roles || (role && s.roles.includes(role)));
    if (!steps.length) return;
    this.steps.set(steps);
    this.index.set(0);
    this.active.set(true);
    void this.router.navigateByUrl(steps[0].route);
  }

  next() {
    if (this.isLast()) {
      this.stop();
      return;
    }
    this.index.update((i) => i + 1);
    void this.router.navigateByUrl(this.steps()[this.index()].route);
  }

  prev() {
    if (this.index() === 0) return;
    this.index.update((i) => i - 1);
    void this.router.navigateByUrl(this.steps()[this.index()].route);
  }

  stop() {
    this.active.set(false);
  }
}
