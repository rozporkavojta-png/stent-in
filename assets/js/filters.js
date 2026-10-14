/* Wherethru – sdílené filtrování míst (mapa.html, ubytovani.html).
   KPFilters.create(opts) → ctrl: stav filtrů, vyhledávací pole s tlačítkem Filtry, řada kategorií s ikonami, rychlé čipy
   přístupnosti, panel Filtry (PC postranní panel nebo sloupec, mobil spodní panel s úchytem), řada aktivních filtrů,
   filtry v URL (sdílitelné, Zpět funguje) a zapamatování posledních filtrů v prohlížeči.
   Počty se počítají jen ze skutečných načtených dat jedním průchodem (ctrl.run(list)), stránka si výsledky vykreslí sama.
   Údaje, které z dat neznáme (rozměry, výtah, sprcha…), filtr nesplní: místo bez údaje se při zapnutém filtru skryje.
   Členství (prototyp): Rozměry a vybavení = KP.requireTier('advancedFilters'), „Jen vyhovující mým potřebám“ = 'match'. */
(function () {
  'use strict';
  const K = window.KP;
  const T = (s, p) => K.t(s, p);
  const esc = (s) => K.esc(s);
  const W_ALL = ['yes', 'limited', 'no', 'null'];
  const W_DEF = ['yes', 'limited'];
  const SRC = ['mer', 'web', 'open', 'osm'];
  const BOOL = ['wc', 'pk', 'lift', 'ek', 'img', 'desc', 'chk', 'room', 'shower', 'bars', 'contact'];
  const TIER_OF = { door: 'advancedFilters', shower: 'advancedFilters', bars: 'advancedFilters', needsOnly: 'match' };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ---------- Vlastnosti místa (jen ze skutečných údajů) ----------
  const hasX = (p) => Array.isArray(p.x) && p.x.length > 0;
  const hasR = (p) => Array.isArray(p.r) && p.r.some(r => r && typeof r === 'object');
  const isOsm = (p) => /^[nwr]\d+$/.test(p.i);
  let BIZ = null; // místa s profilem podniku vyplněným v tomto prohlížeči (jejich údaje zná KP.facts)
  function bizSet() { if (!BIZ) BIZ = new Set(Object.keys(K.store.get('bizprofiles', {}) || {})); return BIZ; }
  // Podrobné údaje (výtah, rozměry, koupelna) mají jen místa s otevřenými daty, rešerší webu nebo profilem podniku;
  // u ostatních KP.facts nevolá, aby filtr nad desítkami tisíc míst zůstal rychlý.
  const rich = (p) => hasX(p) || hasR(p) || p.dw != null || bizSet().has(p.i);
  const fx = (p) => (rich(p) ? K.facts(p) : null);
  const isYes = (c) => !!c && c.v === true;
  const DIM_UNITS = { cm: 1, '%': 1 };
  const A = {
    step: (p) => p.w === 'yes',
    wc: (p) => p.t === 'yes',
    pk: (p) => !!(p.pk || p.pw === 'yes'),
    lift: (p) => { const f = fx(p); const c = f && f.f.vytah; return !!c && (c.v === true || c.v === 'na'); },
    ek: (p) => p.ek === 'yes',
    img: (p) => !!p.img,
    desc: (p) => !!p.d,
    contact: (p) => !!(p.web || p.ph),
    chk: (p) => !!p.cd,
    room: (p) => { const f = fx(p); return !!f && isYes(f.f.pokojBb); },
    shower: (p) => { const f = fx(p); return !!f && isYes(f.f.sprcha); },
    bars: (p) => { const f = fx(p); return !!f && (isYes(f.f.wcMadla) || isYes(f.f.koupelnaMadla)); },
    // Naměřeno = aspoň jeden rozměr (cm, %) z otevřených dat s měřením
    mer: (p) => {
      if (!hasX(p)) return false;
      if (p._mer !== undefined) return p._mer;
      const m = K.facts(p).m; let ok = false;
      for (const k in m) if (m[k].src === 'overeno' && DIM_UNITS[m[k].unit]) { ok = true; break; }
      try { Object.defineProperty(p, '_mer', { value: ok, configurable: true, writable: true, enumerable: false }); } catch (e) { /* nic */ }
      return ok;
    },
    web: hasR, open: hasX, osm: isOsm,
  };
  function doorOk(p, min) { const f = fx(p); if (!f) return false; const d = f.m.dvereCm || f.m.pruchodyCm; return !!d && d.v >= min; }

  // ---------- Popisky ----------
  function L() {
    return {
      step: T('Vstup bez schodů'), wc: T('WC pro vozíčkáře'), pk: T('Parkování ZTP'), lift: T('Výtah'), ek: T('Euroklíč u WC'),
      img: T('S fotkou'), desc: T('Slovní popis přístupnosti'), contact: T('Má web nebo telefon'), chk: T('Kontrola na místě'), room: T('Bezbariérový pokoj'),
      shower: T('Sprcha v úrovni podlahy'), bars: T('Madla u WC nebo v koupelně'),
      mer: T('Naměřeno'), web: T('Z webu provozovatele'), open: T('Otevřená data'), osm: 'OpenStreetMap',
      needsOnly: T('Jen vyhovující mým potřebám'),
    };
  }
  const QUICK_ICON = { step: 'step-free', wc: 'wc-accessible', pk: 'parking-ztp', lift: 'lift', mer: 'ruler', img: 'camera', room: 'room-accessible', web: 'building', shower: 'shower' };
  const SRC_HINT = () => ({
    mer: T('Rozměry v cm z otevřených dat s měřením (Mapy bez bariér, města, DB)'),
    web: T('Údaj jsme přečetli na webu provozovatele, neověřili jsme ho na místě'),
    open: T('Otevřená data měst a institucí'),
    osm: T('Zadali dobrovolníci do OpenStreetMap'),
  });

  function defaults() {
    return { q: '', cats: new Set(), typ: new Set(), w: new Set(W_DEF), wc: false, pk: false, lift: false, ek: false, img: false, desc: false, chk: false,
      room: false, shower: false, bars: false, contact: false, door: '', src: new Set(), zeme: '', kraj: '', obec: '', needsOnly: false };
  }
  const wIsDefault = (w) => w.size === W_DEF.length && W_DEF.every(x => w.has(x));
  const wIsStep = (w) => w.size === 1 && w.has('yes');

  // ---------- URL ----------
  const KNOWN = ['q', 'kat', 'typ', 'vstup', 'wc', 'pk', 'vytah', 'euro', 'foto', 'popis', 'kontrola', 'pokoj', 'sprcha', 'madla', 'dvere', 'zdroj', 'zeme', 'kraj', 'obec', 'potreby', 'kontakt', 'namereno', 'provozovatel'];
  const W_OLD = { yl: ['yes', 'limited'], y: ['yes'], l: ['limited'], u: ['null'], n: ['no'], all: W_ALL };
  const W_CODE = { yes: 'ano', limited: 'castecne', no: 'ne', null: 'neuvedeno' };
  const W_UNCODE = { ano: 'yes', castecne: 'limited', ne: 'no', neuvedeno: 'null' };
  const B_URL = { wc: 'wc', pk: 'pk', lift: 'vytah', ek: 'euro', img: 'foto', desc: 'popis', chk: 'kontrola', room: 'pokoj', shower: 'sprcha', bars: 'madla', contact: 'kontakt' };

  function toParams(s, cfg) {
    const sp = new URLSearchParams();
    if (s.q) sp.set('q', s.q);
    if (s.cats.size) sp.set('kat', [...s.cats].join(','));
    if (s.typ.size) sp.set('typ', [...s.typ].join('|'));
    if (!wIsDefault(s.w)) sp.set('vstup', s.w.size ? W_ALL.filter(x => s.w.has(x)).map(x => W_CODE[x]).join(',') : 'zadny');
    BOOL.forEach(k => { if (s[k]) sp.set(B_URL[k], '1'); });
    if (s.door) sp.set('dvere', s.door);
    if (s.src.size) sp.set('zdroj', SRC.filter(x => s.src.has(x)).join(','));
    if (s.zeme) sp.set('zeme', s.zeme);
    if (s.kraj) sp.set('kraj', s.kraj);
    if (s.obec) sp.set('obec', s.obec);
    if (s.needsOnly) sp.set('potreby', '1');
    return sp;
  }
  function fromParams(sp, cfg) {
    const s = defaults();
    if (sp.get('q')) s.q = sp.get('q');
    (sp.get('kat') || '').split(',').forEach(c => { if (K.CATS[c]) s.cats.add(c); });
    (sp.get('typ') || '').split('|').forEach(c => { if (c) s.typ.add(c); });
    const v = sp.get('vstup');
    if (v) {
      if (W_OLD[v]) s.w = new Set(W_OLD[v]);
      else if (v === 'zadny') s.w = new Set();
      else { const ws = v.split(',').map(x => W_UNCODE[x]).filter(Boolean); if (ws.length) s.w = new Set(ws); }
    }
    BOOL.forEach(k => { if (sp.get(B_URL[k]) === '1') s[k] = true; });
    if (['70', '80', '90'].includes(sp.get('dvere'))) s.door = sp.get('dvere');
    (sp.get('zdroj') || '').split(',').forEach(x => { if (SRC.includes(x)) s.src.add(x); });
    if (sp.get('namereno') === '1') s.src.add('mer');
    if (sp.get('provozovatel') === '1') s.src.add('web');
    if (K.ZEME[sp.get('zeme')]) s.zeme = sp.get('zeme');
    if (sp.get('kraj')) s.kraj = sp.get('kraj');
    if (sp.get('obec')) s.obec = sp.get('obec');
    if (sp.get('potreby') === '1') s.needsOnly = true;
    return s;
  }
  const hasKnown = (sp) => KNOWN.some(k => sp.has(k));
  function serialize(s) { const o = toParams(s); o.delete('q'); return o.toString(); }

  // ---------- Řazení ----------
  const COLL = new Intl.Collator(K.LANG === 'cs' ? 'cs' : K.LANG);
  const RANK = { yes: 0, limited: 1, null: 2, no: 3 };
  const comp = (p) => (p._c ?? (p._c = K.completeness(p)));
  function sortList(list, by, ctx) {
    const c = (ctx && ctx.center) || null;
    const name = (a, b) => COLL.compare(a.n, b.n);
    if (by === 'near' && c) {
      const d = new Map(); list.forEach(p => d.set(p, K.distanceKm(c, p)));
      return list.slice().sort((a, b) => d.get(a) - d.get(b));
    }
    if (by === 'match') {
      const needs = K.getNeeds();
      if (needs.active && K.hasTier('match')) {
        const sc = new Map(); list.forEach(p => { const m = K.matchScore(p, needs); sc.set(p, m.pct === null ? -1 : m.pct); });
        return list.slice().sort((a, b) => sc.get(b) - sc.get(a) || comp(b) - comp(a) || name(a, b));
      }
    }
    const f = {
      photo: (a, b) => (!!b.img - !!a.img) || comp(b) - comp(a) || name(a, b),
      measured: (a, b) => (A.mer(b) - A.mer(a)) || (hasX(b) - hasX(a)) || comp(b) - comp(a) || name(a, b),
      access: (a, b) => RANK[String(a.w || 'null')] - RANK[String(b.w || 'null')] || (b.t === 'yes') - (a.t === 'yes') || hasR(b) - hasR(a) || comp(b) - comp(a) || name(a, b),
      fresh: (a, b) => (b.u || '').localeCompare(a.u || '') || name(a, b),
      name,
      obec: (a, b) => COLL.compare(a.o || '', b.o || '') || name(a, b),
    }[by] || ((a, b) => comp(b) - comp(a) || name(a, b));
    return list.slice().sort(f);
  }

  // ---------- Karta místa ve výsledcích ----------
  // opts.mode 'button' (mapa: vybere místo) | 'link' (detail); opts.active = id vybraného místa
  function cardHtml(p, opts) {
    const o = opts || {};
    const st = K.generalStatus(p);
    const cat = K.CATS[p.c] || { icon: 'pin', label: '' };
    const needs = K.getNeeds();
    const m = needs.active && K.hasTier('match') ? K.matchScore(p, needs) : null;
    const saved = K.saved.has(p.i);
    const media = p.img
      ? '<span class="rc-media"><img src="' + esc(K.commonsImg(p.img, 240)) + '" alt="" loading="lazy" decoding="async" width="120" height="90"></span>'
      : '<span class="rc-media no-photo" aria-hidden="true">' + K.icon(cat.icon) + '</span>';
    const access = p.c === 'parkovani' ? '' : '<span class="rc-access ' + st + '" aria-hidden="true">' + K.icon('wheel') + '</span>';
    const facts = [];
    if (p.c === 'parkovani') facts.push('<span class="fact">' + K.icon('parking-ztp') + (p.pk ? T('Stání pro ZTP: {n}', { n: K.nf(p.pk) }) : T('Parkování pro ZTP')) + '</span>');
    else {
      const w = K.W[p.w || 'null'];
      facts.push(K.statusHtml(w.st, T('Vstup') + ': ' + K.lc(w.short)));
      if (p.t) facts.push(K.statusHtml(K.T[p.t].st, K.T[p.t].label));
      if (p.pk) facts.push('<span class="plain">' + K.icon('parking-ztp') + K.nf(p.pk) + ' ' + T('× parkování ZTP') + '</span>');
    }
    const tags = [];
    if (A.mer(p)) tags.push('<span class="badge badge-verified" title="' + esc(SRC_HINT().mer) + '">' + K.icon('ruler') + esc(T('Naměřeno')) + '</span>');
    else if (hasX(p)) tags.push('<span class="badge badge-community" title="' + esc(SRC_HINT().open) + '">' + K.icon('shield') + esc(T('Otevřená data')) + '</span>');
    if (hasR(p)) tags.push('<span class="badge badge-business" title="' + esc(SRC_HINT().web) + '">' + K.icon('building') + esc(T('Z webu provozovatele')) + '</span>');
    if (m) tags.push('<span class="rc-match">' + K.statusHtml(m.status, m.pct === null ? T('Shoda neznámá, chybí údaje') : T('{pct} % shoda · známe {k} z {n}', { pct: m.pct, k: m.known, n: m.total })) + '</span>');
    const meta = [p.s && K.t(p.s), p.o, K.zemeOf(p) === 'de' && o.showCountry ? T('Bavorsko') : ''].filter(Boolean).map(esc).join(' · ');
    const src = hasX(p) ? (p.x[0].label ? (window.KP.tx ? window.KP.tx(p.x[0].label) : p.x[0].label) : T('Otevřená data')) : isOsm(p) ? T('OpenStreetMap') : hasR(p) ? T('Web provozovatele') : '';
    const title = o.mode === 'button'
      ? '<button type="button" class="rc-hit" data-id="' + esc(p.i) + '">' + esc(p.n) + '</button>'
      : '<a class="rc-hit" href="' + K.placeUrl(p) + '">' + esc(p.n) + '</a>';
    return '<li><article class="rc' + (o.active === p.i ? ' is-active' : '') + '" data-card="' + esc(p.i) + '">' + media + access +
      '<div class="rc-body"><h3>' + title + '</h3>' + (meta ? '<p class="rc-meta">' + meta + '</p>' : '') +
      '<p class="rc-facts">' + facts.join('') + '</p>' + (tags.length ? '<p class="rc-tags">' + tags.join('') + '</p>' : '') +
      (src ? '<p class="rc-src">' + esc(T('Zdroj')) + ': ' + esc(src) + (p.img ? ' · ' + esc(T('Foto: Wikimedia Commons')) : '') + '</p>' : '') + '</div>' +
      '<button type="button" class="rc-save" data-save="' + esc(p.i) + '" aria-pressed="' + saved + '" aria-label="' + esc((saved ? T('Odebrat z uložených') : T('Uložit')) + ': ' + p.n) + '">' + K.icon(saved ? 'heart-filled' : 'heart') + '</button>' +
      '</article></li>';
  }
  // Srdíčko: uložení přes KP.saved (ve Free nejvýš 5 míst, nad limit nabídne Explorer); počet v hlavičce řeší core.js
  function bindSave(root, getPlace) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-save]'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      const id = b.dataset.save, p = getPlace(id);
      const on = K.saved.toggle(id, p);
      if (!K.saved.blocked) K.toast(on ? T('Místo uloženo do profilu.') : T('Místo odebráno z uložených.'));
    });
  }
  function syncSaves(root) {
    (root || document).querySelectorAll('[data-save]').forEach(b => {
      const on = K.saved.has(b.dataset.save);
      if ((b.getAttribute('aria-pressed') === 'true') === on) return;
      b.setAttribute('aria-pressed', on);
      const name = b.getAttribute('aria-label').replace(/^[^:]*:\s*/, '');
      b.setAttribute('aria-label', (on ? T('Odebrat z uložených') : T('Uložit')) + ': ' + name);
      b.innerHTML = K.icon(on ? 'heart-filled' : 'heart');
    });
  }
  document.addEventListener('kp:saved', () => syncSaves());

  // ---------- Ovladač ----------
  function create(opts) {
    const cfg = Object.assign({
      id: 'mapa', quick: ['step', 'wc', 'pk', 'lift', 'mer', 'img'], catMode: 'cats', unit: ['místo', 'místa', 'míst'],
      sections: ['cats', 'access', 'adv', 'source', 'more', 'area', 'needs'], panelMode: () => 'dialog', obecMode: 'input',
      areaOptions: () => ({ kraje: [], obce: [] }), onChange: () => {}, getPlace: (id) => K.placeById(id),
    }, opts || {});
    const el = cfg.els; // { search, form, filterBtn, cats, quick, active, panelHost }
    let state = defaults();
    let counts = { cat: {}, typ: {}, w: {}, src: {}, b: {}, relax: {}, total: 0, base: 0 };
    let lastSaved = '';
    const LB = L();

    // Stav z URL, jinak poslední uložené filtry (bez hledaného textu)
    const sp = new URLSearchParams(location.search);
    if (hasKnown(sp)) state = fromParams(sp, cfg);
    else {
      const saved = K.store.get('filters.' + cfg.id, null);
      if (saved && typeof saved === 'string') { state = fromParams(new URLSearchParams(saved), cfg); state.q = ''; }
    }
    const h = location.hash.slice(1);
    if (cfg.catMode === 'cats' && h && K.CATS[h]) state.cats.add(h);
    dropLocked();

    function dropLocked() {
      if (!K.hasTier('advancedFilters')) { state.door = ''; state.shower = false; state.bars = false; }
      if (!K.hasTier('match')) state.needsOnly = false;
    }

    // ---------- Průchod daty: výsledky + počty pro každou skupinu filtrů ----------
    function groups() {
      const s = state, g = [];
      const q = norm(s.q.trim());
      if (q) g.push(['q', (p) => (p._s || (p._s = norm(p.n + ' ' + (p.o || '') + ' ' + (p.a || '') + ' ' + (p.s ? p.s + ' ' + K.t(p.s) : '')))).includes(q)]);
      if (s.cats.size) g.push(['cats', (p) => s.cats.has(p.c)]);
      if (s.typ.size) g.push(['typ', (p) => s.typ.has(p.s)]);
      if (!(s.w.size === 4)) g.push(['w', (p) => p.c === 'parkovani' || s.w.has(String(p.w || 'null'))]);
      if (s.zeme) g.push(['zeme', (p) => K.zemeOf(p) === s.zeme]);
      if (s.kraj) g.push(['kraj', (p) => p.k === s.kraj]);
      if (s.obec) { const o = norm(s.obec); g.push(['obec', (p) => norm(p.o) === o]); }
      ['wc', 'pk', 'ek', 'img', 'desc', 'chk', 'contact'].forEach(k => { if (s[k]) g.push([k, A[k]]); });
      if (s.src.size) { const ks = [...s.src]; g.push(['src', (p) => ks.some(k => A[k](p))]); }
      ['lift', 'room'].forEach(k => { if (s[k]) g.push([k, A[k]]); });
      const adv = K.hasTier('advancedFilters');
      if (adv && s.door) { const min = Number(s.door); g.push(['door', (p) => doorOk(p, min)]); }
      if (adv && s.shower) g.push(['shower', A.shower]);
      if (adv && s.bars) g.push(['bars', A.bars]);
      const needs = K.getNeeds();
      if (s.needsOnly && needs.active && K.hasTier('match')) g.push(['needsOnly', (p) => K.match(p, needs).status === 'ok']);
      return g;
    }
    const TALLY_B = ['wc', 'pk', 'ek', 'img', 'desc', 'chk', 'lift', 'room', 'shower', 'bars', 'contact'];
    function run(list) {
      BIZ = null;
      const g = groups(), n = g.length;
      const C = { cat: {}, typ: {}, w: {}, src: {}, b: {}, relax: {}, total: 0, base: list.length };
      const out = [];
      const wantRoom = cfg.sections.includes('room');
      const tallyAll = (p, only) => {
        if (!only || only === 'cats') C.cat[p.c] = (C.cat[p.c] || 0) + 1;
        if (!only || only === 'typ') { if (p.s) C.typ[p.s] = (C.typ[p.s] || 0) + 1; }
        if (!only || only === 'w') { if (p.c !== 'parkovani') { const w = String(p.w || 'null'); C.w[w] = (C.w[w] || 0) + 1; } }
        if (!only || only === 'src') SRC.forEach(k => { if (A[k](p)) C.src[k] = (C.src[k] || 0) + 1; });
        if (!only) {
          for (const k of TALLY_B) {
            if (k === 'room' && !wantRoom) continue;
            if (A[k](p)) C.b[k] = (C.b[k] || 0) + 1;
          }
          if (A.step(p)) C.b.step = (C.b.step || 0) + 1;
        }
      };
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        let fail = -1, fails = 0;
        for (let j = 0; j < n; j++) { if (!g[j][1](p)) { fails++; fail = j; if (fails > 1) break; } }
        if (fails === 0) { out.push(p); tallyAll(p, null); }
        else if (fails === 1) {
          const key = g[fail][0];
          C.relax[key] = (C.relax[key] || 0) + 1;
          if (key === 'cats' || key === 'typ' || key === 'w' || key === 'src') tallyAll(p, key);
        }
      }
      C.total = out.length;
      counts = C;
      syncCounts();
      return out;
    }

    // ---------- Změna stavu ----------
    let tm = null, pendingPush = false, pendingX = null;
    const PRIO = { kraj: 3, zeme: 3, obec: 3, pop: 4, reset: 4 };
    function changed(o) {
      let x = o || {};
      if (x.push) pendingPush = true;
      // Při několika změnách za sebou dostane stránka tu nejdůležitější (změna oblasti načítá data)
      if (pendingX && (PRIO[pendingX.key] || 0) > (PRIO[x.key] || 0)) x = pendingX;
      pendingX = x;
      clearTimeout(tm);
      const go = () => { pendingX = null; writeUrl(pendingPush); pendingPush = false; syncUi(); cfg.onChange(x); };
      // Stisk se ukáže hned, přepočet nad daty proběhne jednou i po několika rychlých kliknutích za sebou
      if (!x.delay) syncUi();
      tm = setTimeout(go, x.delay || 40);
    }
    function writeUrl(push) {
      const cur = new URLSearchParams(location.search), next = toParams(state, cfg);
      cur.forEach((v, k) => { if (!KNOWN.includes(k)) next.set(k, v); });
      const qs = next.toString(), url = location.pathname + (qs ? '?' + qs : '') + location.hash;
      if (url !== location.pathname + location.search + location.hash) {
        try { history[push ? 'pushState' : 'replaceState']({ kpf: 1 }, '', url); } catch (e) { /* bez historie */ }
      }
      const ser = serialize(state);
      if (ser !== lastSaved) { lastSaved = ser; K.store.set('filters.' + cfg.id, ser); }
    }
    addEventListener('popstate', () => {
      state = fromParams(new URLSearchParams(location.search), cfg); dropLocked();
      if (el.search) el.search.value = state.q;
      syncUi(); cfg.onChange({ key: 'pop' });
    });

    // Zapnutí filtru; u funkce Explorer bez úrovně se otevře panel s vysvětlením (prototyp, nic se neplatí)
    function set(k, val, o) {
      const feat = TIER_OF[k];
      const after = () => { if (k === 'needsOnly' && state.needsOnly && !K.getNeeds().active) K.needsDrawer(); };
      if (val && feat && !K.hasTier(feat)) {
        syncUi();
        K.requireTier(feat, () => { state[k] = val; changed(Object.assign({ key: k, push: true }, o)); after(); });
        return;
      }
      state[k] = val; changed(Object.assign({ key: k, push: true }, o)); after();
    }
    function toggleIn(setKey, v) { const s = state[setKey]; s.has(v) ? s.delete(v) : s.add(v); changed({ key: setKey, push: true }); }
    function setStep(on) { state.w = new Set(on ? ['yes'] : W_DEF); changed({ key: 'w', push: true }); }
    function reset(keepArea) {
      const q = state.q, area = { zeme: state.zeme, kraj: state.kraj, obec: state.obec };
      state = defaults(); state.q = q;
      if (keepArea) Object.assign(state, area);
      changed({ key: 'reset', push: true });
    }
    function clearKey(k, v) {
      if (k === 'q') { state.q = ''; if (el.search) el.search.value = ''; }
      else if (k === 'cats' || k === 'typ' || k === 'src') state[k].delete(v);
      else if (k === 'w') state.w = new Set(W_DEF);
      else if (k === 'door') state.door = '';
      else if (k === 'zeme' || k === 'kraj' || k === 'obec') state[k] = '';
      else state[k] = false;
      changed({ key: k, push: true });
    }

    // ---------- Aktivní filtry ----------
    function activeList() {
      const s = state, a = [];
      if (s.q) a.push(['q', '', '„' + s.q + '“']);
      s.cats.forEach(c => a.push(['cats', c, (K.CATS[c] || {}).label || c]));
      s.typ.forEach(c => a.push(['typ', c, K.t(c)]));
      if (!wIsDefault(s.w)) a.push(['w', '', wIsStep(s.w) ? LB.step : T('Vstup') + ': ' + (s.w.size ? W_ALL.filter(x => s.w.has(x)).map(x => K.lc(K.W[x].short)).join(', ') : T('nic'))]);
      ['wc', 'pk', 'lift', 'ek', 'room'].forEach(k => { if (s[k]) a.push([k, '', LB[k]]); });
      SRC.forEach(k => { if (s.src.has(k)) a.push(['src', k, LB[k]]); });
      ['img', 'desc', 'chk', 'contact'].forEach(k => { if (s[k]) a.push([k, '', LB[k]]); });
      if (s.door) a.push(['door', '', T('Dveře alespoň {n} cm', { n: s.door })]);
      ['shower', 'bars'].forEach(k => { if (s[k]) a.push([k, '', LB[k]]); });
      if (s.zeme) a.push(['zeme', '', K.ZEME[s.zeme]]);
      if (s.kraj) a.push(['kraj', '', K.LANG === 'cs' ? s.kraj : K.krajName(s.kraj)]);
      if (s.obec) a.push(['obec', '', s.obec]);
      if (s.needsOnly) a.push(['needsOnly', '', LB.needsOnly]);
      return a;
    }
    function activeCount() { return activeList().filter(x => x[0] !== 'q').length; }

    // ---------- Vykreslení ovládacích prvků ----------
    const catDefs = () => cfg.catMode === 'typ'
      ? Object.keys(counts.typ).sort((a, b) => counts.typ[b] - counts.typ[a]).map(k => ({ k, label: K.t(k), icon: typIcon(k) }))
      : Object.keys(K.CATS).map(k => ({ k, label: K.CATS[k].label, icon: K.CATS[k].icon }));
    function typIcon(s) { return /kemp|karavan/i.test(s) ? 'tree' : /chata/i.test(s) ? 'mountain' : /hotel|motel/i.test(s) ? 'hotel' : 'bed'; }
    let catSig = '';
    function renderCats() {
      if (!el.cats) return;
      const defs = catDefs(), setKey = cfg.catMode === 'typ' ? 'typ' : 'cats';
      const sig = defs.map(d => d.k).join('|');
      if (sig !== catSig) {
        catSig = sig;
        el.cats.innerHTML = '<button type="button" class="kf-cat" data-kf-cat="" aria-pressed="false">' + K.icon('layers') + '<span>' + esc(T('Vše')) + '</span></button>' +
          defs.map(d => '<button type="button" class="kf-cat" data-kf-cat="' + esc(d.k) + '" aria-pressed="false">' + K.icon(d.icon) + '<span>' + esc(d.label) + '</span></button>').join('');
      }
      const sel = state[setKey];
      el.cats.querySelectorAll('[data-kf-cat]').forEach(b => {
        const k = b.dataset.kfCat;
        b.setAttribute('aria-pressed', k ? sel.has(k) : !sel.size);
        const n = k ? (setKey === 'typ' ? counts.typ[k] : counts.cat[k]) : null;
        b.title = n != null ? (K.nf(n || 0) + ' ' + K.plural(n || 0, cfg.unit[0], cfg.unit[1], cfg.unit[2])) : '';
      });
    }
    function renderQuick() {
      if (!el.quick) return;
      if (!el.quick.childElementCount) {
        el.quick.innerHTML = cfg.quick.map(k => '<button type="button" class="chip kf-q" data-kf-q="' + k + '" aria-pressed="false">' + K.icon(QUICK_ICON[k] || 'check') + '<span>' + esc(LB[k]) + '</span></button>').join('');
      }
      el.quick.querySelectorAll('[data-kf-q]').forEach(b => {
        const k = b.dataset.kfQ;
        const on = k === 'step' ? wIsStep(state.w) : SRC.includes(k) ? state.src.has(k) : !!state[k];
        b.setAttribute('aria-pressed', on);
      });
    }
    function renderActive() {
      const list = activeList();
      const n = activeCount();
      if (el.filterCount) { el.filterCount.hidden = !n; el.filterCount.textContent = n; }
      if (el.filterBtn) el.filterBtn.setAttribute('aria-label', n ? T('Filtry, zapnuto {n}', { n }) : T('Filtry'));
      if (!el.active) return;
      el.active.hidden = !list.length;
      el.active.innerHTML = list.length ? '<span class="kf-active-l">' + esc(T('Filtry')) + ':</span>' + list.map(([k, v, l]) =>
        '<button type="button" class="kf-pill" data-kf-clear="' + k + '" data-v="' + esc(v) + '" aria-label="' + esc(T('Zrušit filtr {f}', { f: l })) + '"><span>' + esc(l) + '</span>' + K.icon('close') + '</button>').join('') +
        (list.length > 1 ? '<button type="button" class="kf-clear-all" data-kf-reset>' + esc(T('Zrušit vše')) + '</button>' : '') : '';
    }

    // Panel Filtry
    const P = {};
    let panelBuilt = false, lastFocus = null, isOpen = false;
    function sec(id, title, body, badge) {
      return '<fieldset class="kf-sec" id="kf-sec-' + id + '"><legend><span>' + esc(title) + '</span>' + (badge || '') + '</legend>' + body + '</fieldset>';
    }
    const opt = (type, name, val, label, icon, nKey, extra) => '<label class="kf-opt"><input type="' + type + '" name="' + name + '" value="' + esc(val) + '"' + (extra || '') + '>' +
      (icon ? K.icon(icon) : '') + '<span class="t">' + label + '</span>' + (nKey ? '<span class="n" data-kf-n="' + nKey + '"></span>' : '') + '</label>';
    function buildPanel() {
      const host = el.panelHost; if (!host) return;
      const S = cfg.sections, H = SRC_HINT();
      let body = '';
      if (S.includes('cats')) body += sec('cats', T('Kategorie'), '<div class="kf-grid" id="kf-p-cats">' + Object.keys(K.CATS).map(k => opt('checkbox', 'kf-cat', k, esc(K.CATS[k].label), K.CATS[k].icon, 'cat:' + k)).join('') + '</div>');
      if (S.includes('typ')) body += sec('typ', T('Druh ubytování'), '<div class="kf-grid" id="kf-p-typ"></div>');
      if (S.includes('access')) {
        body += sec('access', T('Přístupnost'),
          '<p class="kf-sub">' + esc(T('Vstup')) + '</p><div class="kf-w" role="group" aria-label="' + esc(T('Přístupnost vstupu')) + '">' + W_ALL.map(k => '<button type="button" class="chip" data-kf-w="' + k + '" aria-pressed="false">' + K.statusHtml(K.W[k].st, K.W[k].short) + '<span class="n" data-kf-n="w:' + k + '"></span></button>').join('') + '</div>' +
          '<div class="kf-list">' +
          opt('checkbox', 'kf-b', 'wc', esc(LB.wc), 'wc-accessible', 'b:wc') +
          opt('checkbox', 'kf-b', 'pk', esc(T('Parkování ZTP u objektu')), 'parking-ztp', 'b:pk') +
          opt('checkbox', 'kf-b', 'lift', esc(T('Výtah nebo plošina, případně jen jedno podlaží')), 'lift', 'b:lift') +
          opt('checkbox', 'kf-b', 'ek', esc(LB.ek), 'eurokey', 'b:ek') + '</div>');
      }
      if (S.includes('room')) body += sec('room', T('Pokoj a koupelna'), '<div class="kf-list" id="kf-p-room">' + opt('checkbox', 'kf-b', 'room', esc(LB.room), 'room-accessible', 'b:room') + '</div><p class="kf-note">' + esc(T('Údaje o pokojích máme jen u ubytování, kde jsme je našli na webu provozovatele.')) + '</p>');
      if (S.includes('adv')) body += sec('adv', T('Rozměry a vybavení'),
        '<p class="kf-note">' + esc(T('Ukáže jen místa, kde údaj opravdu známe. Kde rozměr chybí, místo se skryje.')) + '</p>' +
        '<div class="kf-door"><label for="kf-door">' + esc(T('Vstupní dveře alespoň')) + '</label><select id="kf-door"><option value="">' + esc(T('bez požadavku')) + '</option><option value="70">70 cm</option><option value="80">80 cm</option><option value="90">90 cm</option></select></div>' +
        '<div class="kf-list">' + opt('checkbox', 'kf-b', 'shower', esc(LB.shower), 'shower', 'b:shower') + opt('checkbox', 'kf-b', 'bars', esc(LB.bars), 'grab-bars', 'b:bars') + '</div>',
        '<span data-kf-tier="advancedFilters"></span>');
      if (S.includes('source')) body += sec('source', T('Zdroj a ověření'),
        '<p class="kf-note">' + esc(T('Stačí jeden ze zvolených zdrojů.')) + '</p><div class="kf-list">' +
        SRC.map(k => opt('checkbox', 'kf-src', k, esc(LB[k]) + '<small>' + esc(H[k]) + '</small>', { mer: 'ruler', web: 'building', open: 'shield', osm: 'users' }[k], 'src:' + k)).join('') +
        opt('checkbox', 'kf-b', 'chk', esc(T('Datum kontroly na místě')), 'check-circle', 'b:chk') + '</div>');
      if (S.includes('more')) body += sec('more', S.includes('contact') ? T('Fotka, popis a kontakt') : T('Fotka a popis'), '<div class="kf-list">' + opt('checkbox', 'kf-b', 'img', esc(LB.img), 'camera', 'b:img') + opt('checkbox', 'kf-b', 'desc', esc(LB.desc), 'message', 'b:desc') +
        (S.includes('contact') ? opt('checkbox', 'kf-b', 'contact', esc(LB.contact), 'phone', 'b:contact') : '') + '</div>');
      if (S.includes('area')) body += sec('area', T('Oblast'),
        '<div class="seg kf-zeme" role="group" aria-label="' + esc(T('Země')) + '">' + [['', T('Vše')], ['cz', K.ZEME.cz], ['de', K.ZEME.de]].map(([z, l]) => '<button type="button" data-kf-zeme="' + z + '" aria-pressed="false">' + esc(l) + '</button>').join('') + '</div>' +
        '<div class="field"><label for="kf-kraj">' + esc(T('Kraj nebo vládní obvod')) + '</label><select id="kf-kraj"></select></div>' +
        '<div class="field"><label for="kf-obec">' + esc(T('Obec')) + '</label>' + (cfg.obecMode === 'select' ? '<select id="kf-obec"></select>' : '<input id="kf-obec" type="search" list="kf-obce" autocomplete="off" placeholder="' + esc(T('Název obce')) + '"><datalist id="kf-obce"></datalist>') + '</div>');
      if (S.includes('needs')) body += sec('needs', T('Moje potřeby'),
        '<div class="kf-list">' + opt('checkbox', 'kf-b', 'needsOnly', esc(LB.needsOnly), 'wheel', '') + '</div>' +
        '<p class="kf-note" id="kf-needs-note"></p><button class="btn btn-quiet btn-sm" type="button" data-kf-needs>' + K.icon('sliders') + esc(T('Nastavit potřeby')) + '</button>',
        '<span data-kf-tier="match"></span>');

      host.innerHTML = '<div class="kf-backdrop" id="kf-backdrop" hidden></div>' +
        '<div class="kf-panel" id="kf-panel" role="dialog" aria-modal="true" aria-labelledby="kf-title" hidden>' +
        '<div class="kf-grip" aria-hidden="true"></div>' +
        '<header class="kf-head"><h2 id="kf-title">' + esc(T('Filtry')) + '</h2><button class="icon-btn" type="button" data-kf-close aria-label="' + esc(T('Zavřít filtry')) + '">' + K.icon('close') + '</button></header>' +
        '<div class="kf-body">' + body + '</div>' +
        '<footer class="kf-foot"><button class="btn btn-ghost" type="button" data-kf-reset>' + esc(T('Zrušit vše')) + '</button><button class="btn btn-primary" type="button" data-kf-apply>' + esc(T('Zobrazit místa')) + '</button></footer></div>';
      P.panel = host.querySelector('#kf-panel'); P.backdrop = host.querySelector('#kf-backdrop');
      P.apply = host.querySelector('[data-kf-apply]');
      P.kraj = host.querySelector('#kf-kraj'); P.obec = host.querySelector('#kf-obec'); P.door = host.querySelector('#kf-door');
      panelBuilt = true;
      fillArea();
      bindPanel();
      applyMode();
    }
    function fillArea() {
      if (!P.kraj) return;
      const a = cfg.areaOptions(state);
      const groupsOf = {};
      (a.kraje || []).forEach(k => { (groupsOf[k.group] = groupsOf[k.group] || []).push(k); });
      P.kraj.innerHTML = '<option value="">' + esc(T('Všechny kraje a obvody')) + '</option>' + Object.keys(groupsOf).map(gk => '<optgroup label="' + esc(gk) + '">' +
        groupsOf[gk].map(k => '<option value="' + esc(k.value) + '">' + esc(k.label) + (k.count != null ? ' (' + K.nf(k.count) + ')' : '') + '</option>').join('') + '</optgroup>').join('');
      P.kraj.value = state.kraj;
      if (!P.obec) return;
      if (cfg.obecMode === 'select') {
        P.obec.innerHTML = '<option value="">' + esc(T('Všechny obce')) + '</option>' + (a.obce || []).map(([o, n]) => '<option value="' + esc(o) + '">' + esc(o) + (n != null ? ' (' + K.nf(n) + ')' : '') + '</option>').join('');
        P.obec.value = state.obec;
        if (P.obec.value !== state.obec) P.obec.value = '';
      } else {
        const dl = el.panelHost.querySelector('#kf-obce');
        if (dl) dl.innerHTML = (a.obce || []).slice(0, 1500).map(([o]) => '<option value="' + esc(o) + '">').join('');
        if (document.activeElement !== P.obec) P.obec.value = state.obec;
      }
    }
    function syncPanel() {
      if (!panelBuilt) return;
      const host = el.panelHost;
      host.querySelectorAll('input[name="kf-cat"]').forEach(i => { i.checked = state.cats.has(i.value); });
      host.querySelectorAll('input[name="kf-typ"]').forEach(i => { i.checked = state.typ.has(i.value); });
      host.querySelectorAll('input[name="kf-src"]').forEach(i => { i.checked = state.src.has(i.value); });
      host.querySelectorAll('input[name="kf-b"]').forEach(i => { i.checked = !!state[i.value]; });
      host.querySelectorAll('[data-kf-w]').forEach(b => b.setAttribute('aria-pressed', state.w.has(b.dataset.kfW)));
      host.querySelectorAll('[data-kf-zeme]').forEach(b => b.setAttribute('aria-pressed', state.zeme === b.dataset.kfZeme));
      if (P.door) P.door.value = state.door;
      if (P.kraj && P.kraj.value !== state.kraj) { P.kraj.value = state.kraj; if (P.kraj.value !== state.kraj) fillArea(); }
      if (P.obec && document.activeElement !== P.obec) { if (cfg.obecMode === 'select') fillArea(); else P.obec.value = state.obec; }
      host.querySelectorAll('[data-kf-tier]').forEach(x => { x.innerHTML = K.tierBadge(x.dataset.kfTier, { onlyLocked: true }); });
      const note = host.querySelector('#kf-needs-note');
      if (note) {
        const locked = !K.hasTier('match'), active = K.getNeeds().active;
        note.textContent = locked ? T('Accessibility Match porovná místa s vaším profilem potřeb. Údaje o vstupu, WC a parkování zůstávají zdarma.')
          : active ? T('Porovnáváme s vaším profilem potřeb.') : T('Nejdřív si nastavte profil potřeb.');
      }
    }
    function syncCounts() {
      if (panelBuilt) {
        const host = el.panelHost;
        // Druh ubytování: seznam podle dat
        const typBox = host.querySelector('#kf-p-typ');
        if (typBox) {
          const ks = Object.keys(counts.typ).concat([...state.typ].filter(k => !(k in counts.typ))).sort((a, b) => (counts.typ[b] || 0) - (counts.typ[a] || 0));
          const sig = ks.join('|');
          if (typBox.dataset.sig !== sig) { typBox.dataset.sig = sig; typBox.innerHTML = ks.map(k => opt('checkbox', 'kf-typ', k, esc(K.t(k)), typIcon(k), 'typ:' + k, state.typ.has(k) ? ' checked' : '')).join(''); }
        }
        const room = host.querySelector('#kf-sec-room');
        if (room) room.hidden = !(counts.b.room || state.room);
        host.querySelectorAll('[data-kf-n]').forEach(x => {
          const [g, k] = x.dataset.kfN.split(':');
          const v = g === 'cat' ? counts.cat[k] : g === 'typ' ? counts.typ[k] : g === 'w' ? counts.w[k] : g === 'src' ? counts.src[k] : counts.b[k];
          x.textContent = K.nf(v || 0);
        });
        if (P.apply) P.apply.textContent = counts.total ? T('Zobrazit {n}', { n: K.nf(counts.total) + ' ' + K.plural(counts.total, cfg.unit[0], cfg.unit[1], cfg.unit[2]) }) : ((cfg.emptyLabel && cfg.emptyLabel()) || T('Nic neodpovídá'));
      }
      renderCats();
    }
    function syncUi() { renderCats(); renderQuick(); renderActive(); syncPanel(); }

    // Režim panelu: 'dialog' (vysouvací panel s fokusem uvnitř) nebo 'inline' (stálý sloupec na PC, ubytování)
    let mode = null;
    function applyMode() {
      if (!panelBuilt) return;
      const m = cfg.panelMode();
      if (m === mode) return;
      mode = m;
      el.panelHost.classList.toggle('kf-inline', m === 'inline');
      if (m === 'inline') {
        isOpen = false;
        P.panel.hidden = false; P.backdrop.hidden = true;
        P.panel.removeAttribute('role'); P.panel.removeAttribute('aria-modal');
        P.panel.setAttribute('aria-labelledby', 'kf-title');
        document.documentElement.classList.remove('kf-lock');
      } else {
        P.panel.setAttribute('role', 'dialog'); P.panel.setAttribute('aria-modal', 'true');
        if (!isOpen) { P.panel.hidden = true; P.backdrop.hidden = true; }
      }
      if (el.filterBtn) el.filterBtn.setAttribute('aria-expanded', mode === 'inline' ? 'true' : String(isOpen));
    }
    function open(section) {
      if (!panelBuilt) buildPanel();
      if (mode === 'inline') {
        const t = section && el.panelHost.querySelector('#kf-sec-' + section);
        (t || P.panel).scrollIntoView({ block: 'start', behavior: 'smooth' });
        const f = (t || P.panel).querySelector('input, button, select'); if (f) f.focus({ preventScroll: true });
        return;
      }
      lastFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : el.filterBtn;
      isOpen = true;
      P.panel.hidden = false; P.backdrop.hidden = false;
      document.documentElement.classList.add('kf-lock');
      if (el.filterBtn) el.filterBtn.setAttribute('aria-expanded', 'true');
      const t = section && el.panelHost.querySelector('#kf-sec-' + section);
      if (t) { t.scrollIntoView({ block: 'start' }); const f = t.querySelector('input, button, select'); if (f) f.focus(); }
      else P.panel.querySelector('[data-kf-close]').focus();
    }
    function close() {
      if (!isOpen) return;
      isOpen = false;
      P.panel.hidden = true; P.backdrop.hidden = true;
      document.documentElement.classList.remove('kf-lock');
      if (el.filterBtn) el.filterBtn.setAttribute('aria-expanded', 'false');
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    }
    function bindPanel() {
      const host = el.panelHost;
      host.addEventListener('change', (e) => {
        const i = e.target;
        if (i.name === 'kf-cat') toggleIn('cats', i.value);
        else if (i.name === 'kf-typ') toggleIn('typ', i.value);
        else if (i.name === 'kf-src') toggleIn('src', i.value);
        else if (i.name === 'kf-b') set(i.value, i.checked);
        else if (i.id === 'kf-door') set('door', i.value);
        else if (i.id === 'kf-kraj') { state.kraj = i.value; if (state.kraj && state.zeme) { const r = K.regionByName && K.regionByName(state.kraj); if (r && r.zeme !== state.zeme) state.zeme = ''; } state.obec = cfg.obecMode === 'select' ? '' : state.obec; fillArea(); changed({ key: 'kraj', push: true }); }
        else if (i.id === 'kf-obec') { state.obec = i.value.trim(); changed({ key: 'obec', push: true }); }
      });
      host.addEventListener('click', (e) => {
        const w = e.target.closest('[data-kf-w]'); if (w) { toggleIn('w', w.dataset.kfW); return; }
        const z = e.target.closest('[data-kf-zeme]');
        if (z) { state.zeme = z.dataset.kfZeme; const r = state.kraj && K.regionByName && K.regionByName(state.kraj); if (r && state.zeme && r.zeme !== state.zeme) state.kraj = ''; fillArea(); changed({ key: 'zeme', push: true }); return; }
        if (e.target.closest('[data-kf-close]') || e.target === P.backdrop) { close(); return; }
        if (e.target.closest('[data-kf-apply]')) { close(); if (cfg.onApply) cfg.onApply(); return; }
        if (e.target.closest('[data-kf-reset]')) { reset(); return; }
        if (e.target.closest('[data-kf-needs]')) { K.needsDrawer(); }
      });
      P.panel.addEventListener('keydown', (e) => {
        if (mode !== 'dialog') return;
        if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
        if (e.key === 'Tab') {
          const f = [...P.panel.querySelectorAll('button:not([disabled]), input, select, a[href]')].filter(x => x.offsetParent !== null);
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      });
      // Úchyt: stažení panelu dolů zavře (mobil)
      const grip = P.panel.querySelector('.kf-grip');
      let y0 = null;
      const head = P.panel.querySelector('.kf-head');
      [grip, head].forEach(x => {
        x.addEventListener('pointerdown', (e) => { if (mode === 'dialog' && !e.target.closest('button')) { y0 = e.clientY; } });
        x.addEventListener('pointermove', (e) => { if (y0 === null) return; const dy = Math.max(0, e.clientY - y0); P.panel.style.transform = dy ? 'translateY(' + dy + 'px)' : ''; });
        const end = (e) => { if (y0 === null) return; const dy = e.clientY - y0; y0 = null; P.panel.style.transform = ''; if (dy > 90) close(); };
        x.addEventListener('pointerup', end); x.addEventListener('pointercancel', () => { y0 = null; P.panel.style.transform = ''; });
      });
    }

    // ---------- Události ----------
    function bind() {
      if (el.search) {
        el.search.value = state.q;
        el.search.addEventListener('input', () => { state.q = el.search.value; changed({ key: 'q', delay: 220 }); });
      }
      if (el.form) el.form.addEventListener('submit', (e) => { e.preventDefault(); state.q = el.search.value; changed({ key: 'q', submit: true, push: true }); });
      if (el.filterBtn) el.filterBtn.addEventListener('click', () => open());
      if (el.cats) {
        el.cats.addEventListener('click', (e) => {
          const b = e.target.closest('[data-kf-cat]'); if (!b) return;
          const setKey = cfg.catMode === 'typ' ? 'typ' : 'cats', k = b.dataset.kfCat;
          if (!k) { state[setKey].clear(); changed({ key: setKey, push: true }); }
          else toggleIn(setKey, k);
        });
        // Myš: kolečko posouvá řadu kategorií do strany
      }
      // Myš: kolečko posouvá řady kategorií a rychlých čipů do strany
      [el.cats, el.quick].filter(Boolean).forEach(row => row.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && row.scrollWidth > row.clientWidth + 2) {
          const max = row.scrollWidth - row.clientWidth;
          if ((e.deltaY < 0 && row.scrollLeft <= 0) || (e.deltaY > 0 && row.scrollLeft >= max - 1)) return;
          row.scrollLeft += e.deltaY; e.preventDefault();
        }
      }, { passive: false }));
      if (el.quick) el.quick.addEventListener('click', (e) => {
        const b = e.target.closest('[data-kf-q]'); if (!b) return;
        const k = b.dataset.kfQ;
        if (k === 'step') setStep(!wIsStep(state.w));
        else if (SRC.includes(k)) toggleIn('src', k);
        else set(k, !state[k]);
      });
      if (el.active) el.active.addEventListener('click', (e) => {
        const r = e.target.closest('[data-kf-reset]'); if (r) { reset(); return; }
        const b = e.target.closest('[data-kf-clear]'); if (!b) return;
        const next = b.parentElement && (b.nextElementSibling || b.previousElementSibling);
        clearKey(b.dataset.kfClear, b.dataset.v);
        // fokus na sousední čip, ať klávesnice nespadne na začátek stránky
        const pills = el.active.querySelectorAll('.kf-pill, .kf-clear-all');
        if (pills.length) pills[0].focus(); else if (el.filterBtn) el.filterBtn.focus();
      });
      document.addEventListener('kp:tier', () => { dropLocked(); changed({ key: 'tier' }); });
      document.addEventListener('kp:needs', () => { syncPanel(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) close(); });
      const mq = matchMedia('(min-width: 900px)');
      mq.addEventListener('change', () => { if (isOpen && cfg.panelMode() === 'inline') close(); applyMode(); });
    }

    buildPanel();
    bind();
    syncUi();
    writeUrl(false);

    // Prázdný stav: návrh uvolnit filtr podle skutečných počtů (místa, která neprošla jen tímto jedním filtrem)
    function relaxHtml(max) {
      const LBL = { q: T('hledaný text'), cats: T('kategorie'), typ: T('druh ubytování'), w: T('přístupnost vstupu'), src: T('zdroj údajů'), door: T('šířka dveří'), zeme: T('země'), kraj: T('kraj'), obec: T('obec') };
      const rows = Object.entries(counts.relax).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, max || 3);
      if (!rows.length) return '';
      const act = activeList();
      const name = (k) => { const m = act.filter(x => x[0] === k); return m.length === 1 ? m[0][2] : (LB[k] || LBL[k] || k); };
      return '<ul class="kf-relax">' + rows.map(([k, n]) => '<li><button type="button" class="btn btn-ghost btn-sm" data-kf-relax="' + k + '">' +
        esc(T('Bez filtru {f}', { f: '„' + name(k) + '“' })) + ' <span class="num">+' + K.nf(n) + '</span></button></li>').join('') + '</ul>';
    }
    function bindRelax(root) {
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-kf-relax]'); if (!b) return;
        const k = b.dataset.kfRelax;
        if (k === 'cats' || k === 'typ' || k === 'src') { state[k].clear(); changed({ key: k, push: true }); }
        else clearKey(k);
      });
    }

    return {
      get state() { return state; }, get counts() { return counts; },
      run, set, reset, open, close, changed, activeList, activeCount, relaxHtml, bindRelax, fillArea, syncUi, applyMode,
      setArea(k, v, o) { state[k] = v; if (k === 'kraj' && cfg.obecMode === 'select') state.obec = ''; fillArea(); changed(Object.assign({ key: k, push: true }, o)); },
      setQuery(q) { state.q = q; if (el.search) el.search.value = q; changed({ key: 'q', push: true }); },
      isOpen: () => isOpen,
    };
  }

  window.KPFilters = { create, cardHtml, bindSave, syncSaves, sortList, attrs: A, hasX, hasR, isOsm, norm, W_DEF, W_ALL };
})();
