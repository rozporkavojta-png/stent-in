/* Detail místa – vše z data/regions/ (OpenStreetMap + otevřená data měst + weby provozovatelů), nic se nedomýšlí.
   Odkaz: misto.html?id=<id>&r=<region>; starý odkaz bez r dohledá region přes data/regions/ids.json.
   Rozvržení (verze 3, DESIGN.md): velký název a vedle něj fotka z Wikimedia Commons (pokud existuje),
   4 klíčové údaje jako .tile s linkou nahoře, sekce jako výpisy s linkami, vpravo (desktop) lepící sloupec
   bez rámečků s mapou, kontaktem a zdrojem dat. Na mobilu lepící spodní lišta s akcemi. */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s);
  const ROOT = () => $('#place');

  const miss = 'zatím neuvedeno';
  const row = (label, val, missing) => '<div><dt>' + label + '</dt><dd' + (missing ? ' class="missing"' : '') + '>' + val + '</dd></div>';
  const rows = (list) => list.length ? '<dl class="kv">' + list.join('') + '</dl>' : '';
  const yesno = (v) => ({ yes: 'ano', no: 'ne', limited: 'částečně', designated: 'ano (vyhrazené)', automatic: 'automatické' }[v] || K.esc(v));
  const SRC_NAMES = { brno: 'Otevřená data Brno', praha: 'Praha bez bariér (POV)', praha_ipr: 'IPR Praha', euroklic: 'Euroklíč', mapybezbarier: 'Mapy bez bariér' };
  const CAT_ST = { 'Přístupný': 'ok', 'Částečně přístupný': 'part', 'Nepřístupný': 'no' };
  const T_SHORT = { yes: 'Bezbariérová', limited: 'Částečně', no: 'Není bezbariérová' };
  const X_VISIBLE = 8;

  const isResearch = (p) => !!p.nw || /^rh[0-9a-f]+$/.test(p.i);
  const safeUrl = (u) => /^https?:\/\//i.test(u || '') ? u : '';
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  const dist = (d) => d < 1 ? Math.round(d * 1000) + ' m' : K.fmt(d.toFixed(1)) + ' km';
  const ext = (href, text) => '<a href="' + K.esc(href) + '" target="_blank" rel="noopener">' + text + K.icon('external', 'i inline') + '</a>';

  function sec(id, title, inner, extra) {
    return '<section class="pl-sec" id="' + id + '" aria-labelledby="' + id + '-h"><div class="pl-sec-head"><h2 id="' + id + '-h">' + title + '</h2>' + (extra || '') + '</div>' + inner + '</section>';
  }
  function osmSrc(p) {
    if (isResearch(p)) return '<p class="pl-src">' + K.sourceBadge('firma') + '<span>Podle webu provozovatele. Místo zatím není v OpenStreetMap.</span></p>';
    return '<p class="pl-src">' + K.sourceBadge('komunita') +
      (p.u ? '<span>Upraveno ' + K.fmtDate(p.u) + ' (' + K.ageLabel(p.u) + ')</span>' : '') +
      '<span>' + (p.cd ? 'Kontrola na místě ' + K.fmtDate(p.cd) : 'Bez data kontroly na místě') + '</span></p>';
  }

  // ---------- Verdikt podle potřeb ----------
  function verdict(p) {
    const needs = K.getNeeds();
    let st, title, text, btn;
    if (needs.active) {
      const m = K.match(p, needs);
      const lines = [];
      if (m.fails.length) lines.push('Nevyhovuje: ' + m.fails.join(', '));
      if (m.unknown.length) lines.push('Chybí: ' + m.unknown.join(', '));
      if (m.reasons.length) lines.push('Splňuje: ' + m.reasons.join(', '));
      st = m.status; title = K.STATUS_LABEL[m.status]; text = K.esc(lines.join('. ')) + (lines.length ? '. ' : '') + 'Podle vašeho nastavení (' + K.esc(needs.aid) + ').';
      btn = 'Změnit potřeby';
    } else if (p.c === 'parkovani') {
      st = 'ok'; title = 'Parkování pro držitele průkazu ZTP'; text = p.pk ? p.pk + ' vyhrazených míst podle OpenStreetMap.' : 'Vyhrazené parkovací místo.'; btn = '';
    } else {
      const w = K.W[p.w || 'null'];
      st = w.st; title = w.label; text = w.help; btn = 'Nastavit moje potřeby';
    }
    return '<div class="pl-verdict ' + st + '"><span class="status ' + st + ' big"><i></i></span><div><p class="pl-verdict-title">' + title + '</p><p class="pl-verdict-text">' + text + '</p></div>' +
      (btn ? '<button class="btn btn-quiet btn-sm" type="button" data-open-needs-inline>' + K.icon('sliders') + btn + '</button>' : '') + '</div>';
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
      const sub = p.sc !== undefined ? 'Schodů u vstupu: ' + p.sc : p.dw ? 'Dveře ' + p.dw + ' cm' : p.rp ? 'Rampa: ' + yesno(p.rp) : '';
      out.push(tile('#s-vstup', 'door', 'Vstup', K.statusHtml(w.st, w.short), sub));
      out.push(tile('#s-wc', 'wc', 'Toaleta', p.t ? K.statusHtml(K.T[p.t].st, T_SHORT[p.t]) : K.statusHtml('unk', 'Neuvedeno'), p.ek ? 'Na Euroklíč' : ''));
    }
    const pkV = p.pk ? K.statusHtml('ok', p.pk + ' ' + (p.pk === 1 ? 'místo' : p.pk < 5 ? 'místa' : 'míst')) : p.pw ? K.statusHtml(p.pw === 'no' ? 'no' : 'ok', yesno(p.pw)) : K.statusHtml('unk', p.c === 'parkovani' ? 'Počet neuveden' : 'Neuvedeno');
    out.push(tile('#s-pk', 'parking', 'Parkování ZTP', pkV, !p.pk && !p.pw && nearPk ? 'Nejbližší stání ' + dist(K.distanceKm(p, nearPk)) : ''));
    if (p.c === 'parkovani' && p.fee) out.push(tile('#s-pk', 'info', 'Placené', '<b>' + yesno(p.fee) + '</b>', ''));
    if (Array.isArray(p.x) && p.x.length) {
      const x = p.x[0];
      const v = x.cat && CAT_ST[x.cat] ? K.statusHtml(CAT_ST[x.cat], K.esc(x.cat)) : '<b>Ano</b>';
      out.push(tile('#s-x', 'ruler', 'Naměřeno', v, K.esc(SRC_NAMES[x.src] || x.label || 'otevřená data') + (p.x.length > 1 ? ' a další' : '')));
    } else {
      const c = K.completeness(p);
      out.push(tile('#s-zdroj', 'ruler', 'Úplnost údajů', '<b class="num">' + c + ' %</b>', '<span class="tape-meter" style="--v:' + c + '" aria-hidden="true"></span>'));
    }
    return '<div class="pl-tiles">' + out.join('') + '</div>';
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
      const rs = (x.rows || []).map(xRow).filter(r => r[1] !== '' && r[1] !== null && r[1] !== undefined).map(r => row(K.esc(r[0]), K.esc(clean(r[1]))));
      const head = '<div class="pl-sub"><h3>' + K.esc(x.label || SRC_NAMES[x.src] || x.src || 'Otevřená data') + '</h3>' + (x.cat && CAT_ST[x.cat] ? K.statusHtml(CAT_ST[x.cat], K.esc(x.cat)) : '') + '</div>';
      const more = rs.length > X_VISIBLE ? '<details class="pl-more"><summary>Zobrazit dalších ' + (rs.length - X_VISIBLE) + ' údajů</summary>' + rows(rs.slice(X_VISIBLE)) + '</details>' : '';
      return '<div class="pl-group">' + head + rows(rs.slice(0, X_VISIBLE)) + more +
        '<p class="pl-src">' + K.sourceBadge('overeno') + (x.date ? '<span>Stav ' + K.fmtDate(x.date) + '</span>' : '') +
        (x.license ? '<span>Licence ' + K.esc(x.license) + (x.attribution ? ', © ' + K.esc(x.attribution) : '') + '</span>' : '') +
        (safeUrl(x.url) ? ext(x.url, 'Zdroj') : '') + '</p></div>';
    }).join('');
    return sec('s-x', 'Naměřené údaje', inner);
  }

  // ---------- Podle webu provozovatele (pole r) ----------
  const R_ITEMS = [['vstup', 'Vstup'], ['wc', 'Toaleta'], ['pokoj', 'Pokoj'], ['koupelna', 'Koupelna'], ['parkovani', 'Parkování'], ['vytah', 'Výtah'], ['jine', 'Další informace']];
  const R_CLAIM = { yes: ['ok', 'Web uvádí, že je místo bezbariérové'], limited: ['part', 'Web uvádí omezenou přístupnost'], no: ['no', 'Web uvádí, že místo není bezbariérové'] };
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
        (meas.length ? '<p class="pl-label">Rozměry uvedené na webu</p><ul class="kotas">' + meas.map(kota).join('') + '</ul>' : '') +
        (r.quote ? '<blockquote class="pl-quote">„' + K.esc(r.quote) + '“</blockquote>' : '') +
        '<p class="pl-src"><span class="badge badge-business">' + K.icon('building') + K.esc(r.source_type || 'web provozovatele') + '</span>' +
        (r.date ? '<span>Zkontrolováno ' + K.fmtDate(r.date) + '</span>' : '') + ext(safeUrl(r.url), K.esc(host(r.url))) + '</p></div>';
    }).join('');
    return sec('s-r', 'Podle webu provozovatele', inner +
      '<p class="small muted pl-note">Tyto údaje uvádí sám provozovatel nebo jiný oficiální web. Nikdo je nezměřil nezávisle, proto si před cestou ověřte, co je pro vás důležité.</p>',
      '<span class="badge badge-business" title="Údaj převzatý z webu provozovatele. Nikdo ho nezměřil nezávisle.">' + K.icon('building') + 'Provozovatel</span>');
  }

  // ---------- Vstup, toaleta, parkování (OpenStreetMap) ----------
  function basics(p, near) {
    let html = '';
    if (p.c !== 'parkovani') {
      const w = K.W[p.w || 'null'];
      html += '<div class="pl-group" id="s-vstup"><h3>Vstup</h3>' + rows([
        row('Přístupnost vstupu', K.statusHtml(w.st, w.label), !p.w),
        row('Počet schodů u vstupu', p.sc !== undefined ? '<span class="num">' + p.sc + '</span>' : miss, p.sc === undefined),
        row('Rampa', p.rp ? yesno(p.rp) : miss, !p.rp),
        row('Šířka dveří', p.dw ? '<span class="num">' + p.dw + ' cm</span> ' + (p.dw >= 80 ? K.statusHtml('ok', 'splňuje 80 cm') : p.dw >= 70 ? K.statusHtml('part', 'pod 80 cm') : K.statusHtml('no', 'pod 70 cm')) : miss, !p.dw),
      ]) + '</div>';
      if (!(['priroda'].includes(p.c) && !p.t)) {
        const t = [row('Bezbariérová toaleta', p.t ? K.statusHtml(K.T[p.t].st, K.T[p.t].label) : miss, !p.t)];
        if (p.ek) t.push(row('Euroklíč', 'ano, otevřete univerzálním klíčem'));
        if (p.cp) t.push(row('Přebalovací pult', yesno(p.cp)));
        if (p.c === 'wc' && p.fee) t.push(row('Poplatek', yesno(p.fee)));
        html += '<div class="pl-group" id="s-wc"><h3>Toaleta</h3>' + rows(t) + '</div>';
      }
    }
    const nearPk = near.filter(x => x.c === 'parkovani' && x.i !== p.i).slice(0, 3);
    const pk = [row(p.c === 'parkovani' ? 'Vyhrazená místa ZTP' : 'Parkování ZTP u objektu', p.pk ? '<span class="num">' + p.pk + '</span> vyhrazených míst' : p.pw ? yesno(p.pw) : miss, !(p.pk || p.pw))];
    if (p.fee && p.c === 'parkovani') pk.push(row('Placené', yesno(p.fee)));
    if (p.op && p.c === 'parkovani') pk.push(row('Provozovatel', K.esc(p.op)));
    html += '<div class="pl-group" id="s-pk"><h3>Parkování</h3>' + rows(pk) +
      (nearPk.length ? '<p class="pl-label">Nejbližší vyhrazená stání ZTP</p><ul class="pl-near">' + nearPk.map(x => nearItem(x, p)).join('') + '</ul>' : '') + '</div>';
    return sec('s-osm', p.c === 'parkovani' ? 'Parkování' : 'Vstup, toaleta a parkování', html + osmSrc(p));
  }

  function description(p) {
    if (!p.d && !p.de) return '';
    return sec('s-popis', 'Popis přístupnosti', '<blockquote class="pl-quote">' + K.esc(p.d || p.de) + '</blockquote>' + osmSrc(p));
  }

  // Fotka z Wikimedia Commons: velká nahoře vedle názvu (3:2), s odkazem na autora a licenci
  function heroPhoto(p) {
    if (!p.img) return '';
    const src = (w) => K.commonsImg(p.img, w);
    return '<figure class="photo pl-photo"><img src="' + src(960) + '" srcset="' + src(640) + ' 640w, ' + src(960) + ' 960w, ' + src(1280) + ' 1280w" sizes="(min-width: 900px) 46vw, 100vw" width="960" height="640" alt="Fotografie: ' + K.esc(p.n) + '" decoding="async">' +
      '<figcaption>Foto: Wikimedia Commons, ' + ext(K.commonsPage(p.img), 'autor a licence') + '</figcaption></figure>';
  }

  function photos(p) {
    return sec('s-foto', 'Fotky a Street View', '<div class="pl-sv"><div><p class="pl-sv-title">Prohlédněte si vstup ve Street View</p><p class="small muted">Snímky ulice od Google ukážou schody, obrubníky i dveře dřív, než vyrazíte. Stáří snímku uvidíte v Google Maps.</p>' +
      '<a class="btn btn-ghost btn-sm" href="' + K.gmaps.streetView(p) + '" target="_blank" rel="noopener">' + K.icon('external') + 'Otevřít Street View</a></div></div>' +
      (p.img ? '' : '<p class="small muted">Vlastní fotku vstupu, toalety ani parkování zatím nemáme. <a href="pridat.html?id=' + encodeURIComponent(p.i) + '">Nahrajte ji</a>.</p>'));
  }

  function experiences(p) {
    const mine = (K.store.get('exp', {})[p.i] || []);
    const list = mine.length ? '<ul class="pl-exp">' + mine.map(e => '<li><p class="small muted"><b>Vy</b> · ' + K.esc(e.aid || 'pomůcka neuvedena') + ' · ' + K.fmtDate(e.date) + ' · uloženo jen ve vašem prohlížeči</p><p>' + K.esc(e.text) + '</p></li>').join('') + '</ul>'
      : '<p class="muted">Zatím tu nikdo nenapsal zkušenost. Byli jste tu? Pomozte dalším.</p>';
    return sec('s-zkus', 'Zkušenosti návštěvníků', list +
      '<details class="pl-write"' + (mine.length ? '' : ' open') + '><summary class="btn btn-ghost">' + K.icon('message') + 'Napsat zkušenost</summary>' +
      '<form class="pl-form" id="exp-form"><div class="field"><label for="exp-aid">Čím se pohybujete <span class="hint">(dobrovolné)</span></label><select id="exp-aid"><option value="">Neuvádět</option><option>mechanický vozík</option><option>elektrický vozík</option><option>vozík s přídavným pohonem</option><option>chodítko</option><option>berle</option><option>kočárek</option></select></div>' +
      '<div class="field"><label for="exp-text">Jak to šlo?</label><textarea id="exp-text" required placeholder="Např. vstup ze dvora je bez schodu, WC je v 1. patře, výtah funguje."></textarea></div>' +
      '<div class="row"><button class="btn btn-primary" type="submit">Uložit zkušenost</button><span class="small muted">Prototyp: zkušenost zůstane jen ve vašem prohlížeči.</span></div></form></details>');
  }

  function nearItem(x, p) {
    return '<li><a href="' + K.placeUrl(x) + '">' + (x.c === 'parkovani' ? K.statusHtml('ok', '') : K.statusHtml(K.W[x.w || 'null'].st, '')) +
      '<span class="nm"><b>' + K.esc(x.n) + '</b><span>' + K.esc(x.s) + (x.t === 'yes' ? ' · bezbariérové WC' : '') + (x.pk ? ' · ' + x.pk + '× ZTP' : '') + '</span></span><span class="d num">' + dist(K.distanceKm(p, x)) + '</span></a></li>';
  }

  function nearby(p, near) {
    const groups = {
      pristupne: { label: 'Přístupná místa', list: near.filter(x => x.i !== p.i && x.w === 'yes' && x.c !== 'parkovani') },
      wc: { label: 'Bezbariérová WC', list: near.filter(x => x.i !== p.i && x.t === 'yes') },
      ubytovani: { label: 'Ubytování', list: near.filter(x => x.i !== p.i && x.c === 'ubytovani' && x.w !== 'no') },
    };
    const keys = Object.keys(groups).filter(k => groups[k].list.length);
    if (!keys.length) return '';
    return sec('s-okoli', 'V okolí do 1,5 km',
      '<div class="chip-row pl-tabs" role="tablist" aria-label="Druh míst v okolí">' + keys.map((k, i) => '<button class="chip" type="button" role="tab" id="tab-' + k + '" aria-controls="panel-' + k + '" aria-selected="' + (i === 0) + '" data-tab="' + k + '">' + groups[k].label + ' <span class="num">' + groups[k].list.length + '</span></button>').join('') + '</div>' +
      keys.map((k, i) => '<ul class="pl-near" role="tabpanel" id="panel-' + k + '" aria-labelledby="tab-' + k + '" data-panel="' + k + '"' + (i ? ' hidden' : '') + '>' + groups[k].list.slice(0, 8).map(x => nearItem(x, p)).join('') + '</ul>').join(''));
  }

  // ---------- Pravý sloupec ----------
  function mapCard(p) {
    return '<div class="pl-card pl-map"><iframe class="pl-gmap" src="' + K.gmaps.embed(p) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Google mapa: ' + K.esc(p.n) + '"></iframe>' +
      '<div class="pl-card-body"><a class="btn btn-primary btn-block" href="' + K.gmaps.directions(p, 'walking') + '" target="_blank" rel="noopener">' + K.icon('nav') + 'Navigovat pěšky nebo na vozíku</a>' +
      '<div class="pl-modes"><a class="btn btn-ghost btn-sm" href="' + K.gmaps.directions(p, 'transit') + '" target="_blank" rel="noopener">MHD</a><a class="btn btn-ghost btn-sm" href="' + K.gmaps.directions(p, 'driving') + '" target="_blank" rel="noopener">Autem</a></div>' +
      '<p class="small muted">Google Maps neumí trasu bez schodů. Bariéry v ulicích ukazujeme na stránce <a href="trasy.html?la=' + p.la + '&lo=' + p.lo + '">Trasy</a>.</p></div></div>';
  }

  function contact(p) {
    const r = [];
    if (p.a || p.o) r.push(row('Adresa', K.esc([p.a, p.o].filter(Boolean).join(', '))));
    if (p.web) r.push(row('Web', '<a href="' + K.esc(/^https?:/.test(p.web) ? p.web : 'https://' + p.web) + '" target="_blank" rel="noopener">' + K.esc(p.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + '</a>'));
    if (p.ph) r.push(row('Telefon', '<a class="num" href="tel:' + K.esc(p.ph.replace(/[^+\d]/g, '')) + '">' + K.esc(p.ph) + '</a>'));
    if (p.oh) r.push(row('Otevírací doba', '<span class="pl-oh">' + K.esc(p.oh.replace(/;\s*/g, '\n')) + '</span>'));
    if (p.st) r.push(row('Hvězdičky', K.esc(p.st)));
    if (p.op && p.c !== 'parkovani') r.push(row('Provozovatel', K.esc(p.op)));
    const de = K.zemeOf(p) === 'de';
    r.push(row(de ? 'Vládní obvod' : 'Kraj', p.k ? '<a href="kraj.html?k=' + encodeURIComponent(p.k) + '">' + K.esc(K.krajName(p.k, K.zemeOf(p))) + '</a>' : '–'));
    r.push(row('Země', K.esc(K.ZEME_LONG[K.zemeOf(p)] || '–')));
    return '<div class="pl-card pl-contact" id="s-kontakt"><h2>Kontakt</h2>' + rows(r) + '</div>';
  }

  function dataSource(p) {
    const c = K.completeness(p), missing = K.missingFields(p);
    const body = isResearch(p)
      ? '<p class="small">Místo zatím není v OpenStreetMap. Název, poloha a údaje pocházejí z webu provozovatele' + (p.r && p.r[0] && p.r[0].date ? ', zkontrolováno ' + K.fmtDate(p.r[0].date) : '') + '. Polohu si před cestou ověřte na mapě.</p>'
      : !K.isOsm(p) ? '<p class="small">Místo pochází z otevřených dat uvedených v oddílu „Naměřené údaje“ (zdroj, licence a datum jsou u nich). V OpenStreetMap jsme ho zatím nenašli.</p>'
      : '<p class="small">Údaje o přístupnosti pocházejí z ' + ext(K.osmUrl(p), 'OpenStreetMap (objekt ' + K.esc(p.i.slice(1)) + ', verze ' + K.esc(p.v || '–') + ')') + ', staženo ' + K.fmtDate(K.OSM_DATE[K.zemeOf(p)] || K.OSM_DATE.cz) + (K.zemeOf(p) === 'de' ? ' (výřez Geofabrik pro Bavorsko)' : '') + '. Data © přispěvatelé OpenStreetMap, licence ODbL.</p>' +
        (p.r && p.r.length ? '<p class="small">Údaje „Podle webu provozovatele“ jsme převzali z uvedeného webu, data OSM nijak nemění.</p>' : '');
    return '<div class="pl-card" id="s-zdroj"><h2>Zdroj dat a úplnost</h2>' +
      '<p class="pl-badges">' + (isResearch(p) ? K.sourceBadge('firma') : K.sourceBadge('komunita')) + (Array.isArray(p.x) && p.x.length ? K.sourceBadge('overeno') : '') + '</p>' + body +
      '<div class="meter-row"><span class="small">Úplnost údajů</span><span class="num">' + c + ' %</span><div class="tape-meter" style="--v:' + c + ';grid-column:1/-1" aria-hidden="true"></div></div>' +
      '<p class="small muted">Úplnost říká, kolik důležitých údajů máme, ne jestli je místo přístupné. <a href="metodika.html#uplnost">Jak ji počítáme</a></p>' +
      (missing.length ? '<details class="pl-more"><summary>Chybí ' + missing.length + ' ' + (missing.length === 1 ? 'údaj' : missing.length < 5 ? 'údaje' : 'údajů') + '</summary><ul class="pl-missing">' + missing.map(m => '<li>' + m + '</li>').join('') + '</ul></details>' : '') +
      '<div class="pl-modes"><a class="btn btn-ghost btn-sm" href="pridat.html?id=' + encodeURIComponent(p.i) + '">' + K.icon('plus') + 'Doplnit údaje</a>' +
      '<a class="btn btn-ghost btn-sm" href="' + (isResearch(p) ? 'https://www.openstreetmap.org/edit#map=19/' + p.la + '/' + p.lo : K.osmEditUrl(p)) + '" target="_blank" rel="noopener">' + (isResearch(p) ? 'Přidat do OSM' : 'Upravit v OSM') + '</a></div>' +
      '<p class="small" style="margin:0">Něco nesedí? <a href="pridat.html?id=' + encodeURIComponent(p.i) + '&nahlasit=1">Nahlaste změnu</a>.</p></div>';
  }

  function jumpNav(html) {
    const items = [['s-x', 'Naměřeno'], ['s-r', 'Od provozovatele'], ['s-osm', 'Vstup a WC'], ['s-popis', 'Popis'], ['s-foto', 'Fotky'], ['s-zkus', 'Zkušenosti'], ['s-okoli', 'V okolí'], ['s-kontakt', 'Kontakt']];
    return '<nav class="chip-row pl-jump" aria-label="Na této stránce">' + items.filter(([id]) => html.includes('id="' + id + '"')).map(([id, l]) => '<a class="chip" href="#' + id + '">' + l + '</a>').join('') + '</nav>';
  }

  const saveLabel = (on) => K.icon('bookmark') + (on ? 'Uloženo' : 'Uložit');

  function render(p, all) {
    document.title = p.n + ' · kudyprojedu.cz';
    const near = all.filter(x => Math.abs(x.la - p.la) < 0.02 && Math.abs(x.lo - p.lo) < 0.03).map(x => [K.distanceKm(p, x), x]).filter(([d]) => d <= 1.5).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const on = K.saved.has(p.i);
    const cat = K.CATS[p.c] ? K.CATS[p.c].label : '';
    const main = measured(p) + operatorInfo(p) + basics(p, near) + description(p) + photos(p) + experiences(p) + nearby(p, near);
    const aside = contact(p) + dataSource(p);

    ROOT().innerHTML =
      '<nav class="pl-crumbs" aria-label="Drobečková navigace"><a href="mapa.html">Mapa</a><span aria-hidden="true">›</span>' +
      (K.zemeOf(p) === 'de' ? '<a href="mapa.html?zeme=de">Bavorsko</a><span aria-hidden="true">›</span>' : '') +
      (p.k ? '<a href="kraj.html?k=' + encodeURIComponent(p.k) + '">' + K.esc(p.k) + '</a><span aria-hidden="true">›</span>' : '') +
      (p.o ? '<a href="mapa.html?q=' + encodeURIComponent(p.o) + '">' + K.esc(p.o) + '</a><span aria-hidden="true">›</span>' : '') +
      '<span aria-current="page">' + K.esc(p.n) + '</span></nav>' +
      '<header class="pl-head' + (p.img ? ' has-photo' : '') + '"><div class="pl-head-text">' + (cat ? '<p class="kicker">' + K.esc(cat) + '</p>' : '') + '<h1>' + K.esc(p.n) + '</h1>' +
      '<p class="pl-meta">' + K.esc([p.s !== cat ? p.s : '', [p.a, p.o].filter(Boolean).join(', ')].filter(Boolean).join(' · ')) + '</p>' +
      '<div class="pl-actions"><a class="btn btn-primary hide-md" href="' + K.gmaps.directions(p) + '" target="_blank" rel="noopener">' + K.icon('nav') + 'Navigovat</a>' +
      '<a class="btn btn-ghost" href="' + K.gmaps.streetView(p) + '" target="_blank" rel="noopener">' + K.icon('eye') + 'Street View</a>' +
      '<button class="btn btn-ghost hide-md" type="button" data-save aria-pressed="' + on + '">' + saveLabel(on) + '</button>' +
      '<button class="btn btn-ghost" type="button" id="share">' + K.icon('share') + 'Sdílet</button>' +
      '<a class="btn btn-quiet" href="pridat.html?id=' + encodeURIComponent(p.i) + '&nahlasit=1">' + K.icon('flag') + 'Nahlásit změnu</a></div></div>' + heroPhoto(p) + '</header>' +
      '<div class="pl-layout">' +
      '<div class="pl-top">' + verdict(p) + tiles(p, near) + jumpNav(main + aside) + '</div>' +
      '<aside class="pl-aside" aria-label="Mapa, kontakt a zdroj dat"><div class="pl-aside-map">' + mapCard(p) + '</div><div class="pl-aside-info">' + aside + '</div></aside>' +
      '<div class="pl-main">' + main + '</div>' +
      '</div>' +
      '<div class="pl-actionbar"><a class="btn btn-primary" href="' + K.gmaps.directions(p) + '" target="_blank" rel="noopener">' + K.icon('nav') + 'Navigovat</a>' +
      '<button class="btn btn-ghost" type="button" data-save aria-pressed="' + on + '">' + saveLabel(on) + '</button></div>';

    ROOT().querySelectorAll('[data-open-needs-inline]').forEach(b => b.addEventListener('click', K.needsDrawer));
    ROOT().querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', () => {
      const now = K.saved.toggle(p.i, p);
      ROOT().querySelectorAll('[data-save]').forEach(x => { x.setAttribute('aria-pressed', now); x.innerHTML = saveLabel(now); });
      K.toast(now ? 'Místo uloženo do profilu.' : 'Místo odebráno z uložených.');
    }));
    $('#share').addEventListener('click', () => {
      const url = location.href;
      if (navigator.share) { navigator.share({ title: p.n, url }).catch(() => {}); return; }
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => K.toast('Odkaz zkopírován.')).catch(() => K.toast(url));
    });
    ROOT().querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
      ROOT().querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === b));
      ROOT().querySelectorAll('[data-panel]').forEach(x => { x.hidden = x.dataset.panel !== b.dataset.tab; });
    }));
    const f = $('#exp-form');
    if (f) f.addEventListener('submit', e => {
      e.preventDefault();
      const text = $('#exp-text').value.trim(); if (!text) return;
      const store = K.store.get('exp', {}); (store[p.i] = store[p.i] || []).push({ text, aid: $('#exp-aid').value, date: new Date().toISOString().slice(0, 10) });
      K.store.set('exp', store); K.toast('Zkušenost uložena ve vašem prohlížeči.'); render(p, all);
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
    } catch (e) { ROOT().innerHTML = '<p class="callout">Data se nepodařilo načíst. Otevřete web přes server, ne jako soubor.</p>'; return; }
    if (!p) { ROOT().innerHTML = '<div class="empty"><h1>Místo jsme nenašli</h1><p>Odkaz je možná starý nebo místo z OpenStreetMap zmizelo.</p><p><a class="btn btn-primary" href="mapa.html">Zpět na mapu</a></p></div>'; return; }
    // starý odkaz bez regionu: doplnit r, ať příště stačí načíst jen jeden region
    if (p._r && r !== p._r) { try { history.replaceState(null, '', K.placeUrl(p) + location.hash); } catch (e) { /* bez historie */ } }
    if (K.saved.has(p.i)) K.rememberRegion(p);
    render(p, all);
    document.addEventListener('kp:needs', () => render(p, all));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
