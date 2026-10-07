# STENT-IN – kudyprojedu.cz

Studentský prototyp pro program **STENT-IN 2026** (VŠTE České Budějovice + OTH Regensburg, Interreg Bavorsko–Česko).
Mapa skutečných míst v Česku s údaji o přístupnosti pro lidi na vozíku a s omezenou pohyblivostí:
vstup, toaleta, parkování pro ZTP, naměřené rozměry, informace od provozovatelů a fotky.

**Web:** https://rozporkavojta-png.github.io/stent-in/

## Co web umí
- mapa a seznam ~28 400 míst s filtry podle přístupnosti, toalety, parkování ZTP a vlastních potřeb
- detail místa: údaje se zdrojem a datem, naměřené rozměry, popis od provozovatele, fotky, navigace v Google Maps a Street View
- bariéry v ulicích živě z OpenStreetMap (schody, obrubníky, povrch) na stránce Trasy
- přehled krajů, ubytování, metodika měření, zdroje a trh, nabídka pro podniky a obce

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

Odvozená databáze `data/places.json` je proto šířena za podmínek ODbL 1.0 (s respektováním CC BY-SA u dat z Ostravy a Map bez bariér).

## Struktura
- `*.html` – stránky webu, `assets/` – styly a skripty, `DESIGN.md` – designový systém
- `data/places.json`, `data/stats.json`, `data/kraje_info.json` – data webu
- `data/research/` – výsledky rešerší webů provozovatelů (zdroje k poli `r`)
- `tools/` – skripty: `fetch_osm.py` → `build_data.py` → `build_open.py` → `build_open2.py` → `merge_research.py`

Mapa v prohlížeči běží na Leaflet + OpenStreetMap; s klíčem v `assets/js/config.js` umí i Google Maps JavaScript API.
