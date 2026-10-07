/* Detail místa – vše z data/regions/ (OpenStreetMap + otevřená data měst + weby provozovatelů), nic se nedomýšlí.
   Odkaz: misto.html?id=<id>&r=<region>; starý odkaz bez r dohledá region přes data/regions/ids.json.
   Rozvržení (verze 3, DESIGN.md): velký název a vedle něj fotka z Wikimedia Commons (pokud existuje),
   osobní shoda, 4 klíčové údaje jako .tile, sekce jako výpisy s linkami, vpravo (desktop) lepící sloupec
   bez rámečků s mapou, kontaktem, zdrojem dat a převzetím profilu. Na mobilu lepící spodní lišta s akcemi.
   Komunitní a podnikové funkce jsou FUNKČNÍ PROTOTYP: vše se ukládá jen v tomto prohlížeči (KP.community,
   KP.business) a stránka to vždy říká textem KP.PROTOTYPE_NOTE. Žádná čísla se nevymýšlejí. */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s);
  const C = K.community, B = K.business;
  const ROOT = () => $('#place');

  const miss = KP.t('zatím neuvedeno');
  const row = (label, val, missing) => '<div><dt>' + label + '</dt><dd' + (missing ? ' class="missing"' : '') + '>' + val + '</dd></div>';
  const rows = (list) => list.length ? '<dl class="kv">' + list.join('') + '</dl>' : '';
  const YESNO = { yes: K.t('ano'), no: K.t('ne'), limited: K.t('částečně'), designated: K.t('ano (vyhrazené)'), automatic: K.t('automatické') };
  const yesno = (v) => (YESNO[v] || K.esc(v));
  const SRC_NAMES = { brno: KP.t('Otevřená data Brno'), praha: KP.t('Praha bez bariér (POV)'), praha_ipr: KP.t('IPR Praha'), euroklic: KP.t('Euroklíč'), mapybezbarier: KP.t('Mapy bez bariér') };
  const CAT_ST = { 'Přístupný': 'ok', 'Částečně přístupný': 'part', 'Nepřístupný': 'no' };
  const T_SHORT = { yes: KP.t('Bezbariérová'), limited: KP.t('Částečně'), no: KP.t('Není bezbariérová') };
  const X_VISIBLE = 8;
  // Stav prvku (true / 'part' / false / 'na' / neznámý) → tvar + text
  const FSTATE = { true: ['ok', KP.t('Má')], part: ['part', KP.t('Částečně')], false: ['no', KP.t('Nemá')] };
  const MSTATE = { met: 'ok', part: 'part', unmet: 'no', unknown: 'unk' };

  const isResearch = (p) => !!p.nw || /^rh[0-9a-f]+$/.test(p.i);
  const isCertified = (p) => Array.isArray(p.x) && p.x.some(x => x && x.src === 'mapybezbarier');
  const safeUrl = (u) => /^https?:\/\//i.test(u || '') ? u : '';
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  const dist = (d) => d < 1 ? Math.round(d * 1000) + ' m' : K.fmt(d.toFixed(1)) + ' km';
  const ext = (href, text) => '<a href="' + K.esc(href) + '" target="_blank" rel="noopener">' + text + K.icon('external', 'i inline') + '</a>';
  const plural = (n, a, b, c) => n === 1 ? a : n > 1 && n < 5 ? b : c;
  const qid = (p) => 'id=' + encodeURIComponent(p.i) + (p._r ? '&r=' + encodeURIComponent(p._r) : '');
  const proto = () => '<p class="pl-proto">' + K.icon('info') + '<span>' + K.esc(K.PROTOTYPE_NOTE) + '</span></p>';
  const fstate = (v) => v === 'na' ? ('<span class="pl-na">' + KP.t('Netýká se') + '</span>') : FSTATE[String(v)] ? K.statusHtml(FSTATE[String(v)][0], FSTATE[String(v)][1]) : K.statusHtml('unk', KP.t('Neuvedeno'));

  // Poznámka k údaji „Popisek: hodnota“ z dat: přeloží nejdelší známý popisek a krátkou hodnotu (KP.tx)
  function noteTx(note) {
    const parts = String(note).split(': ');
    for (let k = parts.length - 1; k >= 1; k--) {
      const head = parts.slice(0, k).join(': '), tr = K.tx(head);
      if (tr !== head) return tr + ': ' + K.tx(parts.slice(k).join(': '));
    }
    return parts.map(K.tx).join(': ');
  }
  function sec(id, title, inner, extra) {
    return '<section class="pl-sec" id="' + id + '" aria-labelledby="' + id + '-h"><div class="pl-sec-head"><h2 id="' + id + '-h">' + title + '</h2>' + (extra || '') + '</div>' + inner + '</section>';
  }
  function osmSrc(p) {
    if (isResearch(p)) return '<p class="pl-src">' + K.sourceBadge('firma') + ('<span>' + KP.t('Podle webu provozovatele. Místo zatím není v OpenStreetMap.') + '</span></p>');
    return '<p class="pl-src">' + K.sourceBadge('komunita') +
      (p.u ? ('<span>' + KP.t('Upraveno') + ' ') + K.fmtDate(p.u) + ' (' + K.ageLabel(p.u) + ')</span>' : '') +
      '<span>' + (p.cd ? (KP.t('Kontrola na místě') + ' ') + K.fmtDate(p.cd) : KP.t('Bez data kontroly na místě')) + '</span></p>';
  }
  // Zdroj jednoho údaje: štítek + datum (u OpenStreetMap datum poslední úpravy objektu)
  function srcOf(p, c) {
    if (!c) return '';
    const d = c.date || (c.src === 'komunita' && p.u ? p.u : '');
    return '<span class="pl-rsrc">' + K.sourceBadge(c.src, c.local ? KP.t('v tomto prohlížeči') : '') + (d ? '<span>' + (c.date ? KP.t('stav') + ' ' : KP.t('upraveno') + ' ') + K.fmtDate(d) + '</span>' : '') + '</span>';
  }

  // ---------- Osobní shoda (Personal Match Score) ----------
  function matchBlock(p) {
    const needs = K.getNeeds();
    if (!needs.active) {
      let st, title, text;
      if (p.c === 'parkovani') { st = 'ok'; title = KP.t('Parkování pro držitele průkazu ZTP'); text = p.pk ? p.pk + (' ' + KP.t('vyhrazených míst podle OpenStreetMap.')) : KP.t('Vyhrazené parkovací místo.'); }
      else { const w = K.W[p.w || 'null']; st = w.st; title = w.label; text = w.help; }
      return '<div id="pl-match"><div class="pl-verdict ' + st + '"><span class="status ' + st + ' big"><i></i></span><div><p class="pl-verdict-title">' + title + '</p><p class="pl-verdict-text">' + text + '</p></div></div>' +
        ('<div class="pl-match-cta"><p><b>' + KP.t('Kolik procent vašich potřeb místo splňuje?') + '</b> ' + KP.t('Nastavte pomůcku, šířku dveří, výtah nebo sprchu. Shodu pak uvidíte u každého místa.') + '</p>') +
        '<button class="btn btn-ghost btn-sm" type="button" data-open-needs-inline>' + K.icon('sliders') + (KP.t('Nastavit moje potřeby') + '</button></div></div>');
    }
    const m = K.matchScore(p, needs);
    const by = (s) => m.items.filter(i => i.state === s);
    const list = (title, items) => items.length ? '<div class="pl-mcol"><p class="pl-label">' + title + ' <span class="num">' + items.length + '</span></p><ul class="pl-mlist">' +
      items.map(i => '<li>' + K.statusHtml(MSTATE[i.state], K.esc(i.label)) + (i.src ? ' <span class="pl-msrc">' + K.esc(K.SOURCES[i.src] ? K.SOURCES[i.src].short : '') + '</span>' : '') + '</li>').join('') + '</ul></div>' : '';
    const big = m.pct === null ? '<span class="pl-match-pct is-none">?</span>' : '<span class="pl-match-pct num">' + m.pct + '<small> %</small></span>';
    const head = m.pct === null
      ? ('<p class="pl-verdict-title">' + KP.t('Shodu zatím nelze spočítat') + '</p><p class="pl-verdict-text">' + KP.t('U tohoto místa neznáme žádný údaj, který potřebujete. Chybějící údaje shodu nesnižují.') + '</p>')
      : '<p class="pl-verdict-title">' + m.pct + (' ' + KP.t('% shoda s vašimi potřebami') + '</p><p class="pl-verdict-text">') + K.statusHtml(m.status, K.STATUS_LABEL[m.status]) +
        ' · ' + K.t('známe {k} z {n}', { k: m.known, n: m.total }) + (KP.lang() === 'cs' ? ' ' + plural(m.total, K.t('údaje'), K.t('údajů'), K.t('údajů')) : '') + ' (' + m.knownPct + ' %)</p>';
    return '<div id="pl-match"><div class="pl-match pl-verdict ' + m.status + '">' + big + '<div>' + head + '</div></div>' +
      '<div class="pl-mcols">' + list(KP.t('Splňuje'), by('met')) + list(KP.t('Nesplňuje'), by('unmet').concat(by('part'))) + list(KP.t('Chybí údaj'), by('unknown')) + '</div>' +
      ('<p class="small muted pl-match-for">' + KP.t('Podle vašeho profilu') + ': ') + K.esc(K.needsSummary(needs).join(', ')) + (KP.t('. Shoda se počítá jen z údajů, které známe. Neznámé údaje snižují jistotu, ne shodu.') + '</p>') +
      '<div class="pl-modes"><button class="btn btn-ghost btn-sm" type="button" data-open-needs-inline>' + K.icon('sliders') + (KP.t('Upravit potřeby') + '</button><a class="btn btn-quiet btn-sm" href="profil.html">' + KP.t('Můj profil přístupnosti') + '</a></div></div>');
  }

  // ---------- Dlaždice klíčových údajů ----------
  function tile(href, ico, k, v, sub) {
    return '<a class="tile pl-tile" href="' + href + '"><span class="k">' + k + '</span><span class="v">' + v + '</span>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</a>';
  }
  function tiles(p, near) {
    const out = [];
    const nearPk = near.find(x => x.c === 'parkovani' && x.i !== p.i);
    if (p.c !== 'parkovani') {
      const w = K.W[p.w || 'null'];
      const sub = p.sc !== undefined ? (KP.t('Schodů u vstupu') + ': ') + p.sc : p.dw ? (KP.t('Dveře') + ' ') + p.dw + ' cm' : p.rp ? (KP.t('Rampa') + ': ') + yesno(p.rp) : '';
      out.push(tile('#s-vstup', 'door', KP.t('Vstup'), K.statusHtml(w.st, w.short), sub));
      out.push(tile('#s-wc', 'wc', KP.t('Toaleta'), p.t ? K.statusHtml(K.T[p.t].st, T_SHORT[p.t]) : K.statusHtml('unk', KP.t('Neuvedeno')), p.ek ? KP.t('Na Euroklíč') : ''));
    }
    const pkV = p.pk ? K.statusHtml('ok', p.pk + ' ' + (p.pk === 1 ? KP.t('místo') : p.pk < 5 ? KP.t('místa') : KP.t('míst'))) : p.pw ? K.statusHtml(p.pw === 'no' ? 'no' : 'ok', yesno(p.pw)) : K.statusHtml('unk', p.c === 'parkovani' ? KP.t('Počet neuveden') : KP.t('Neuvedeno'));
    out.push(tile('#s-pk', 'parking', KP.t('Parkování ZTP'), pkV, !p.pk && !p.pw && nearPk ? (KP.t('Nejbližší stání') + ' ') + dist(K.distanceKm(p, nearPk)) : ''));
    if (p.c === 'parkovani' && p.fee) out.push(tile('#s-pk', 'info', KP.t('Placené'), '<b>' + yesno(p.fee) + '</b>', ''));
    const s = K.facilitiesScore(p);
    out.push(tile('#s-skore', 'ruler', KP.t('Vybavení'), s.total === null ? K.statusHtml('unk', KP.t('Neznámé')) : '<b class="num">' + s.total + ' %</b>',
      s.total === null ? KP.t('O prvcích nic nevíme') : '<span class="tape-meter" style="--v:' + s.total + '" aria-hidden="true"></span>'));
    return '<div class="pl-tiles">' + out.join('') + '</div>';
  }

  // ---------- Accessibility Facilities Score ----------
  function scoreSec(p) {
    const s = K.facilitiesScore(p), fx = K.facts(p);
    const tot = s.total === null
      ? '<div class="pl-score-big"><span class="pl-score-n is-none">?</span><p>' + K.statusHtml('unk', KP.t('Neznámé')) + ('<br>' + KP.t('O sledovaných prvcích zatím nemáme žádný údaj.') + '</p></div>')
      : '<div class="pl-score-big"><span class="pl-score-n num">' + s.total + '<small> %</small></span><p>' + K.t('Místo prokazatelně nabízí <b class="num">{a}</b> z <b class="num">{b}</b> sledovaných prvků. Údaje známe u {c} % prvků.', { a: K.fmt(s.offered), b: s.tracked, c: s.coverage }) + '</p></div>';
    const areas = '<ul class="pl-areas">' + s.relevant.map(a => {
      const d = s.detail[a];
      const v = d.pct === null ? K.statusHtml('unk', KP.t('Neznámé')) : '<b class="num">' + d.pct + ' %</b>';
      return '<li class="pl-area"><span class="pl-area-n">' + K.AREAS[a] + '</span><span class="pl-area-v">' + v + '</span>' +
        '<span class="tape-meter' + (d.pct === null ? ' is-none' : '') + '" style="--v:' + (d.pct || 0) + '" aria-hidden="true"></span>' +
        '<span class="pl-area-sub">' + (d.known ? K.t('má {a} z {n} prvků, známe {k} z {n}', { a: K.fmt(d.offered), n: d.tracked, k: d.known }) : K.t('žádný z {n} prvků neznáme', { n: d.tracked })) + '</span></li>';
    }).join('') + '</ul>';
    const feats = s.relevant.map(a => '<div class="pl-fgroup"><p class="pl-label">' + K.AREAS[a] + '</p><ul class="pl-flist">' +
      K.FEATURES.filter(f => f.a === a).map(f => {
        const c = fx.f[f.k];
        return '<li><span class="pl-fl">' + K.esc(f.label) + '</span><span class="pl-fv">' + fstate(c ? c.v : null) + '</span>' +
          (c ? '<span class="pl-fn">' + (c.note ? K.esc(noteTx(c.note)) : '') + srcOf(p, c) + '</span>' : '') + '</li>';
      }).join('') + '</ul></div>').join('');
    return sec('s-skore', KP.t('Vybavení pro přístupnost'), tot + areas +
      ('<details class="pl-more"><summary>' + KP.t('Všechny sledované prvky (')) + s.tracked + ')</summary>' + feats + '</details>' +
      ('<p class="small muted pl-note">' + KP.t('Skóre ukazuje podíl sledovaných prvků, které místo prokazatelně má. Neuvedený prvek body nepřidá. Oblast, o které nevíme nic, označujeme jako neznámou, ne jako nulu. Skóre neříká, jestli místo vyhovuje právě vám. K tomu slouží osobní shoda nahoře.') + '</p>') +
      requestBlock(p, s));
  }

  // „Požádat o informace o přístupnosti“: u chybějících údajů
  function requestBlock(p, s) {
    if (!s.missing.length) return '';
    const areas = [...new Set(s.missing.map(m => m.area))];
    if (C.hasRequested(p.i)) {
      const r = C.requests(p.i).slice(-1)[0] || {};
      return '<div class="pl-ask is-done"><p>' + K.statusHtml('ok', (KP.t('Požádali jste o informace') + ' ') + K.fmtDate(r.date)) + '</p>' +
        (r.areas && r.areas.length ? ('<p class="small">' + KP.t('Oblasti') + ': ') + K.esc(r.areas.map(a => K.AREAS[a] || a).join(', ')) + '</p>' : '') +
        ('<p class="small muted">' + KP.t('V ostré verzi by provozovatel dostal zprávu, že o tyto údaje je zájem.') + '</p>') + proto() + '</div>';
    }
    return ('<div class="pl-ask"><p class="pl-ask-t"><b>' + KP.t('Chybí') + ' ') + s.missing.length + ' ' + plural(s.missing.length, KP.t('údaj'), KP.t('údaje'), KP.t('údajů')) + ('.</b> ' + KP.t('Dejte provozovateli vědět, že vás zajímají.') + '</p>') +
      '<details class="pl-write"><summary class="btn btn-ghost">' + K.icon('message') + (KP.t('Požádat o informace o přístupnosti') + '</summary>') +
      ('<form class="pl-form" id="rq-form"><fieldset class="pl-fs"><legend>' + KP.t('Co chcete vědět') + '</legend>') +
      areas.map(a => '<label class="check"><input type="checkbox" name="rq-area" value="' + a + '" checked> ' + K.AREAS[a] + '</label>').join('') + '</fieldset>' +
      ('<div class="field"><label for="rq-note">' + KP.t('Poznámka pro provozovatele') + ' <span class="hint">' + KP.t('(dobrovolné)') + '</span></label><textarea id="rq-note" maxlength="500" placeholder="' + KP.t('Např. jak široké jsou dveře do pokoje a jestli je sprcha bez vaničky.') + '"></textarea></div>') +
      ('<div class="row"><button class="btn btn-primary" type="submit">' + KP.t('Odeslat žádost') + '</button></div>') + proto() + '</form></details></div>';
  }

  // ---------- Naměřené údaje (pole x) ----------
  function xRow(r) {
    if (Array.isArray(r)) return [r[0], r[1]];
    if (r && typeof r === 'object') return [r.label ?? r.k ?? r.co ?? '', r.value ?? r.v ?? r.hodnota ?? ''];
    return ['', r];
  }
  const clean = (v) => String(v).replace(/<br\s*\/?\s*>?/gi, ' ').trim();
  function measured(p) {
    if (!Array.isArray(p.x) || !p.x.length) return '';
    const inner = p.x.map(x => {
      const rs = (x.rows || []).map(xRow).filter(r => r[1] !== '' && r[1] !== null && r[1] !== undefined).map(r => row(K.esc(K.tx(r[0])), K.esc(K.tx(clean(r[1])))));
      const head = '<div class="pl-sub"><h3>' + K.esc(K.tx(x.label) || SRC_NAMES[x.src] || x.src || KP.t('Otevřená data')) + '</h3>' + (x.cat && CAT_ST[x.cat] ? K.statusHtml(CAT_ST[x.cat], K.esc(K.t(x.cat))) : '') + '</div>';
      const more = rs.length > X_VISIBLE ? '<details class="pl-more"><summary>' + K.t('Zobrazit dalších {n} údajů', { n: rs.length - X_VISIBLE }) + '</summary>' + rows(rs.slice(X_VISIBLE)) + '</details>' : '';
      return '<div class="pl-group">' + head + rows(rs.slice(0, X_VISIBLE)) + more +
        '<p class="pl-src">' + K.sourceBadge('overeno') + (x.date ? ('<span>' + KP.t('Stav') + ' ') + K.fmtDate(x.date) + '</span>' : '') +
        (x.license ? ('<span>' + KP.t('Licence') + ' ') + K.esc(x.license) + (x.attribution ? ', © ' + K.esc(x.attribution) : '') + '</span>' : '') +
        (safeUrl(x.url) ? ext(x.url, KP.t('Zdroj')) : '') + '</p></div>';
    }).join('');
    return sec('s-x', KP.t('Naměřené údaje'), inner);
  }

  // ---------- Podle webu provozovatele (pole r) ----------
  const R_ITEMS = [['vstup', KP.t('Vstup')], ['wc', KP.t('Toaleta')], ['pokoj', KP.t('Pokoj')], ['koupelna', KP.t('Koupelna')], ['parkovani', KP.t('Parkování')], ['vytah', KP.t('Výtah')], ['jine', KP.t('Další informace')]];
  const R_CLAIM = { yes: ['ok', KP.t('Web uvádí, že je místo bezbariérové')], limited: ['part', KP.t('Web uvádí omezenou přístupnost')], no: ['no', KP.t('Web uvádí, že místo není bezbariérové')] };
  function kota(m) {
    const v = typeof m.hodnota === 'number' ? K.fmt(m.hodnota) : K.esc(m.hodnota);
    return '<li class="kota"><span class="kota-val num">' + v + (m.jednotka ? ' ' + K.esc(m.jednotka) : '') + '</span><span class="kota-line" aria-hidden="true"></span><span class="kota-what">' + K.esc(m.co) + '</span></li>';
  }
  function operatorInfo(p) {
    if (!Array.isArray(p.r) || !p.r.length) return '';
    const recs = p.r.filter(r => r && safeUrl(r.url));
    if (!recs.length) return '';
    const inner = recs.map(r => {
      const items = R_ITEMS.filter(([k]) => r.items && r.items[k]).map(([k, l]) => row(l, K.esc(r.items[k])));
      const claim = R_CLAIM[r.claim];
      const meas = (r.measurements || []).filter(m => m && m.co && m.hodnota !== undefined && m.hodnota !== null && m.hodnota !== '');
      return '<div class="pl-group">' +
        (claim ? '<p class="pl-claim">' + K.statusHtml(claim[0], claim[1]) + '</p>' : '') +
        rows(items) +
        (meas.length ? ('<p class="pl-label">' + KP.t('Rozměry uvedené na webu') + '</p><ul class="kotas">') + meas.map(kota).join('') + '</ul>' : '') +
        (r.quote ? '<blockquote class="pl-quote">„' + K.esc(r.quote) + '“</blockquote>' : '') +
        '<p class="pl-src"><span class="badge badge-business">' + K.icon('building') + K.esc(r.source_type || 'web provozovatele') + '</span>' +
        (r.date ? ('<span>' + KP.t('Zkontrolováno') + ' ') + K.fmtDate(r.date) + '</span>' : '') + ext(safeUrl(r.url), K.esc(host(r.url))) + '</p></div>';
    }).join('');
    return sec('s-r', KP.t('Podle webu provozovatele'), inner +
      ('<p class="small muted pl-note">' + KP.t('Tyto údaje uvádí sám provozovatel nebo jiný oficiální web. Nikdo je nezměřil nezávisle, proto si před cestou ověřte, co je pro vás důležité.') + '</p>'),
      ('<span class="badge badge-business" title="' + KP.t('Údaj převzatý z webu provozovatele. Nikdo ho nezměřil nezávisle.') + '">') + K.icon('building') + (KP.t('Provozovatel') + '</span>'));
  }

  // ---------- Pokoj a koupelna (jen ubytování) ----------
  function hotelSec(p) {
    if (p.c !== 'ubytovani') return '';
    const fx = K.facts(p);
    const fRow = (label, k) => { const c = fx.f[k]; return row(label, c ? fstate(c.v) + srcOf(p, c) : miss, !c); };
    const mRow = (label, k, test) => {
      const c = fx.m[k];
      if (!c) return row(label, miss, true);
      const v = '<span class="num">' + K.esc(typeof c.v === 'number' ? K.fmt(c.v) : c.v) + ' ' + K.esc(c.unit) + '</span>';
      return row(label, v + (test ? ' ' + test(c.v) : '') + srcOf(p, c));
    };
    const d80 = (v) => v >= 80 ? K.statusHtml('ok', KP.t('splňuje 80 cm')) : K.statusHtml('no', KP.t('pod 80 cm'));
    const known = ['pokojBb', 'sprcha', 'sedatko', 'koupelnaMadla'].some(k => fx.f[k]) || ['pokojuBb', 'pokojDvereCm', 'postelVyskaCm', 'postelProstorCm', 'sprchaSirkaCm'].some(k => fx.m[k]);
    const texts = fx.hotel.filter(h => h.pokoj || h.koupelna);
    const quotes = texts.map(h => '<div class="pl-hq">' + (h.pokoj ? ('<p><b>' + KP.t('Pokoj') + ':</b> ') + K.esc(h.pokoj) + '</p>' : '') + (h.koupelna ? ('<p><b>' + KP.t('Koupelna') + ':</b> ') + K.esc(h.koupelna) + '</p>' : '') +
      '<p class="pl-src">' + K.sourceBadge('firma', h.local ? KP.t('v tomto prohlížeči') : '') + (h.date ? ('<span>' + KP.t('Stav') + ' ') + K.fmtDate(h.date) + '</span>' : '') + (safeUrl(h.url) ? ext(h.url, K.esc(host(h.url))) : '') + '</p></div>').join('');
    return sec('s-hotel', KP.t('Pokoj a koupelna'),
      ('<div class="pl-group"><h3>' + KP.t('Pokoj') + '</h3>') + rows([
        fRow(KP.t('Bezbariérový pokoj'), 'pokojBb'), mRow(KP.t('Počet bezbariérových pokojů'), 'pokojuBb'),
        mRow(KP.t('Šířka dveří pokoje'), 'pokojDvereCm', d80), mRow(KP.t('Výška postele'), 'postelVyskaCm'), mRow(KP.t('Volný prostor vedle postele'), 'postelProstorCm'),
      ]) + '</div>' +
      ('<div class="pl-group"><h3>' + KP.t('Koupelna') + '</h3>') + rows([
        fRow(KP.t('Sprcha v úrovni podlahy'), 'sprcha'), mRow(KP.t('Šířka sprchového koutu'), 'sprchaSirkaCm'), fRow(KP.t('Sedátko ve sprše'), 'sedatko'), fRow(KP.t('Madla v koupelně'), 'koupelnaMadla'),
        row(KP.t('Uspořádání koupelny'), texts.some(h => h.koupelna) ? KP.t('popis níže') : miss, !texts.some(h => h.koupelna)),
      ]) + '</div>' +
      (quotes ? ('<p class="pl-label">' + KP.t('Jak pokoj popisuje provozovatel') + '</p>') + quotes : '') +
      '<div class="pl-ask"><p class="pl-ask-t">' + (known ? (KP.t('Chybí vám něco?') + ' ') : ('<b>' + KP.t('O pokojích zatím nic nevíme.') + '</b> ')) + (KP.t('Zeptejte se hotelu na rozměry pokoje a koupelny, nebo údaje doplňte, pokud jste tu byli.') + '</p>') +
      '<div class="pl-modes"><a class="btn btn-ghost btn-sm" href="pridat.html?id=' + encodeURIComponent(p.i) + '">' + K.icon('plus') + (KP.t('Doplnit údaje') + '</a>') +
      '<a class="btn btn-quiet btn-sm" href="podnik.html?' + qid(p) + ('">' + KP.t('Jste provozovatel? Vyplňte profil') + '</a></div></div>'));
  }

  // ---------- Vstup, toaleta, parkování (OpenStreetMap) ----------
  function basics(p, near) {
    let html = '';
    if (p.c !== 'parkovani') {
      const w = K.W[p.w || 'null'];
      html += ('<div class="pl-group" id="s-vstup"><h3>' + KP.t('Vstup') + '</h3>') + rows([
        row(KP.t('Přístupnost vstupu'), K.statusHtml(w.st, w.label), !p.w),
        row(KP.t('Počet schodů u vstupu'), p.sc !== undefined ? '<span class="num">' + p.sc + '</span>' : miss, p.sc === undefined),
        row(KP.t('Rampa'), p.rp ? yesno(p.rp) : miss, !p.rp),
        row(KP.t('Šířka dveří'), p.dw ? '<span class="num">' + p.dw + ' cm</span> ' + (p.dw >= 80 ? K.statusHtml('ok', KP.t('splňuje 80 cm')) : p.dw >= 70 ? K.statusHtml('part', KP.t('pod 80 cm')) : K.statusHtml('no', KP.t('pod 70 cm'))) : miss, !p.dw),
      ]) + '</div>';
      if (!(['priroda'].includes(p.c) && !p.t)) {
        const t = [row(KP.t('Bezbariérová toaleta'), p.t ? K.statusHtml(K.T[p.t].st, K.T[p.t].label) : miss, !p.t)];
        if (p.ek) t.push(row(KP.t('Euroklíč'), KP.t('ano, otevřete univerzálním klíčem')));
        if (p.cp) t.push(row(KP.t('Přebalovací pult'), yesno(p.cp)));
        if (p.c === 'wc' && p.fee) t.push(row(KP.t('Poplatek'), yesno(p.fee)));
        html += ('<div class="pl-group" id="s-wc"><h3>' + KP.t('Toaleta') + '</h3>') + rows(t) + '</div>';
      }
    }
    const nearPk = near.filter(x => x.c === 'parkovani' && x.i !== p.i).slice(0, 3);
    const pk = [row(p.c === 'parkovani' ? KP.t('Vyhrazená místa ZTP') : KP.t('Parkování ZTP u objektu'), p.pk ? '<span class="num">' + p.pk + ('</span> ' + KP.t('vyhrazených míst')) : p.pw ? yesno(p.pw) : miss, !(p.pk || p.pw))];
    if (p.fee && p.c === 'parkovani') pk.push(row(KP.t('Placené'), yesno(p.fee)));
    if (p.op && p.c === 'parkovani') pk.push(row(KP.t('Provozovatel'), K.esc(p.op)));
    html += ('<div class="pl-group" id="s-pk"><h3>' + KP.t('Parkování') + '</h3>') + rows(pk) +
      (nearPk.length ? ('<p class="pl-label">' + KP.t('Nejbližší vyhrazená stání ZTP') + '</p><ul class="pl-near">') + nearPk.map(x => nearItem(x, p)).join('') + '</ul>' : '') + '</div>';
    return sec('s-osm', p.c === 'parkovani' ? KP.t('Parkování') : KP.t('Vstup, toaleta a parkování'), html + osmSrc(p));
  }

  function description(p) {
    if (!p.d && !p.de) return '';
    return sec('s-popis', KP.t('Popis přístupnosti'), '<blockquote class="pl-quote">' + K.esc((K.LANG === 'de' && p.de) || p.d || p.de) + '</blockquote>' + osmSrc(p));
  }

  // Fotka z Wikimedia Commons: velká nahoře vedle názvu (3:2), s odkazem na autora a licenci
  function heroPhoto(p) {
    if (!p.img) return '';
    const src = (w) => K.commonsImg(p.img, w);
    return '<figure class="photo pl-photo"><img src="' + src(960) + '" srcset="' + src(640) + ' 640w, ' + src(960) + ' 960w, ' + src(1280) + ' 1280w" sizes="(min-width: 900px) 46vw, 100vw" width="960" height="640" alt="' + KP.t('Fotografie') + ': ' + K.esc(p.n) + '" decoding="async">' +
      ('<figcaption>' + KP.t('Foto: Wikimedia Commons') + ', ') + ext(K.commonsPage(p.img), KP.t('autor a licence')) + '</figcaption></figure>';
  }

  // ---------- Fotodokumentace po typech ----------
  function photoAreas(p) {
    return B.PHOTO_AREAS.filter(a => (p.c === 'ubytovani' || !a.hotel) && (p.c !== 'parkovani' || a.key === 'parkovani') && !(p.c === 'wc' && !['vstup', 'wc'].includes(a.key)));
  }
  function photoSec(p) {
    const areas = photoAreas(p), keys = areas.map(a => a.key);
    const all = C.photos(p.i);
    const fig = (x) => '<figure class="pl-ph"><img src="' + K.esc(x.src) + '" alt="' + K.esc((B.PHOTO_AREAS.find(a => a.key === x.area) || { label: KP.t('Fotka') }).label + ': ' + p.n) + '" loading="lazy" decoding="async">' +
      '<figcaption>' + (x.from === 'business' ? KP.t('Od provozovatele') : KP.t('Vaše fotka')) + (x.date ? ', ' + K.fmtDate(x.date) : '') + '</figcaption></figure>';
    const groups = areas.map(a => {
      const list = all.filter(x => x.area === a.key);
      return '<div class="pl-phrow"><div class="pl-phhead"><h3>' + a.label + '</h3>' + (list.length ? '<span class="num small">' + list.length + '</span>' : '') + '</div>' +
        (list.length ? '<div class="pl-phgrid">' + list.map(fig).join('') + '</div>' : ('<p class="small muted">' + KP.t('Zatím bez fotky. Co vyfotit') + ': ') + K.esc(K.lc(a.how.charAt(0)) + a.how.slice(1)) + '</p>') + '</div>';
    }).join('');
    const other = all.filter(x => !keys.includes(x.area));
    const local = all.length ? proto() : '';
    return sec('s-foto', KP.t('Fotodokumentace'),
      (p.img ? ('<div class="pl-phrow"><div class="pl-phhead"><h3>' + KP.t('Celkový pohled') + '</h3></div><div class="pl-phgrid"><figure class="pl-ph"><img src="') + K.commonsImg(p.img, 480) + '" alt="' + KP.t('Fotografie') + ': ' + K.esc(p.n) + '" loading="lazy" decoding="async"><figcaption>Wikimedia Commons, ' + ext(K.commonsPage(p.img), KP.t('autor a licence')) + '</figcaption></figure></div></div>' : '') +
      groups +
      (other.length ? ('<div class="pl-phrow"><div class="pl-phhead"><h3>' + KP.t('Další fotky') + '</h3></div><div class="pl-phgrid">') + other.map(fig).join('') + '</div></div>' : '') +
      local +
      ('<p class="small pl-note">' + KP.t('Fotku přidáte k') + ' <a href="#s-komunita">' + KP.t('hodnocení místa') + '</a>' + KP.t(KP.t('. Provozovatel nahraje fotky v')) + ' <a href="podnik.html?') + qid(p) + ('">' + KP.t('profilu podniku') + '</a>.</p>') +
      ('<div class="pl-sv"><div><p class="pl-sv-title">' + KP.t('Prohlédněte si vstup ve Street View') + '</p><p class="small muted">' + KP.t('Snímky ulice od Google ukážou schody, obrubníky i dveře dřív, než vyrazíte. Stáří snímku uvidíte v Google Maps.') + '</p>') +
      '<a class="btn btn-ghost btn-sm" href="' + K.gmaps.streetView(p) + '" target="_blank" rel="noopener">' + K.icon('external') + (KP.t('Otevřít Street View') + '</a></div></div>'));
  }

  // ---------- Hodnocení a zkušenosti (komunita, prototyp) ----------
  function ratingAreas(p) { const rel = K.facilitiesScore(p).relevant; return C.RATING_AREAS.filter(a => rel.includes(a)); }
  function dots(v) { let s = '<span class="pl-dots" aria-hidden="true">'; for (let i = 1; i <= 5; i++) s += '<i' + (v && i <= Math.round(v) ? ' class="on"' : '') + '></i>'; return s + '</span>'; }
  function communitySec(p) {
    const areas = ratingAreas(p), list = C.reviews(p.i), sum = C.ratingSummary(p.i);
    const avg = '<ul class="pl-avg">' + areas.map(a => {
      const s = sum[a];
      return '<li><span class="pl-avg-n">' + K.AREAS[a] + '</span>' + (s.avg === null ? ('<span class="pl-avg-v muted">' + KP.t('Zatím bez hodnocení') + '</span>')
        : '<span class="pl-avg-v">' + dots(s.avg) + '<b class="num">' + K.fmt(s.avg) + '</b> ' + K.t('z 5') + ' <span class="muted">(' + s.n + ' ' + plural(s.n, KP.t('ko.rev1'), KP.t('ko.rev2'), KP.t('ko.rev5')) + ')</span></span>') + '</li>';
    }).join('') + '</ul>';
    const items = list.length ? '<ul class="pl-exp">' + list.map(r => {
      const rt = areas.filter(a => r.ratings && r.ratings[a]).map(a => '<span class="pl-rt">' + K.AREAS[a] + ' <b class="num">' + r.ratings[a] + '/5</b></span>').join('');
      const ph = (r.photos || []).length ? '<div class="pl-phgrid is-small">' + r.photos.map((src, i) => '<figure class="pl-ph"><img src="' + K.esc(src) + '" alt="' + KP.t('Fotka od návštěvníka') + ((r.photoAreas || [])[i] ? ': ' + K.esc((B.PHOTO_AREAS.find(a => a.key === r.photoAreas[i]) || {}).label || '') : '') + '" loading="lazy" decoding="async"></figure>').join('') + '</div>' : '';
      return ('<li><p class="small muted"><b>' + KP.t('Vy') + '</b> · ') + K.esc(r.aid ? K.t(r.aid) : K.t('pomůcka neuvedena')) + ' · ' + K.fmtDate(r.date) + (' · ' + KP.t('uloženo jen ve vašem prohlížeči') + '</p>') +
        (rt ? '<p class="pl-rts">' + rt + '</p>' : '') + (r.text ? '<p>' + K.esc(r.text) + '</p>' : '') + ph +
        '<button class="btn btn-quiet btn-sm" type="button" data-del-review="' + K.esc(r.id) + ('">' + KP.t('Smazat') + '</button></li>');
    }).join('') + '</ul>' : ('<p class="muted">' + KP.t('Zatím tu nikdo nehodnotil. Byli jste tu? Pomozte dalším.') + '</p>');
    const scale = (a) => '<fieldset class="pl-fs pl-scale"><legend>' + K.AREAS[a] + '</legend><div class="pl-rates">' +
      '<label class="pl-rate is-none"><input type="radio" name="rt-' + a + ('" value="" checked><span>' + KP.t('Nevím') + '</span></label>') +
      [1, 2, 3, 4, 5].map(v => '<label class="pl-rate"><input type="radio" name="rt-' + a + '" value="' + v + '"><span>' + v + '</span></label>').join('') + '</div></fieldset>';
    const phAreas = photoAreas(p);
    const form = '<form class="pl-form" id="rv-form" novalidate>' +
      ('<div class="field"><label for="rv-aid">' + KP.t('Čím se pohybujete') + ' <span class="hint">' + KP.t('(kontext hodnocení, dobrovolné)') + '</span></label><select id="rv-aid"><option value="">' + KP.t('Neuvádět') + '</option>') + K.AIDS.map(a => '<option value="' + a + '">' + K.t(a) + '</option>').join('') + '</select></div>' +
      ('<div class="field" id="rv-aid-other-f" hidden><label for="rv-aid-other">' + KP.t('Jaká pomůcka') + '</label><input type="text" id="rv-aid-other" maxlength="60"></div>') +
      ('<div class="pl-scales"><p class="small muted" style="margin:0">' + KP.t('Jak to šlo? 1 = nezvládl jsem to, 5 = bez potíží.') + '</p>') + areas.map(scale).join('') + '</div>' +
      ('<div class="field"><label for="rv-text">' + KP.t('Zkušenost') + ' <span class="hint">' + KP.t('(dobrovolné)') + '</span></label><textarea id="rv-text" maxlength="4000" placeholder="' + KP.t('Např. vstup ze dvora je bez schodu, WC je v 1. patře, výtah funguje.') + '"></textarea></div>') +
      ('<div class="field"><label for="rv-photos">' + KP.t('Fotky') + ' <span class="hint">' + KP.t('(nejvýš 6, zmenšíme je na 1200 px)') + '</span></label><input type="file" id="rv-photos" accept="image/*" multiple></div>') +
      ('<div class="field"><label for="rv-parea">' + KP.t('Co je na fotkách') + '</label><select id="rv-parea">') + phAreas.map(a => '<option value="' + a.key + '">' + a.label + '</option>').join('') + ('<option value="">' + KP.t('Něco jiného') + '</option></select></div>') +
      '<p class="small pl-formmsg" id="rv-msg" role="status" aria-live="polite"></p>' +
      ('<div class="row"><button class="btn btn-primary" type="submit">' + KP.t('Uložit hodnocení') + '</button></div>') + proto() + '</form>';
    return sec('s-komunita', KP.t('Hodnocení návštěvníků'),
      ('<p class="pl-label">' + KP.t('Průměr po oblastech') + '</p>') + avg +
      ('<p class="small muted">' + KP.t('Průměr počítáme jen z hodnocení uložených v tomto prohlížeči. Hodnocení ostatních lidí zatím nesbíráme, web nemá server.') + '</p>') +
      ('<p class="pl-label">' + KP.t('Hodnocení') + '</p>') + items +
      '<details class="pl-write"' + (list.length ? '' : ' open') + '><summary class="btn btn-ghost">' + K.icon('star') + (KP.t('Ohodnotit místo') + '</summary>') + form + '</details>');
  }

  // ---------- Platí to ještě? Komunitní potvrzení klíčových údajů ----------
  const KEY_FACTS = ['bezSchodu', 'dvere80', 'wcBb', 'vytah', 'parkZTP', 'sprcha'];
  function confirmSec(p) {
    const fx = K.facts(p), rel = K.facilitiesScore(p).relevant;
    const keys = KEY_FACTS.filter(k => { const f = K.FEATURES.find(x => x.k === k); return f && rel.includes(f.a) && fx.f[k] && fx.f[k].v !== 'na'; });
    const conf = C.confirmations(p.i), reps = C.reports(p.i);
    const li = keys.map(k => {
      const f = K.FEATURES.find(x => x.k === k), c = fx.f[k], cf = conf[k] || { yes: 0, no: 0, mine: null };
      const myRep = reps.find(r => r.field === k);
      const count = cf.mine === 'yes' ? K.t('Potvrzeno 1× (jen z tohoto prohlížeče, {d})', { d: K.fmtDate(cf.date) }) : cf.mine === 'no' ? K.t('Označeno jako neplatné 1× (jen z tohoto prohlížeče, {d})', { d: K.fmtDate(cf.date) }) : K.t('Z tohoto prohlížeče zatím bez potvrzení');
      return '<li><div class="pl-cf-h"><span class="pl-fl">' + K.esc(f.label) + '</span>' + fstate(c.v) + '</div>' + srcOf(p, c) +
        '<p class="small muted pl-cf-n">' + count + '</p>' +
        '<div class="pl-modes"><button class="btn btn-ghost btn-sm" type="button" data-confirm="' + k + '" data-v="yes" aria-pressed="' + (cf.mine === 'yes') + '">' + K.icon('check') + (KP.t('Potvrdit') + '</button>') +
        '<button class="btn btn-ghost btn-sm" type="button" data-confirm="' + k + '" data-v="no" aria-pressed="' + (cf.mine === 'no') + '">' + K.icon('flag') + (KP.t('Už neplatí') + '</button></div>') +
        (cf.mine === 'no' ? (myRep ? ('<p class="small">' + KP.t('Nahlásili jste') + ' ') + K.fmtDate(myRep.date) + (myRep.text ? ': „' + K.esc(myRep.text) + '“' : '') + '</p>'
          : '<form class="pl-form pl-rep" data-report-field="' + k + '"><div class="field"><label for="rep-' + k + ('">' + KP.t('Co se změnilo?') + ' <span class="hint">' + KP.t('(dobrovolné)') + '</span></label><textarea id="rep-') + k + ('" maxlength="2000" rows="2"></textarea></div><div class="row"><button class="btn btn-primary btn-sm" type="submit">' + KP.t('Nahlásit změnu') + '</button></div></form>')) : '') +
        '</li>';
    }).join('');
    return sec('s-potvrzeni', KP.t('Platí to ještě?'),
      (keys.length ? ('<p class="small">' + KP.t('Byli jste tu nedávno? Potvrďte, co sedí, nebo označte, co už neplatí.') + '</p><ul class="pl-cf">') + li + '</ul>'
        : ('<p class="muted">' + KP.t('U tohoto místa zatím neznáme žádný klíčový údaj, který by šel potvrdit. Můžete ho') + ' <a href="pridat.html?id=') + encodeURIComponent(p.i) + '">' + KP.t('doplnit') + '</a>.</p>') +
      ('<p class="small muted">' + KP.t('Počítáme jen hlasy z tohoto prohlížeče. Potvrzení ostatních návštěvníků v prototypu nevidíte.') + '</p>') + proto());
  }

  function nearItem(x, p) {
    return '<li><a href="' + K.placeUrl(x) + '">' + (x.c === 'parkovani' ? K.statusHtml('ok', '') : K.statusHtml(K.W[x.w || 'null'].st, '')) +
      '<span class="nm"><b>' + K.esc(x.n) + '</b><span>' + K.esc(x.s ? K.t(x.s) : '') + (x.t === 'yes' ? (' · ' + KP.t('bezbariérové WC')) : '') + (x.pk ? ' · ' + x.pk + KP.t('× ZTP') : '') + '</span></span><span class="d num">' + dist(K.distanceKm(p, x)) + '</span></a></li>';
  }

  function nearby(p, near) {
    const groups = {
      pristupne: { label: KP.t('Přístupná místa'), list: near.filter(x => x.i !== p.i && x.w === 'yes' && x.c !== 'parkovani') },
      wc: { label: KP.t('Bezbariérová WC'), list: near.filter(x => x.i !== p.i && x.t === 'yes') },
      ubytovani: { label: KP.t('Ubytování'), list: near.filter(x => x.i !== p.i && x.c === 'ubytovani' && x.w !== 'no') },
    };
    const keys = Object.keys(groups).filter(k => groups[k].list.length);
    if (!keys.length) return '';
    return sec('s-okoli', KP.t('V okolí do 1,5 km'),
      ('<div class="chip-row pl-tabs" role="tablist" aria-label="' + KP.t('Druh míst v okolí') + '">') + keys.map((k, i) => '<button class="chip" type="button" role="tab" id="tab-' + k + '" aria-controls="panel-' + k + '" aria-selected="' + (i === 0) + '" data-tab="' + k + '">' + groups[k].label + ' <span class="num">' + groups[k].list.length + '</span></button>').join('') + '</div>' +
      keys.map((k, i) => '<ul class="pl-near" role="tabpanel" id="panel-' + k + '" aria-labelledby="tab-' + k + '" data-panel="' + k + '"' + (i ? ' hidden' : '') + '>' + groups[k].list.slice(0, 8).map(x => nearItem(x, p)).join('') + '</ul>').join(''));
  }

  // ---------- Pravý sloupec ----------
  function mapCard(p) {
    return '<div class="pl-card pl-map"><iframe class="pl-gmap" src="' + K.gmaps.embed(p) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="' + KP.t('Google mapa') + ': ' + K.esc(p.n) + '"></iframe>' +
      '<div class="pl-card-body"><a class="btn btn-primary btn-block" href="' + K.gmaps.directions(p, 'walking') + '" target="_blank" rel="noopener">' + K.icon('nav') + (KP.t('Navigovat pěšky nebo na vozíku') + '</a>') +
      '<div class="pl-modes"><a class="btn btn-ghost btn-sm" href="' + K.gmaps.directions(p, 'transit') + ('" target="_blank" rel="noopener">' + KP.t(KP.t('MHD')) + '</a><a class="btn btn-ghost btn-sm" href="') + K.gmaps.directions(p, 'driving') + ('" target="_blank" rel="noopener">' + KP.t('Autem') + '</a></div>') +
      ('<p class="small muted">' + KP.t('Google Maps neumí trasu bez schodů. Bariéry v ulicích ukazujeme na stránce') + ' <a href="trasy.html?la=') + p.la + '&lo=' + p.lo + ('">' + KP.t('Trasy') + '</a>.</p></div></div>');
  }

  function contact(p) {
    const r = [];
    if (p.a || p.o) r.push(row(KP.t('Adresa'), K.esc([p.a, p.o].filter(Boolean).join(', '))));
    if (p.web) r.push(row(KP.t('Web'), '<a href="' + K.esc(/^https?:/.test(p.web) ? p.web : 'https://' + p.web) + '" target="_blank" rel="noopener">' + K.esc(p.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + '</a>'));
    if (p.ph) r.push(row(KP.t('Telefon'), '<a class="num" href="tel:' + K.esc(p.ph.replace(/[^+\d]/g, '')) + '">' + K.esc(p.ph) + '</a>'));
    if (p.oh) r.push(row(KP.t('Otevírací doba'), '<span class="pl-oh">' + K.esc(p.oh.replace(/;\s*/g, '\n')) + '</span>'));
    if (p.st) r.push(row(KP.t('Hvězdičky'), K.esc(p.st)));
    if (p.op && p.c !== 'parkovani') r.push(row(KP.t('Provozovatel'), K.esc(p.op)));
    const de = K.zemeOf(p) === 'de';
    r.push(row(de ? KP.t('Vládní obvod') : KP.t('Kraj'), p.k ? '<a href="kraj.html?k=' + encodeURIComponent(p.k) + '">' + K.esc(K.krajName(p.k, K.zemeOf(p))) + '</a>' : '–'));
    r.push(row(KP.t('Země'), K.esc(K.ZEME_LONG[K.zemeOf(p)] || '–')));
    return ('<div class="pl-card pl-contact" id="s-kontakt"><h2>' + KP.t('Kontakt') + '</h2>') + rows(r) + '</div>';
  }

  // Poslední aktualizace u každého zdroje (jen skutečná data)
  function updates(p) {
    const out = [];
    if (K.isOsm(p)) out.push([K.sourceBadge('komunita'), (p.u ? KP.t('upraveno') + ' ' + K.fmtDate(p.u) + ' (' + K.ageLabel(p.u) + ')' : KP.t('datum úpravy neznáme')) + (', ' + KP.t('staženo') + ' ') + K.fmtDate(K.OSM_DATE[K.zemeOf(p)] || K.OSM_DATE.cz)]);
    (Array.isArray(p.x) ? p.x : []).forEach(x => out.push([K.sourceBadge('overeno'), K.esc(SRC_NAMES[x.src] || x.label || KP.t('otevřená data')) + (x.date ? ', stav ' + K.fmtDate(x.date) : (', ' + KP.t('datum neuvedeno')))]));
    (Array.isArray(p.r) ? p.r : []).filter(r => r && safeUrl(r.url)).forEach(r => out.push([K.sourceBadge('firma'), K.esc(host(r.url)) + (r.date ? (', ' + KP.t('zkontrolováno') + ' ') + K.fmtDate(r.date) : '')]));
    const bp = B.profile(p.i);
    if (bp) out.push([K.sourceBadge('firma', KP.t('v tomto prohlížeči')), 'profil podniku' + (bp.updated ? (', ' + KP.t('uloženo') + ' ') + K.fmtDate(bp.updated) : '')]);
    const rv = C.reviews(p.i);
    if (rv.length) out.push(['<span class="badge badge-community">' + K.icon('users') + (KP.t('Vaše hodnocení') + '</span>'), KP.t('naposledy') + ' ' + K.fmtDate(rv[0].date) + (', ' + KP.t('jen v tomto prohlížeči'))]);
    return out.length ? ('<p class="pl-label" style="margin-top:4px">' + KP.t('Poslední aktualizace') + '</p><ul class="pl-upd">') + out.map(([b, t]) => '<li>' + b + '<span>' + t + '</span></li>').join('') + '</ul>' : '';
  }

  function dataSource(p) {
    const c = K.completeness(p), missing = K.missingFields(p);
    const body = isResearch(p)
      ? ('<p class="small">' + KP.t('Místo zatím není v OpenStreetMap. Název, poloha a údaje pocházejí z webu provozovatele')) + (p.r && p.r[0] && p.r[0].date ? (', ' + KP.t('zkontrolováno') + ' ') + K.fmtDate(p.r[0].date) : '') + (KP.t('. Polohu si před cestou ověřte na mapě.') + '</p>')
      : !K.isOsm(p) ? ('<p class="small">' + KP.t('Místo pochází z otevřených dat uvedených v oddílu „Naměřené údaje“ (zdroj, licence a datum jsou u nich). V OpenStreetMap jsme ho zatím nenašli.') + '</p>')
      : ('<p class="small">' + KP.t('Údaje o přístupnosti pocházejí z') + ' ') + ext(K.osmUrl(p), K.t('OpenStreetMap (objekt {id}, verze {v})', { id: K.esc(p.i.slice(1)), v: K.esc(p.v || '–') })) + (', ' + KP.t('staženo') + ' ') + K.fmtDate(K.OSM_DATE[K.zemeOf(p)] || K.OSM_DATE.cz) + (K.zemeOf(p) === 'de' ? (' ' + KP.t('(výřez Geofabrik pro Bavorsko)')) : '') + (KP.t('. Data © přispěvatelé OpenStreetMap, licence ODbL.') + '</p>') +
        (p.r && p.r.length ? ('<p class="small">' + KP.t('Údaje „Podle webu provozovatele“ jsme převzali z uvedeného webu, data OSM nijak nemění.') + '</p>') : '');
    return ('<div class="pl-card" id="s-zdroj"><h2>' + KP.t('Zdroj dat a úplnost') + '</h2>') +
      '<p class="pl-badges">' + (isResearch(p) ? K.sourceBadge('firma') : K.sourceBadge('komunita')) + (Array.isArray(p.x) && p.x.length ? K.sourceBadge('overeno') : '') + (B.profile(p.i) ? K.sourceBadge('firma', KP.t('v tomto prohlížeči')) : '') + '</p>' + body +
      updates(p) +
      ('<div class="meter-row"><span class="small">' + KP.t('Úplnost údajů') + '</span><span class="num">') + c + ' %</span><div class="tape-meter" style="--v:' + c + ';grid-column:1/-1" aria-hidden="true"></div></div>' +
      ('<p class="small muted">' + KP.t('Úplnost říká, kolik důležitých údajů máme, ne jestli je místo přístupné.') + ' <a href="metodika.html#uplnost">' + KP.t('Jak ji počítáme') + '</a></p>') +
      (missing.length ? '<details class="pl-more"><summary>' + K.t('Chybí') + ' ' + missing.length + ' ' + plural(missing.length, K.t('údaj'), K.t('údaje'), K.t('údajů')) + '</summary><ul class="pl-missing">' + missing.map(m => '<li>' + m + '</li>').join('') + '</ul></details>' : '') +
      '<div class="pl-modes"><a class="btn btn-ghost btn-sm" href="pridat.html?id=' + encodeURIComponent(p.i) + '">' + K.icon('plus') + (KP.t('Doplnit údaje') + '</a>') +
      '<a class="btn btn-ghost btn-sm" href="' + (isResearch(p) ? 'https://www.openstreetmap.org/edit#map=19/' + p.la + '/' + p.lo : K.osmEditUrl(p)) + '" target="_blank" rel="noopener">' + (isResearch(p) ? KP.t('Přidat do OSM') : KP.t('Upravit v OSM')) + '</a></div>' +
      ('<p class="small" style="margin:0">' + KP.t('Něco nesedí?') + ' <a href="pridat.html?id=') + encodeURIComponent(p.i) + ('&nahlasit=1">' + KP.t('Nahlaste změnu') + '</a>.</p></div>');
  }

  // Ověřený profil a převzetí profilu provozovatelem
  function businessCard(p) {
    const mbb = (p.x || []).find(x => x && x.src === 'mapybezbarier');
    const ver = mbb
      ? '<p class="pl-vbadge">' + K.icon('shield') + (KP.t('Ověřený profil') + '</p><p class="small">' + KP.t('Údaje pocházejí z profesionálního mapování') + ' ') + (safeUrl(mbb.url) ? ext(mbb.url, KP.t('Mapy bez bariér')) : KP.t('Mapy bez bariér')) + (' ' + KP.t('podle certifikované metodiky')) + (mbb.date ? ', stav ' + K.fmtDate(mbb.date) : '') + '.</p>'
      : ('<p class="small"><b>' + KP.t('Profil není ověřený.') + '</b> ' + KP.t('Ověření na místě proškoleným mapovačem chystáme jako placenou službu pro podniky. Do té doby u každého údaje uvádíme, odkud pochází.') + ' <a href="metodika.html#overeni">' + KP.t('Jak ověřujeme') + '</a></p>');
    const cl = B.claimed(p.i);
    if (p.c === 'parkovani' || p.c === 'wc') return ('<div class="pl-card" id="s-podnik"><h2>' + KP.t('Ověření') + '</h2>') + ver + '</div>';
    return ('<div class="pl-card" id="s-podnik"><h2>' + KP.t('Jste provozovatel?') + '</h2>') + ver +
      (cl ? '<p class="small">' + K.statusHtml('part', (KP.t('Převzetí zahájeno') + ' ') + K.fmtDate(cl.date)) + ('<br>' + KP.t('Uloženo jen v tomto prohlížeči, nikdo ho zatím neschválil.') + '</p>')
        : ('<p class="small">' + KP.t('Převezměte profil a doplňte měření a fotky podle checklistu. Základní profil je zdarma.') + '</p>')) +
      '<a class="btn btn-primary btn-block" href="podnik.html?' + qid(p) + '">' + K.icon('building') + (cl ? KP.t('Upravit profil podniku') : KP.t('Převzít profil')) + '</a>' +
      ('<p class="small" style="margin:0"><a href="pro-firmy.html">' + KP.t('Co podnikům nabízíme') + '</a></p></div>');
  }

  function jumpNav(html) {
    const items = [['s-skore', KP.t('Vybavení')], ['s-x', KP.t('Naměřeno')], ['s-r', KP.t('Od provozovatele')], ['s-hotel', KP.t('Pokoj')], ['s-osm', KP.t('Vstup a WC')], ['s-popis', KP.t('Popis')], ['s-foto', KP.t('Fotky')], ['s-komunita', KP.t('Hodnocení')], ['s-potvrzeni', KP.t('Platí to?')], ['s-okoli', KP.t('V okolí')], ['s-kontakt', KP.t('Kontakt')], ['s-podnik', KP.t('Pro provozovatele')]];
    return ('<nav class="chip-row pl-jump" aria-label="' + KP.t('Na této stránce') + '">') + items.filter(([id]) => html.includes('id="' + id + '"')).map(([id, l]) => '<a class="chip" href="#' + id + '">' + l + '</a>').join('') + '</nav>';
  }

  const saveLabel = (on) => K.icon('bookmark') + (on ? KP.t('Uloženo') : KP.t('Uložit'));

  // ---------- Vykreslení a obnova jednotlivých sekcí ----------
  let P = null, NEAR = [];
  const PARTS = { 'pl-match': matchBlock, 's-skore': scoreSec, 's-foto': photoSec, 's-komunita': communitySec, 's-potvrzeni': confirmSec, 's-zdroj': dataSource, 's-podnik': businessCard };
  function refresh(...ids) {
    ids.forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      const open = [...el.querySelectorAll('details')].map(d => d.open);
      el.outerHTML = PARTS[id](P);
      const nu = document.getElementById(id);
      if (nu) nu.querySelectorAll('details').forEach((d, i) => { if (open[i] !== undefined && !d.classList.contains('pl-write')) d.open = open[i]; });
    });
  }

  function render(p) {
    document.title = p.n + ' · kudyprojedu.cz';
    const on = K.saved.has(p.i);
    const cat = K.CATS[p.c] ? K.CATS[p.c].label : '';
    const near = NEAR;
    const main = scoreSec(p) + measured(p) + operatorInfo(p) + hotelSec(p) + basics(p, near) + description(p) + photoSec(p) + communitySec(p) + confirmSec(p) + nearby(p, near);
    const aside = contact(p) + dataSource(p) + businessCard(p);

    ROOT().innerHTML =
      ('<nav class="pl-crumbs" aria-label="' + KP.t('Drobečková navigace') + '"><a href="mapa.html">' + KP.t('Mapa') + '</a><span aria-hidden="true">›</span>') +
      (K.zemeOf(p) === 'de' ? ('<a href="mapa.html?zeme=de">' + KP.t('Bavorsko') + '</a><span aria-hidden="true">›</span>') : '') +
      (p.k ? '<a href="kraj.html?k=' + encodeURIComponent(p.k) + '">' + K.esc(K.LANG === 'cs' ? p.k : K.krajName(p.k)) + '</a><span aria-hidden="true">›</span>' : '') +
      (p.o ? '<a href="mapa.html?q=' + encodeURIComponent(p.o) + '">' + K.esc(p.o) + '</a><span aria-hidden="true">›</span>' : '') +
      '<span aria-current="page">' + K.esc(p.n) + '</span></nav>' +
      '<header class="pl-head' + (p.img ? ' has-photo' : '') + '"><div class="pl-head-text">' +
      (cat || isCertified(p) ? '<p class="pl-kick">' + (cat ? '<span class="kicker">' + K.esc(cat) + '</span>' : '') + (isCertified(p) ? '<a class="pl-vbadge" href="#s-podnik">' + K.icon('shield') + (KP.t('Ověřený profil') + '</a>') : '') + '</p>' : '') +
      '<h1>' + K.esc(p.n) + '</h1>' +
      '<p class="pl-meta">' + K.esc([p.s && p.s !== (K.CATS[p.c] || {}).label && K.t(p.s) !== cat ? K.t(p.s) : '', [p.a, p.o].filter(Boolean).join(', ')].filter(Boolean).join(' · ')) + '</p>' +
      '<div class="pl-actions"><a class="btn btn-primary hide-md" href="' + K.gmaps.directions(p) + '" target="_blank" rel="noopener">' + K.icon('nav') + (KP.t('Navigovat') + '</a>') +
      '<a class="btn btn-ghost" href="' + K.gmaps.streetView(p) + '" target="_blank" rel="noopener">' + K.icon('eye') + 'Street View</a>' +
      '<button class="btn btn-ghost hide-md" type="button" data-save aria-pressed="' + on + '">' + saveLabel(on) + '</button>' +
      '<button class="btn btn-ghost" type="button" id="share">' + K.icon('share') + (KP.t('Sdílet') + '</button>') +
      '<a class="btn btn-quiet" href="pridat.html?id=' + encodeURIComponent(p.i) + '&nahlasit=1">' + K.icon('flag') + (KP.t('Nahlásit změnu') + '</a></div></div>') + heroPhoto(p) + '</header>' +
      '<div class="pl-layout">' +
      '<div class="pl-top">' + matchBlock(p) + tiles(p, near) + jumpNav(main + aside) + '</div>' +
      ('<aside class="pl-aside" aria-label="' + KP.t('Mapa, kontakt a zdroj dat') + '"><div class="pl-aside-map">') + mapCard(p) + '</div><div class="pl-aside-info">' + aside + '</div></aside>' +
      '<div class="pl-main">' + main + '</div>' +
      '</div>' +
      '<div class="pl-actionbar"><a class="btn btn-primary" href="' + K.gmaps.directions(p) + '" target="_blank" rel="noopener">' + K.icon('nav') + (KP.t('Navigovat') + '</a>') +
      '<button class="btn btn-ghost" type="button" data-save aria-pressed="' + on + '">' + saveLabel(on) + '</button></div>';
  }

  // ---------- Události (delegované, přežijí obnovu sekcí) ----------
  function bind() {
    const root = ROOT();
    root.addEventListener('click', (e) => {
      const t = e.target.closest('button, a'); if (!t || !root.contains(t)) return;
      const p = P;
      if (t.matches('[data-open-needs-inline]')) { K.needsDrawer(); return; }
      if (t.matches('[data-save]')) {
        const now = K.saved.toggle(p.i, p);
        root.querySelectorAll('[data-save]').forEach(x => { x.setAttribute('aria-pressed', now); x.innerHTML = saveLabel(now); });
        K.toast(now ? KP.t('Místo uloženo do profilu.') : KP.t('Místo odebráno z uložených.'));
        return;
      }
      if (t.id === 'share') {
        const url = location.href;
        if (navigator.share) { navigator.share({ title: p.n, url }).catch(() => {}); return; }
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => K.toast(KP.t('Odkaz zkopírován.'))).catch(() => K.toast(url));
        return;
      }
      if (t.matches('[data-tab]')) {
        root.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === t));
        root.querySelectorAll('[data-panel]').forEach(x => { x.hidden = x.dataset.panel !== t.dataset.tab; });
        return;
      }
      if (t.matches('[data-confirm]')) {
        const k = t.dataset.confirm, v = t.dataset.v, cur = (C.confirmations(p.i)[k] || {}).mine;
        if (cur === v) C.unconfirm(p.i, k); else C.confirm(p.i, k, v === 'yes');
        K.toast(cur === v ? KP.t('Hlas zrušen.') : v === 'yes' ? KP.t('Děkujeme, údaj jste potvrdili.') : KP.t('Označeno jako neplatné. Popište, co se změnilo.'));
        refresh('s-potvrzeni', 's-zdroj');
        const b = document.querySelector('[data-confirm="' + k + '"][data-v="' + v + '"]'); if (b) b.focus();
        return;
      }
      if (t.matches('[data-del-review]')) {
        if (!confirm(KP.t('Smazat toto hodnocení z vašeho prohlížeče?'))) return;
        C.deleteReview(p.i, t.dataset.delReview);
        K.toast(KP.t('Hodnocení smazáno.'));
        refresh('s-komunita', 's-foto', 's-zdroj');
      }
    });
    root.addEventListener('change', (e) => {
      if (e.target.id === 'rv-aid') { const f = $('#rv-aid-other-f'); if (f) f.hidden = e.target.value !== 'jiné'; }
      if (e.target.id === 'rv-photos') {
        const n = e.target.files.length, msg = $('#rv-msg');
        if (msg) msg.textContent = n > 6 ? K.t('Vybrali jste {n} fotek, uložíme prvních 6.', { n }) : n ? K.t('Vybráno') + ' ' + n + ' ' + plural(n, K.t('fotka'), K.t('fotky'), K.t('fotek')) + '.' : '';
      }
    });
    root.addEventListener('submit', (e) => {
      const f = e.target, p = P;
      if (f.id === 'rv-form') {
        e.preventDefault();
        const ratings = {};
        C.RATING_AREAS.forEach(a => { const x = f.querySelector('input[name="rt-' + a + '"]:checked'); ratings[a] = x && x.value ? Number(x.value) : null; });
        const sel = $('#rv-aid').value, aid = sel === 'jiné' ? ($('#rv-aid-other').value.trim() || K.t('jiná pomůcka')) : sel;
        const files = [...$('#rv-photos').files].slice(0, 6), area = $('#rv-parea') ? $('#rv-parea').value : '';
        const btn = f.querySelector('button[type="submit"]'), msg = $('#rv-msg');
        btn.disabled = true; if (msg) msg.textContent = files.length ? KP.t('Zmenšuji fotky…') : KP.t('Ukládám…');
        C.addReview(p.i, { text: $('#rv-text').value, aid, ratings, photos: files, photoAreas: files.map(() => area) }).then(res => {
          btn.disabled = false;
          if (!res.ok) { if (msg) msg.textContent = res.error; return; }
          K.toast(KP.t('Hodnocení uloženo ve vašem prohlížeči.'));
          refresh('s-komunita', 's-foto', 's-zdroj');
          const h = $('#s-komunita-h'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
        });
        return;
      }
      if (f.id === 'rq-form') {
        e.preventDefault();
        const areas = [...f.querySelectorAll('input[name="rq-area"]:checked')].map(x => x.value);
        const r = C.requestInfo(p.i, { areas, note: $('#rq-note').value });
        K.toast(r ? KP.t('Žádost uložena ve vašem prohlížeči.') : KP.t('Žádost se nepodařilo uložit. Úložiště prohlížeče je možná plné.'));
        refresh('s-skore');
        return;
      }
      if (f.dataset.reportField) {
        e.preventDefault();
        const k = f.dataset.reportField, ta = f.querySelector('textarea');
        const r = C.report(p.i, (ta ? ta.value : '') || K.t('Údaj „{f}“ už neplatí.', { f: (K.FEATURES.find(x => x.k === k) || {}).label || k }), k);
        K.toast(r ? KP.t('Hlášení uloženo ve vašem prohlížeči.') : KP.t('Hlášení se nepodařilo uložit.'));
        refresh('s-potvrzeni');
      }
    });
  }

  async function init() {
    const sp = new URLSearchParams(location.search);
    const id = sp.get('id'), r = sp.get('r');
    let p, all;
    try {
      p = await K.findPlace(id, r);
      // okolí do 1,5 km: jen regiony, které do něj zasahují (u hranice i sousední země)
      all = p ? await K.loadPlacesInBounds({ s: p.la - 0.02, n: p.la + 0.02, w: p.lo - 0.03, e: p.lo + 0.03 }).catch(() => [p]) : [];
    } catch (e) { ROOT().innerHTML = ('<p class="callout">' + KP.t('Data se nepodařilo načíst. Otevřete web přes server, ne jako soubor.') + '</p>'); return; }
    if (!p) { ROOT().innerHTML = ('<div class="empty"><h1>' + KP.t('Místo jsme nenašli') + '</h1><p>' + KP.t('Odkaz je možná starý nebo místo z OpenStreetMap zmizelo.') + '</p><p><a class="btn btn-primary" href="mapa.html">' + KP.t('Zpět na mapu') + '</a></p></div>'); return; }
    // starý odkaz bez regionu: doplnit r, ať příště stačí načíst jen jeden region
    if (p._r && r !== p._r) { try { history.replaceState(null, '', K.placeUrl(p) + location.hash); } catch (e) { /* bez historie */ } }
    if (K.saved.has(p.i)) K.rememberRegion(p);
    P = p;
    NEAR = all.filter(x => Math.abs(x.la - p.la) < 0.02 && Math.abs(x.lo - p.lo) < 0.03).map(x => [K.distanceKm(p, x), x]).filter(([d]) => d <= 1.5).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    render(p);
    bind();
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
    // Změna potřeb: přepočítat jen osobní shodu, mapa v pravém sloupci se znovu nenačítá
    document.addEventListener('kp:needs', () => refresh('pl-match'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
