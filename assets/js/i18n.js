/* kudyprojedu.cz – jazyky čeština / němčina / angličtina.
   Načítá se před core.js. API:
     KP.t(klíč, {param})      přeloží text; klíčem je český text nebo kód ('nav.x'). Chybí-li překlad, vrátí češtinu.
                              Parametry v textu: {n}, {name} … → KP.t('Dveře {n} cm', { n: 80 })
     KP.tx(text)              přeloží text z dat jen, když je ve slovníku (čísla nahradí #), jinak ho vrátí beze změny
     KP.plural(n, jeden, dva_až_čtyři, pět_a_víc)  vybere český tvar podle čísla a přeloží ho (němčina a angličtina mají jen 1 / víc)
     KP.lang()                aktuální jazyk: 'cs' | 'de' | 'en'
     KP.setLang(l)            uloží volbu (localStorage kp.lang) a znovu načte stránku s ?lang=
     KP.i18n.add({ 'český text': ['deutsch', 'english'] })   přidá slovník (víc souborů: assets/js/i18n/*.js)
     KP.i18n.apply(root)      přeloží statický obsah s atributy data-i18n a data-i18n-attr
     KP.i18n.num(x), KP.i18n.date('RRRR-MM-DD'), KP.i18n.locale()  formát čísel a dat podle jazyka
     KP.i18n.switcher()       HTML přepínače CZ / DE / EN
   Statický HTML:
     <h1 data-i18n>Český text</h1>                  klíčem je obsah prvku (může obsahovat značky <a>, <b> …)
     <p data-i18n="kód.klíče">…</p>                  vlastní klíč
     <input placeholder="Hledat" data-i18n-attr="placeholder,aria-label">   přeloží hodnoty uvedených atributů
   Názvy míst, adresy a citace z webů provozovatelů se nepřekládají. */
