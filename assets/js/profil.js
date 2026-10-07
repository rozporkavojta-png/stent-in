/* Můj profil: potřeby, uložená místa a rozepsané příspěvky – vše z localStorage */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s);

  function setCount(sel, n) { const el = $(sel); el.hidden = !n; el.textContent = n; }

  function renderNeeds() {
    const n = K.getNeeds();
    $('#needs-state').innerHTML = n.active ? K.statusHtml('ok', 'Zapnuto') : K.statusHtml('unk', 'Vypnuto');
    const row = (b, t) => '<li class="rule-row ' + (b ? 'on' : 'off') + '"><span>' + t + '</span><b class="nv">' + K.icon(b ? 'check' : 'close') + (b ? 'Ano' : 'Ne') + '</b></li>';
    $('#needs').innerHTML = n.active
      ? '<p class="small muted">Místa na mapě hodnotíme podle těchto potřeb.</p><ul class="needs-list rule-list">' +
        '<li class="rule-row on"><span>Pohybuji se</span><b class="nv">' + K.esc(n.aid) + '</b></li>' +
        row(n.acceptLimited, 'Zvládnu i částečně přístupná místa') + row(n.needWc, 'Potřebuji bezbariérovou toaletu') +
        row(n.needParking, 'Potřebuji parkování ZTP') + row(n.onlyChecked, 'Jen údaje ověřené na místě') + '</ul>'
      : '<p class="small muted">Zatím nemáte nastavené potřeby. Když je vyplníte, uvidíte u každého místa, jestli vám vyhovuje.</p>';
    const b = $('.pf-needs [data-open-needs]');
    if (b) b.lastChild.textContent = n.active ? 'Upravit potřeby' : 'Nastavit potřeby';
  }

  // Řádek uloženého místa: fotka z Wikimedia Commons, jen pokud ji místo má
  function placeRow(p) {
    const st = p.c !== 'parkovani' ? K.statusHtml(K.W[p.w || 'null'].st, K.W[p.w || 'null'].short) : '';
    const ph = p.img ? '<figure class="photo pf-ph"><img src="' + K.esc(K.commonsImg(p.img, 640)) + '" alt="" loading="lazy" decoding="async">' +
      '<figcaption><a href="' + K.esc(K.commonsPage(p.img)) + '" target="_blank" rel="noopener">Foto: Wikimedia Commons</a></figcaption></figure>' : '';
    return '<li class="rule-row pf-row' + (ph ? ' has-ph' : '') + '">' + ph +
      '<div class="pf-txt"><a class="pf-link" href="misto.html?id=' + encodeURIComponent(p.i) + '"><b>' + K.esc(p.n) + '</b></a>' +
      '<small>' + K.esc([p.s, p.o].filter(Boolean).join(' · ')) + '</small>' + st + '</div></li>';
  }
  // Fotka, která se nenačte, zmizí i s popiskem; řádek funguje dál bez ní
  function dropBrokenPhotos(root) {
    root.querySelectorAll('.pf-ph img').forEach(img => img.addEventListener('error', () => {
      const li = img.closest('.pf-row'); if (li) li.classList.remove('has-ph'); img.closest('figure').remove();
    }, { once: true }));
  }

  function renderSaved() {
    const ids = K.saved.all();
    setCount('#saved-n', ids.length);
    if (!ids.length) {
      $('#saved').innerHTML = '<div class="pf-empty"><p class="muted">Zatím nemáte uložená žádná místa. Uložíte je tlačítkem Uložit v detailu místa.</p><a class="btn btn-primary" href="mapa.html">Otevřít mapu</a></div>';
      return;
    }
    K.loadPlaces().then(() => {
      const items = ids.map(id => K.placeById(id)).filter(Boolean);
      const missing = ids.length - items.length;
      $('#saved').innerHTML = '<ul class="pf-list rule-list">' + items.map(placeRow).join('') + '</ul>' +
        (missing ? '<p class="small muted">' + missing + ' uložených míst už v aktuálních datech není.</p>' : '');
      dropBrokenPhotos($('#saved'));
    }).catch(() => { $('#saved').innerHTML = '<p class="muted">Seznam míst se nepodařilo načíst.</p>'; });
  }

  function renderDrafts() {
    const d = K.store.get('drafts', []);
    setCount('#drafts-n', d.length);
    if (!d.length) {
      $('#drafts').innerHTML = '<div class="pf-empty"><p class="muted">Zatím jste nic nepřidali.</p><a class="btn btn-ghost" href="pridat.html">Přidat místo</a></div>';
      return;
    }
    $('#drafts').innerHTML = '<p class="small muted">Uloženo jen v tomto prohlížeči, zatím neodesláno.</p><ul class="pf-list rule-list">' + d.map(x =>
      '<li><a class="rule-row pf-draft" href="' + (x.place && x.place.i ? 'misto.html?id=' + encodeURIComponent(x.place.i) : 'pridat.html') + '">' +
      '<span class="pf-date num">' + K.fmtDate(x.created) + '</span>' +
      '<span class="pf-txt"><b>' + K.esc(x.place && x.place.n || 'Bez názvu') + '</b><small>' +
      Object.keys(x.values || {}).length + ' údajů · ' + (x.photos || []).length + ' fotek' + (x.category ? ' · ' + K.esc(x.category) : '') + '</small></span>' +
      '<span class="pf-go">' + K.icon('arrow') + '</span></a></li>').join('') + '</ul>' +
      '<button class="btn btn-quiet btn-sm pf-clear" type="button" id="clear-drafts">Smazat všechny příspěvky</button>';
    $('#clear-drafts').addEventListener('click', function () {
      if (this.dataset.confirm) { K.store.set('drafts', []); renderDrafts(); K.toast('Příspěvky smazány.'); }
      else { this.dataset.confirm = '1'; this.textContent = 'Opravdu smazat? Klikněte znovu'; }
    });
  }

  function init() { renderNeeds(); renderSaved(); renderDrafts(); document.addEventListener('kp:needs', renderNeeds); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
