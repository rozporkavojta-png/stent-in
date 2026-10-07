# STENT-IN – kudyprojedu.cz

Studentský prototyp pro program **STENT-IN 2026** (VŠTE České Budějovice + OTH Regensburg, Interreg Bavorsko–Česko).
Mapa skutečných míst v Česku a v Bavorsku s údaji o přístupnosti pro lidi na vozíku a s omezenou pohyblivostí:
vstup, toaleta, parkování pro ZTP, naměřené rozměry, informace od provozovatelů a fotky.

**Web:** https://rozporkavojta-png.github.io/stent-in/

## Co web umí
- mapa a seznam ~84 000 míst (Česko 28 411, Bavorsko 55 598) s filtry podle země, kraje / vládního obvodu, přístupnosti, toalety, parkování ZTP a vlastních potřeb
- detail místa: údaje se zdrojem a datem, naměřené rozměry, popis od provozovatele, fotky, navigace v Google Maps a Street View
- bariéry v ulicích živě z OpenStreetMap (schody, obrubníky, povrch) na stránce Trasy
- přehled krajů ČR a vládních obvodů Bavorska, ubytování, metodika měření, zdroje a trh, nabídka pro podniky a obce

Je to statický web (HTML, CSS, JavaScript) bez build kroku. Lokálně stačí spustit `python -m http.server` ve složce projektu a otevřít `http://127.0.0.1:8000/`.

## Zdroje dat a licence
Žádná data nejsou vymyšlená; každý údaj má v detailu místa uvedený zdroj.

| Zdroj | Co obsahuje | Licence |
|---|---|---|
| © přispěvatelé OpenStreetMap (Overpass API) | místa a značky přístupnosti `wheelchair`, `toilets:wheelchair` aj. | ODbL 1.0 |
| Mapy bez bariér a přispěvatelé (Konto Bariéry) | profesionálně naměřené objekty | ODbL / CC BY-SA 4.0 (podle objektu) |
| Statutární město Brno – Mapa přístupnosti budov | kategorie přístupnosti budov | CC BY 4.0 |
| IPR Praha – stání ZTP (TSK) a veřejné toalety | rozměry stání, bezbariérová WC | CC BY |
| Statutární město Ostrava – Mapa přístupnosti | kategorie přístupnosti; *datový podklad © Statutární město Ostrava* (mapy.ostrava.cz) | CC BY-SA 4.0 |
| Wikimedia Commons (přes Wikidata) | fotografie míst | licence uvedena u každé fotky |
| Weby provozovatelů, obcí a krajů | údaje o bezbariérovosti s odkazem na stránku | citace s odkazem na zdroj |

### Bavorsko (stav 7. 10. 2026, úplný seznam v `data/by/zdroje.json`)

| Zdroj | Co obsahuje | Licence |
|---|---|---|
| © přispěvatelé OpenStreetMap (výřezy Geofabrik pro 7 vládních obvodů) | místa a značky přístupnosti, stejné dotazy jako pro ČR | ODbL 1.0 |
| DB InfraGO AG – OpenStation (mobilithek.info) | bezbariérovost 924 nádraží a zastávek DB: nástupiště, výška hrany, výtahy, rampy | CC0 1.0 |
| Landeshauptstadt München (opendata.muenchen.de) – WC-Finder, Behindertenparkplätze, Wahlräume; P+R Park & Ride GmbH München | veřejná WC s rozměry, vyhrazená stání, volební místnosti, P+R | dl-de/by-2-0 |
| Stadt Würzburg (opendata.wuerzburg.de) – Nette Toiletten | bezbariérová veřejná WC | dl-de/by-2-0 |
| Stadt Haar (open.bydata.de) – POI | vyhrazená stání | CC BY 4.0 |
| BayernCloud Tourismus – Attraktionen in Bayern | turistické cíle s údajem o bezbariérovosti (jen objekty s CC BY 4.0 nebo CC0) | CC BY 4.0 / CC0 1.0 |
| Bayerisches Landesamt für Statistik – GENESIS-Online (22711, 12411) | jen statistika lidí s těžkým postižením po obvodech (stránka Kraje) | CC BY 4.0 |
| Weby provozovatelů, obcí a turistických portálů (např. erlebe.bayern) | údaje o bezbariérovosti, česky parafrázované s odkazem | bez otevřené licence – jen parafráze s odkazem |

Rešerše k bavorským zdrojům: `data/research/out/tema_bavorsko_mnichov.md`, `tema_bavorsko_franky.md`, `tema_bavorsko_zemske.md`.

Odvozená databáze (`data/places.json` a `data/regions/`) je proto šířena za podmínek ODbL 1.0 (s respektováním CC BY-SA u dat z Ostravy a Map bez bariér a s uvedením zdroje u dat pod dl-de/by-2-0 a CC BY 4.0).

## Struktura
- `*.html` – stránky webu, `assets/` – styly a skripty, `DESIGN.md` – designový systém
- `data/regions/` – data webu po regionech: `index.json` (seznam, bbox a počet míst), `cz-<kraj>.json` a `de-<obvod>.json`,
  `obce.json` (obce pro hledání) a `ids.json` (id místa → region, pro staré odkazy bez `&r=`)
- `data/places.json` – jen ČR (starší formát, web ho použije jen jako zálohu, když chybí `data/regions/index.json`)
- `data/stats.json`, `data/kraje_info.json` – souhrnná čísla a odkazy ke krajům; `data/by/` – bavorské vstupy a `zdroje.json`
- `data/research/` – výsledky rešerší webů provozovatelů (zdroje k poli `r`)
- `tools/` – skripty: `fetch_osm.py` → `build_data.py` → `build_open.py` → `build_open2.py` → `merge_research.py` (ČR),
  potom `build_by.py` (spojí Bavorsko a rozdělí vše po regionech) a `build_web_index.py` (`obce.json`, `ids.json` a `ubytovani.json`)

Načítání v prohlížeči (`assets/js/core.js`): `KP.loadRegionsIndex()`, `KP.loadRegion(id)`, `KP.loadPlacesInBounds(bounds)` s cache;
`KP.loadPlaces()` zůstává kompatibilní a vrátí všechna místa. Detail místa má odkaz `misto.html?id=<id>&r=<region>`.

Mapa v prohlížeči běží na Leaflet + OpenStreetMap; s klíčem v `assets/js/config.js` umí i Google Maps JavaScript API.
