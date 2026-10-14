/* Akce (akce.html): koncept komunitních setkání, workshopů a výletů, poctivý prázdný kalendář a formulář návrhu akce.
   PROTOTYP: návrhy se ukládají jen v localStorage (kp.eventProposals), nic se neodesílá, žádné akce ani termíny
   si nevymýšlíme. Výhody Explorer a Traveller (klíče plus a premium) jsou jen popsané, úroveň se dá vyzkoušet přepínačem (KP.tierSwitch). */
(function () {
  'use strict';
  const K = window.KP, t = (k, p) => K.t(k, p), esc = K.esc, $ = (s, r) => (r || document).querySelector(s);
  const KEY = 'eventProposals';
  const KIND = { setkani: t('Komunitní setkání'), workshop: t('Workshop'), vylet: t('Výlet') };
  const WHO = { ja: t('Od uživatele'), platforma: t('Návrh pro platformu') };
  const NEED = { vstup: t('Vstup bez schodů'), wc: t('Bezbariérové WC'), parkovani: t('Parkování ZTP'), doprava: t('Přístupná veřejná doprava') };
  const PLACES = new Map();

  const list = () => { const v = K.store.get(KEY, []); return Array.isArray(v) ? v : []; };

  function monthTxt(m) {
    if (!/^\d{4}-\d{2}$/.test(m || '')) return '';
    return K.i18n ? K.i18n.date(m) : m;
  }

  function renderMine() {
    const box = $('#ak-mine'), items = list();
    if (!items.length) { box.innerHTML = '<p class="muted small">' + t('Zatím jste žádnou akci nenavrhli.') + '</p>'; return; }
    box.innerHTML = '<ul class="ak-mine">' + items.slice().reverse().map(x => {
      const p = x.place ? PLACES.get(x.place.i) : null;
      const placeLink = x.place ? '<a href="' + K.placeUrl({ i: x.place.i, _r: x.place.r }) + '">' + esc(x.place.n || x.place.i) + '</a>' : '';
      const st = p && p.c !== 'parkovani' ? ' ' + K.statusHtml((K.W[p.w || 'null'] || K.W['null']).st, (K.W[p.w || 'null'] || K.W['null']).short) : '';
      const meta = [KIND[x.kind] || '', x.where || '', monthTxt(x.when)].filter(Boolean).map(esc).join(' · ');
      return '<li><div><p class="ak-kind-tag"><span class="badge badge-community">' + esc(WHO[x.who] || WHO.ja) + '</span><span class="badge badge-soon">' + t('jen v tomto prohlížeči') + '</span></p>' +
        '<h4>' + esc(x.name) + '</h4>' + (meta ? '<p class="small">' + meta + '</p>' : '') +
        (placeLink ? '<p class="small">' + t('Místo') + ': ' + placeLink + st + '</p>' : '') +
        (x.needs && x.needs.length ? '<p class="small">' + t('Místo by mělo mít') + ': ' + esc(x.needs.map(n => NEED[n] || n).join(', ')) + '</p>' : '') +
        (x.desc ? '<p class="small">' + esc(x.desc) + '</p>' : '') +
        '<p class="small muted">' + t('Uloženo {date}', { date: K.fmtDate(x.date) }) + '</p></div>' +
        '<button class="btn btn-quiet btn-sm" type="button" data-del="' + esc(x.id) + '" aria-label="' + esc(t('Smazat návrh {name}', { name: x.name })) + '">' + t('Smazat') + '</button></li>';
    }).join('') + '</ul>';
  }

  async function fillPlaces() {
    const ids = K.saved.all();
    if (!ids.length) return;
    const pairs = ids.map(i => [i, (K.store.get('placeRegion', {}) || {})[i] || '']);
    for (const [i, r] of pairs) { if (!PLACES.has(i)) { let p = null; try { p = await K.findPlace(i, r || undefined); } catch (e) { p = null; } PLACES.set(i, p); } }
    const found = ids.map(i => PLACES.get(i)).filter(Boolean);
    if (!found.length) return;
    $('#ak-place').innerHTML = '<option value="">' + t('Bez vazby na místo') + '</option>' + found.map(p => '<option value="' + esc(p.i) + '">' + esc(p.n + (p.o ? ' · ' + p.o : '')) + '</option>').join('');
    $('#ak-place-wrap').hidden = false;
    renderMine();
  }

  function bindForm() {
    const form = $('#ak-form'), msg = $('#ak-msg');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = $('#ak-name').value.trim();
      if (!name) { msg.textContent = t('Napište název akce.'); $('#ak-name').focus(); return; }
      if (!$('#ak-ok').checked) { msg.textContent = t('Zaškrtněte, že rozumíte uložení v prohlížeči.'); $('#ak-ok').focus(); return; }
      const pid = $('#ak-place') ? $('#ak-place').value : '';
      const p = pid ? PLACES.get(pid) : null;
      const item = {
        id: 'a' + Date.now().toString(36), name: name.slice(0, 100), kind: $('#ak-kind').value, who: $('#ak-who').value,
        where: $('#ak-where').value.trim().slice(0, 120), when: $('#ak-when').value || '',
        needs: [...form.querySelectorAll('[name="ak-need"]:checked')].map(c => c.value), desc: $('#ak-desc').value.trim().slice(0, 1500),
        place: p ? { i: p.i, r: p._r || '', n: p.n } : null, date: new Date().toISOString().slice(0, 10),
      };
      const items = list(); items.push(item);
      if (!K.store.set(KEY, items.slice(-50))) { msg.textContent = t('Návrh se nepodařilo uložit. Úložiště prohlížeče je plné nebo vypnuté.'); return; }
      form.reset();
      msg.textContent = t('Návrh uložen jen v tomto prohlížeči. Nic jsme neodeslali.');
      renderMine();
      const h = $('#ak-mine-h'); h.setAttribute('tabindex', '-1'); h.focus();
    });
    $('#ak-mine').addEventListener('click', e => {
      const b = e.target.closest('[data-del]'); if (!b) return;
      if (!b.dataset.confirm) {
        b.dataset.confirm = '1'; b.dataset.label = b.textContent; b.textContent = t('Opravdu smazat? Klikněte znovu');
        setTimeout(() => { if (b.isConnected && b.dataset.confirm) { delete b.dataset.confirm; b.textContent = b.dataset.label; } }, 5000);
        return;
      }
      K.store.set(KEY, list().filter(x => x.id !== b.dataset.del));
      msg.textContent = t('Návrh smazán.');
      renderMine();
      $('#ak-name').focus();
    });
  }

  function renderTier() {
    const k = K.tier();
    $('#ak-tier-line').innerHTML = t('Teď zkoušíte úroveň {tier}.', { tier: K.tierTag(k) }) + ' <button class="btn btn-quiet btn-sm" type="button" data-switch>' + t('Změnit úroveň (prototyp)') + '</button>';
    $('[data-switch]', $('#ak-tier-line')).addEventListener('click', () => K.tierSwitch());
  }

  // Filtr kalendáře: akce zatím žádné nejsou, filtr jen poctivě řekne, že ani v dané skupině nic není
  const EMPTY = { all: t('Zatím žádné naplánované akce'), vylet: t('Zatím žádné naplánované výlety'), setkani: t('Zatím žádná naplánovaná setkání'), workshop: t('Zatím žádné naplánované workshopy') };
  function bindFilter() {
    document.querySelectorAll('.ak-filters [data-ak]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.ak-filters [data-ak]').forEach(x => x.setAttribute('aria-pressed', x === b));
      $('#ak-empty-h').textContent = EMPTY[b.dataset.ak] || EMPTY.all;
      const k = $('#ak-kind'); if (k && b.dataset.ak !== 'all') k.value = b.dataset.ak;
    }));
  }

  function init() {
    bindFilter();
    $('#ak-tier-note').textContent = K.TIER_NOTE;
    renderTier();
    document.addEventListener('kp:tier', renderTier);
    renderMine();
    bindForm();
    fillPlaces();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
