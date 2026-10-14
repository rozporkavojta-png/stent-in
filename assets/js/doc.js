/* Dlouhé textové stránky (Jak měříme, Zdroje a trh): tabulky se na mobilu složí do karet.
   Ke každé buňce doplní popisek sloupce (data-label) z hlavičky tabulky, už přeložený přes i18n.
   Zvýrazní i aktuální sekci v obsahu, pokud to stránka nedělá sama. */
(function () {
  'use strict';
  function labelTables() {
    document.querySelectorAll('.doc table.data').forEach(function (t) {
      var head = t.querySelector('thead tr');
      if (!head) return;
      var names = Array.prototype.map.call(head.children, function (th) { return th.textContent.replace(/\s+/g, ' ').trim(); });
      var ok = true;
      t.querySelectorAll('tbody tr').forEach(function (tr) {
        var cells = tr.children;
        if (cells.length !== names.length) { ok = false; return; }
        Array.prototype.forEach.call(cells, function (c, i) { if (names[i] && !c.hasAttribute('colspan')) c.setAttribute('data-label', names[i]); });
      });
      if (ok) t.setAttribute('data-cards', '');
    });
  }
  function tocSpy() {
    if (document.querySelector('.toc-m') || !('IntersectionObserver' in window)) return; // metodika má vlastní
    var links = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"]'));
    if (!links.length) return;
    var secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
    var io = new IntersectionObserver(function (es) {
      var vis = es.filter(function (e) { return e.isIntersecting; });
      if (!vis.length) return;
      var id = vis[0].target.id;
      links.forEach(function (a) { if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }, { rootMargin: '-20% 0px -70% 0px' });
    secs.forEach(function (s) { io.observe(s); });
  }
  function init() { setTimeout(function () { labelTables(); tocSpy(); }, 0); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
