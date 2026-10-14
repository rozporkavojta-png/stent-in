/* Sledování změn u uložených míst (funkce PLUS „Upozornění na změny“). PROTOTYP bez serveru:
   při zapnutí sledování si prohlížeč uloží otisk údajů o přístupnosti (localStorage kp.watch). Při další návštěvě
   detailu nebo profilu se otisk porovná s aktuálními daty a ukáže se, co se změnilo. Nic se neodesílá.
   API (window.KP.watch):
     all()            {id: {r, n, date, snap}}
     ids()            pole id sledovaných míst
     has(id)          bool
     add(p)           začne sledovat místo (uloží otisk), vrací true
     remove(id)       přestane sledovat
     snapshot(p)      otisk údajů {klíč: hodnota}
     changes(p)       [{key, label, from, to}] rozdíly mezi uloženým otiskem a aktuálními daty ([] když nesledujeme)
     accept(p)        změny vzaty na vědomí: uloží nový otisk
   Sledování samo patří do PLUS (KP.hasTier('changeAlerts')); stránky to hlídají přes KP.requireTier. */
(function () {
  'use strict';
  const K = window.KP;
  if (!K) return;
  const KEY = 'watch';
  const today = () => new Date().toISOString().slice(0, 10);
  const read = () => { const x = K.store.get(KEY, {}); return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; };
  const write = (x) => K.store.set(KEY, x);

  // Otisk: obecné značky (vstup, WC, parkování, popis, kontrola na místě) + sjednocené prvky a naměřené hodnoty
  function snapshot(p) {
    const s = {};
    if (!p) return s;
    s.w = p.c === 'parkovani' ? null : (p.w || null);
    s.t = p.t || null;
    s.pk = p.pk || (p.pw === 'yes' ? 'yes' : null);
    s.d = p.d ? String(p.d).length + ':' + String(p.d).slice(0, 40) : null;
    s.cd = p.cd || null;
    s.img = p.img ? 1 : null;
    const fx = K.facts(p);
    Object.keys(fx.f || {}).forEach(k => { s['f.' + k] = String(fx.f[k].v); });
    Object.keys(fx.m || {}).forEach(k => { s['m.' + k] = fx.m[k].v; });
    return s;
  }

  const FV = (v) => v === undefined || v === null ? K.t('neuvedeno') : v === 'true' ? K.t('má') : v === 'false' ? K.t('nemá') : v === 'part' ? K.t('částečně') : v === 'na' ? K.t('netýká se') : String(v);
  function label(key) {
    if (key === 'w') return K.t('Přístupnost vstupu');
    if (key === 't') return K.t('Toaleta');
    if (key === 'pk') return K.t('Parkování ZTP');
    if (key === 'd') return K.t('Slovní popis přístupnosti');
    if (key === 'cd') return K.t('Datum kontroly na místě');
    if (key === 'img') return K.t('Fotografie');
    if (key.indexOf('f.') === 0) { const f = (K.FEATURES || []).find(x => x.k === key.slice(2)); return f ? f.label : key.slice(2); }
    if (key.indexOf('m.') === 0) { const m = (K.MEASURES || {})[key.slice(2)]; return m ? m[0] : key.slice(2); }
    return key;
  }
  function value(key, v) {
    if (v === undefined || v === null) return K.t('neuvedeno');
    if (key === 'w') return (K.W[v] || K.W['null']).short;
    if (key === 't') return K.T[v] ? K.T[v].label : String(v);
    if (key === 'd') return K.t('změněný text');
    if (key === 'img') return K.t('je');
    if (key === 'cd') return K.fmtDate(v);
    if (key.indexOf('f.') === 0) return FV(v);
    if (key.indexOf('m.') === 0) { const m = (K.MEASURES || {})[key.slice(2)]; return K.fmt(v) + (m && m[1] ? ' ' + m[1] : ''); }
    return String(v);
  }

  const watch = {
    all: read,
    ids: () => Object.keys(read()),
    has: (id) => !!read()[id],
    add(p) {
      if (!p) return false;
      const x = read();
      x[p.i] = { r: p._r || '', n: p.n || '', date: today(), snap: snapshot(p) };
      K.rememberRegion(p);
      return write(x);
    },
    remove(id) { const x = read(); delete x[id]; return write(x); },
    snapshot,
    changes(p) {
      const w = p && read()[p.i];
      if (!w || !w.snap) return [];
      const now = snapshot(p), old = w.snap, out = [];
      Object.keys(Object.assign({}, old, now)).forEach(k => {
        const a = old[k] === undefined ? null : old[k], b = now[k] === undefined ? null : now[k];
        if (a === b) return;
        if (k === 'd') out.push({ key: k, label: label(k), from: a ? K.t('původní text') : K.t('neuvedeno'), to: b ? K.t('změněný text') : K.t('neuvedeno') });
        else out.push({ key: k, label: label(k), from: value(k, a), to: value(k, b) });
      });
      return out;
    },
    accept(p) {
      const x = read(); if (!p || !x[p.i]) return false;
      x[p.i].snap = snapshot(p); x[p.i].date = today(); x[p.i].n = p.n || x[p.i].n;
      return write(x);
    },
  };
  K.watch = watch;
})();