(function () {
  'use strict';
  const LANGS = ['cs', 'de', 'en'];
  const NAMES = { cs: 'Čeština', de: 'Deutsch', en: 'English' };
  const SHORT = { cs: 'CZ', de: 'DE', en: 'EN' };
  const D = Object.create(null);

  function readStored() { try { const v = localStorage.getItem('kp.lang'); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function writeStored(l) { try { localStorage.setItem('kp.lang', JSON.stringify(l)); } catch (e) { /* bez úložiště */ } }
  function detect() {
    let q = null;
    try { q = new URLSearchParams(location.search).get('lang'); } catch (e) { /* starý prohlížeč */ }
    if (q && LANGS.includes(q)) { writeStored(q); return q; }
    const s = readStored();
    return LANGS.includes(s) ? s : 'cs';
  }
  const LANG = detect();
  document.documentElement.setAttribute('lang', LANG);

  function add(dict) {
    Object.keys(dict || {}).forEach(k => {
      const v = dict[k];
      if (Array.isArray(v)) D[k] = v.length === 3 ? { cs: v[0], de: v[1], en: v[2] } : { de: v[0], en: v[1] };
      else if (v && typeof v === 'object') D[k] = v;
    });
  }
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function lookup(key) {
    const e = D[key] || D[norm(key)];
    if (LANG === 'cs') return e && e.cs != null ? e.cs : key;
    if (e && e[LANG] != null) return e[LANG];
    return e && e.cs != null ? e.cs : key;
  }
  function t(key, params) {
    if (key == null) return '';
    let s = lookup(String(key));
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined && params[k] !== null ? params[k] : m));
    return s;
  }
  function has(key) { const e = D[key]; return !!(e && (LANG === 'cs' ? true : e[LANG] != null)); }
  // Přeloží text z dat, jen když ho slovník zná (popisky naměřených údajů, krátké hodnoty). Čísla v textu se nahradí
  // znakem # a vrátí zpět: „WC 2: dveře“ → klíč „WC #: dveře“. Neznámý text (citace, názvy) zůstane beze změny.
  function tx(str) {
    if (str == null || LANG === 'cs') return str;
    const s = String(str);
    if (has(s)) return t(s);
    const nums = [];
    const k = s.replace(/\d+(?:[.,]\d+)?/g, (m) => { nums.push(m); return '#'; });
    if (nums.length && has(k)) { let i = 0; return t(k).replace(/#/g, () => (nums[i] !== undefined ? nums[i++] : '#')); }
    return s;
  }
  // České tvary: 1 → jeden, 2–4 → dva_až_čtyři, jinak pět_a_víc. Ostatní jazyky: 1 → jeden, jinak pět_a_víc.
  function plural(n, one, few, many) {
    const a = Math.abs(Number(n));
    if (LANG === 'cs') return t(a === 1 ? one : (a >= 2 && a <= 4 && Number.isInteger(a)) ? few : many);
    return t(a === 1 ? one : many);
  }
  function locale() { return LANG === 'cs' ? 'cs-CZ' : LANG === 'de' ? 'de-DE' : 'en-GB'; }
  // Desetinná čárka v češtině a němčině, tečka v angličtině
  function num(x) { const s = String(x); return LANG === 'en' ? s.replace(',', '.') : s.replace('.', ','); }
  const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function date(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    const mi = Number(m), di = Number(d);
    if (LANG === 'en') return d ? di + ' ' + MONTHS_EN[mi - 1] + ' ' + y : m ? MONTHS_EN[mi - 1] + ' ' + y : y;
    if (LANG === 'de') return d ? String(di).padStart(2, '0') + '.' + String(mi).padStart(2, '0') + '.' + y : m ? String(mi).padStart(2, '0') + '/' + y : y;
    return d ? di + '. ' + mi + '. ' + y : m ? mi + '/' + y : y;
  }

  // ---------- Statický obsah ----------
  function apply(root) {
    if (LANG === 'cs') return;
    const r = root || document;
    r.querySelectorAll('[data-i18n]').forEach(el => {
      if (el.__i18n) return;
      const key = el.getAttribute('data-i18n') || norm(el.textContent);
      el.__i18n = key;
      const tr = t(key);
      if (tr === key) return;
      if (/<[a-z]/i.test(tr)) { el.innerHTML = tr; return; }
      if (!el.children.length) { el.textContent = tr; return; }
      // Prvek s ikonou nebo značkou stavu: přeloží se jen text, vnořené prvky zůstanou
      const nodes = [...el.childNodes].filter(n => n.nodeType === 3 && /\S/.test(n.nodeValue));
      if (!nodes.length || norm([...el.children].map(c => c.textContent).join(''))) { el.innerHTML = esc(tr); return; }
      nodes.forEach((n, i) => { n.nodeValue = i ? '' : (/^\s/.test(n.nodeValue) ? ' ' : '') + tr + (/\s$/.test(n.nodeValue) ? ' ' : ''); });
    });
    r.querySelectorAll('[data-i18n-text]').forEach(el => {
      if (el.__i18nT) return; el.__i18nT = true;
      el.childNodes.forEach(n => {
        if (n.nodeType !== 3 || !/[A-Za-zÀ-ž]{2,}/.test(n.nodeValue)) return;
        const v = n.nodeValue, tr = t(norm(v));
        if (tr !== norm(v)) n.nodeValue = (/^\s/.test(v) ? ' ' : '') + tr + (/\s$/.test(v) ? ' ' : '');
      });
    });
    r.querySelectorAll('[data-i18n-attr]').forEach(el => {
      if (el.__i18nA) return; el.__i18nA = true;
      el.getAttribute('data-i18n-attr').split(',').forEach(spec => {
        const [attr, key] = spec.split(':').map(s => s && s.trim());
        if (!attr || !el.hasAttribute(attr)) return;
        el.setAttribute(attr, t(key || el.getAttribute(attr)));
      });
    });
    if (r === document) {
      // Titulek „Název stránky · kudyprojedu.cz“: přeloží se část před tečkou
      const parts = document.title.split(' · ');
      if (parts.length) { parts[0] = t(parts[0]); document.title = parts.join(' · '); }
      const md = document.querySelector('meta[name="description"]');
      if (md && has(md.content)) md.content = t(md.content);
    }
  }

  // ---------- Přepínač jazyka ----------
  function urlFor(l) {
    try { const u = new URL(location.href); u.searchParams.set('lang', l); return u.pathname.split('/').pop() + u.search + u.hash; } catch (e) { return '?lang=' + l; }
  }
  function setLang(l) {
    if (!LANGS.includes(l)) return;
    writeStored(l);
    location.href = urlFor(l);
  }
  function switcher(cls) {
    return '<div class="lang-switch' + (cls ? ' ' + cls : '') + '" role="group" aria-label="Jazyk · Sprache · Language">' +
      LANGS.map(l => '<a href="' + urlFor(l) + '" lang="' + l + '" hreflang="' + l + '" data-lang="' + l + '" title="' + NAMES[l] + '"' + (l === LANG ? ' aria-current="true"' : '') + '><span aria-hidden="true">' + SHORT[l] + '</span><span class="sr-only">' + NAMES[l] + '</span></a>').join('') + '</div>';
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('.lang-switch a[data-lang]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault(); setLang(a.getAttribute('data-lang'));
  });

  const KP = (window.KP = window.KP || {});
  KP.t = t; KP.tx = tx; KP.plural = plural; KP.lang = () => LANG; KP.setLang = setLang;
  KP.i18n = { add, apply, has, num, date, locale, switcher, LANGS, NAMES, SHORT, lang: LANG };
  if (window.KP_I18N_PENDING) { window.KP_I18N_PENDING.forEach(add); window.KP_I18N_PENDING = null; }
})();
