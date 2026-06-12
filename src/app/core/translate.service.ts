import { Injectable, Pipe, PipeTransform, inject, signal } from '@angular/core';
import { Lang } from './models';
import { DICT, TKey } from './translations';

const LANG_KEY = 'vidyasetu-lang';

@Injectable({ providedIn: 'root' })
export class TranslateService {
  readonly lang = signal<Lang>((localStorage.getItem(LANG_KEY) as Lang) || 'en');

  toggle() {
    this.setLang(this.lang() === 'te' ? 'en' : 'te');
  }

  setLang(lang: Lang) {
    this.lang.set(lang);
    localStorage.setItem(LANG_KEY, lang);
  }

  t(key: TKey): string {
    return DICT[this.lang()][key] ?? DICT.en[key] ?? key;
  }
}

/**
 * Usage in templates: {{ 'dashboard' | t }}.
 * Impure on purpose: a pure pipe memoizes by input key and would never re-run
 * when the language signal changes. The dictionary lookup is trivially cheap.
 */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  private i18n = inject(TranslateService);
  transform(key: TKey): string {
    return this.i18n.t(key);
  }
}
