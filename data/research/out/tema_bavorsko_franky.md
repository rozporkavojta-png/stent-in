# Franky a Horní Falc – otevřená data o přístupnosti (úkol D2b)

Stav k 2026-10-07. Prověřena města Norimberk, Fürth, Erlangen, Würzburg, Bamberg, Bayreuth, Řezno (Regensburg),
Amberg, Weiden, Pasov (Passau), Landshut a Straubing. Hledalo se v katalozích open.bydata.de (Open Data Bayern) a
GovData a na portálech měst. Navazuje na `tema_bavorsko.md` a nic z něj neopakuje.

## Shrnutí

- **Použitelná je jen jedna sada:** Würzburg, „Nette Toiletten im Stadtgebiet Würzburg“, licence dl-de/by-2-0 [1].
  Z ní je v `data/by/open_franky.json` **38 míst** (43 záznamů typu „Barrierefreie WC-Anlage“, 5 dvojic sloučeno).
  U **7 WC** jsou podrobně naměřené rozměry: dveře, prostor vedle mísy, výška sedátka a umyvadla, rampy, výtah.
- **12 z 43** bezbariérových WC zdroj výslovně označuje jako neověřené (údaj provozovatele) [1]. Mají `w: null`, `t: "yes"`.
- **Ostatní města nemají otevřenou sadu o přístupnosti míst.** Norimberk, Erlangen, Bamberg, Řezno a Amberg
  v katalogu mají, ale bez údajů o přístupnosti. Fürth, Bayreuth, Weiden, Pasov, Landshut a Straubing nemají
  v open.bydata.de vlastní katalog města [2].
- **Würzburg měří bezbariérovost zastávek MHD:** v roce 2025 bylo bezbariérových **364 z 642** zastávek autobusu
  a tramvaje, tj. **56,7 %** (2018: 271 z 644, 42,1 %) [3].
- **Pro plán:** Franky a Horní Falc jsou z pohledu otevřených dat stejně prázdné jako východní Bavorsko.
  Měřené rozměry má jen Würzburg, a to jen u WC. To potvrzuje odlišení kudyprojedu (měřené údaje, řetěz cesty).

## 1. Přehled měst

| Město (obvod) | Kde hledáno | Sada o přístupnosti? | Licence | Výsledek |
|---|---|---|---|---|
| Würzburg (Dolní Franky) | opendata.wuerzburg.de (184 sad), open.bydata.de katalog „wuerzburg“ (134) | ano: bezbariérová WC (96 záznamů, 87 různých id) [1]; statistiky inkluze [3]; „Schulportrait – Inklusion“ (35 škol) [4] | WC a statistiky dl-de/by-2-0; Schulportrait **bez licence** | WC převzata, statistiky níže, Schulportrait jen popsán |
| Norimberk (Střední Franky) | open.bydata.de „nuernberg-subcatalog“ (81), „nuernberg-statistik“ (41), GovData | ne. „Städtische Einrichtungen“ (CC BY 4.0) má jen název, adresu, web, souřadnice a otevírací dobu [5] | CC BY 4.0 | nic k převzetí |
| Fürth (Střední Franky) | open.bydata.de, GovData | ne, město nemá vlastní katalog [2] | – | – |
| Erlangen (Střední Franky) | open.bydata.de „erlangen-import“ (16), opendata.erlangen.de | ne (stromy, defibrilátory, školní obvody, obyvatelstvo) [6]; opendata.erlangen.de vrací HTTP 401 | CC BY 4.0 | – |
| Bamberg (Horní Franky) | open.bydata.de „bamberg-subcatalog“ (9) | ne (chodci, Smart City, obyvatelstvo) [7] | CC BY 4.0 | – |
| Bayreuth (Horní Franky) | open.bydata.de, GovData | ne, bez katalogu města [2] | – | – |
| Řezno (Horní Falc) | open.bydata.de „regensburg-subcatalog“ (11) | ne (pitné fontány, kontejnery, UNESCO zóna, rodinná centra) [8] | CC BY 4.0, „Brunnen“ CC BY-NC 4.0 | – |
| Amberg (Horní Falc) | open.bydata.de „amberg-subcatalog“ (14) | ne. „Ämtergebäude“ (CC BY) a „Einrichtungen“ (CC BY-ND 4.0) neobsahují slovo barrierefrei, Rollstuhl, Aufzug ani Rampe [9] | CC BY / CC BY-ND | – |
| Weiden (Horní Falc) | open.bydata.de, GovData | ne, bez katalogu města [2] | – | – |
| Pasov (Dolní Bavorsko) | open.bydata.de, GovData, passau.de/opendata (404) | ne [2] | – | – |
| Landshut (Dolní Bavorsko) | open.bydata.de, GovData, landshut.de/opendata (404) | ne [2] | – | – |
| Straubing (Dolní Bavorsko) | open.bydata.de, GovData | ne [2] | – | – |

Celý katalog open.bydata.de má k 2026-10-07 na dotaz „barrierefrei“ 5 sad, „Barrierefreiheit“ 11, „Toiletten“ 2
(Mnichov a Würzburg) a „Behindertenparkplatz“ 1 (Mnichov) [2]. Z Franků a Horní Falce je mezi nimi jen Würzburg.

Pozn.: stránka www.nuernberg.de/internet/opendata/ k 2026-10-07 zobrazuje jen přihlášení („Miniweb-Login“) [5].
Doména opendata.stadt-regensburg.de přesměrovává na nesouvisející reklamní web, proto nebyla použita.

## 2. Würzburg – bezbariérová WC (sada převzata)

| Údaj | Hodnota | Zdroj |
|---|---|---|
| Záznamů v exportu | 96 (87 různých id) | [1] |
| Typ „Barrierefreie WC-Anlage“ | 43 | [1] |
| Typ „Nette Toilette“ (WC v podniku pro veřejnost) | 26, bez údaje o přístupnosti, nepřevzato | [1] |
| Typ „Weitere Toilette“ | 18, bez údaje o přístupnosti, nepřevzato | [1] |
| Bezbariérová WC s poznámkou „nicht überprüft (Angaben laut Betreiber)“ | 12 | [1] |
| WC s podrobným měřením (popis přes 1000 znaků) | 7 (Hauptfriedhof, Klein Nizza, kiosek Augustinerstraße, Marktgarage, Rathaus, Soziales Ämtergebäude, Viehmarktplatz) | [1] |
| WC, kde zdroj uvádí nutnost Euroklíče | 6 | [1] |
| Poslední změna sady | 2024-06-14 | [1] |

Převod (`tools/build_open_franky.py`): klíč `x[].rows` obsahuje jen hodnoty z popisu zdroje, přeložené do češtiny
(šířka dveří do WC, práh, plocha před a za dveřmi, místnost, volný prostor vlevo a vpravo od mísy, výška sedátka,
splachování a umyvadla, madla, rampa se sklonem a délkou, výtah, Euroklíč, přebalovací pult, počet vyhrazených stání
v okolí). Šířka dveří do WC je **poslední** šířka dveří v popisu: zdroj popisuje cestu od vstupu k WC.
Souřadnice jsou ze zdroje (Stadt Würzburg), v `x[].coords` je to uvedeno. Párování s OSM udělá integrátor.
Dvojice záznamů téhož WC od dvou správců (do 120 m a se stejným slovem v názvu) jsou sloučené do jednoho místa
se dvěma položkami v `x`. Jde o Klein Nizza, Viehmarktplatz, Marktgarage, Stadtbücherei Falkenhaus a Klinikum der Universität.

## 3. Würzburg – statistiky inkluze (Sozialmonitoring)

Zdroj [3], licence dl-de/by-2-0, celé město („Würzburg“):

| Rok | Zastávky bus + tram | z toho bezbariérové | Podíl | Bus: bezbar. / celkem | Tram: bezbar. / celkem | Osoby s těžkým postižením |
|---|---|---|---|---|---|---|
| 2017 | – | – | – | – | – | 13 170 |
| 2018 | 644 | 271 | 42,1 % | 250 / 558 | 21 / 72 | 13 555 |
| 2019 | 588 | 281 | 47,8 % | 256 / 558 | 25 / 72 | 13 691 |
| 2020 | 588 | 297 | 50,5 % | 261 / 558 | 36 / 80 | 13 524 |
| 2021 | 588 | 323 | 54,9 % | 271 / 558 | 52 / 85 | 13 555 |
| 2022 | 588 | 347 | 59,0 % | 288 / 558 | 59 / 85 | 13 437 |
| 2023 | 588 | 360 | 61,2 % | 297 / 558 | 63 / 85 | 13 330 |
| 2024 | 643 | 362 | 56,3 % | 299 / 557 | 63 / 85 (74,1 %) | 13 445 |
| 2025 | 642 | 364 | 56,7 % | 298 / 557 | chyba ve zdroji* | 13 629 |

\* Pro rok 2025 sada uvádí 529 bezbariérových tramvajových zastávek z 85 a podíl 622 %. Je to zjevná chyba zdroje,
hodnota se nepoužívá. Pokles podílu v roce 2024 způsobil růst počtu evidovaných zastávek (588 → 643), ne úbytek
bezbariérových.

Podíl bezbariérových zastávek (bus + tram) podle městských obvodů v roce 2025 [3]: Frauenland 77,5 %,
Altstadt 73,0 %, Lindleinsmühle 73,0 %, Sanderau 63,0 %, Zellerau 57,9 %, Heuchelhof 53,8 %, Dürrbachtal 53,6 %,
Grombühl 53,3 %, Heidingsfeld 46,2 %, Rottenbauer 46,2 %, Steinbachtal 32,0 %.

## 4. Sady s neotevřenou nebo chybějící licencí (jen popis, data nepřevzata)

- **Würzburg – „Schulportrait – Kategorie G _ Inklusion“** (Gebäudezugang, Parken, Barrierefreiheit nach
  Einschränkung, Sport, Unterricht) [4]. U 35 škol uvádí např. bezbariérový a bezschodový vstup do budovy,
  dveře s otvíračem a výtah podle DIN 18040-3. Pole licence je v metadatech prázdné a sada není v katalogu
  open.bydata.de. **Nepřevzato.** Před použitím je potřeba požádat Stadt Würzburg o licenci.
- **Amberg – „Einrichtungen der Stadt Amberg“** [9]: licence CC BY-ND 4.0 (zakazuje úpravy), navíc bez údajů
  o přístupnosti. Nepřevzato, surový soubor smazán.
- **Würzburg – „Museen in Würzburg“** (ODbL, 24 muzeí) [1]: jen název a souřadnice, bez přístupnosti. Nepřevzato.

## 5. Co dál

- Würzburg (Inklusionsbeauftragte, Fachbereich Integration, Inklusion und Senioren) zveřejňuje měřená WC i statistiky.
  Je to nejlepší kandidát na partnera v Dolních Frankách. Na dotaz stojí licence sady Schulportrait.
- Pro Norimberk, Erlangen a Řezno zbývá jako zdroj OSM/Wheelmap (hodnocení typu semafor) a certifikace
  Reisen für Alle (viz `tema_bavorsko.md`).

## Zdroje

1. Stadt Würzburg: Nette Toiletten im Stadtgebiet Würzburg, dl-de/by-2-0, změna 2024-06-14 –
   https://opendata.wuerzburg.de/explore/dataset/barrierefreie-toiletten-im-stadtgebiet-wuerzburg/ ;
   katalog: https://open.bydata.de/api/hub/search/datasets/barrierefreie-toiletten-im-stadtgebiet-wuerzburg-wuerzburg (staženo 2026-10-07)
2. Open Data Bayern, vyhledávání a seznam katalogů (89 katalogů), 2026-10-07 –
   https://open.bydata.de/api/hub/search/search?q=barrierefrei&filter=dataset ,
   https://open.bydata.de/api/hub/search/search?filter=catalogue&limit=300 ; GovData –
   https://www.govdata.de/ckan/api/3/action/package_search?q=barrierefrei
3. Stadt Würzburg, Fachabteilung Soziales: Sozialmonitoring – Inklusion, dl-de/by-2-0, změna 2025-06-06 –
   https://opendata.wuerzburg.de/explore/dataset/sozialmonitoring-justizielle-fallzahlen/ (roky 2017–2025)
4. Stadt Würzburg: Schulportrait – Kategorie G _ Inklusion – Gebäudezugang (licence neuvedena), změna 2025-11-12 –
   https://opendata.wuerzburg.de/explore/dataset/schulportrait-kategorie-g-inklusion-gebaeudezugang/
5. Stadt Nürnberg: Städtische Einrichtungen, CC BY 4.0, změna 2026-05-06 –
   https://open.bydata.de/api/hub/repo/datasets/staedtische-einrichtungen ,
   soubor https://dokumente.nuernberg.de/opendata/Daten_KoM/2025_St%C3%A4dtische_Einrichtungen.csv ;
   stránka https://www.nuernberg.de/internet/opendata/ (2026-10-07)
6. Stadt Erlangen, katalog „erlangen-import“ na open.bydata.de (16 sad), 2026-10-07 –
   https://open.bydata.de/api/hub/search/search?filter=dataset&facets=%7B%22catalog%22:%5B%22erlangen-import%22%5D%7D
7. Stadt Bamberg, katalog „bamberg-subcatalog“ (9 sad), 2026-10-07 –
   https://open.bydata.de/api/hub/search/search?filter=dataset&facets=%7B%22catalog%22:%5B%22bamberg-subcatalog%22%5D%7D
8. Stadt Regensburg, katalog „regensburg-subcatalog“ (11 sad), 2026-10-07 –
   https://open.bydata.de/api/hub/search/search?filter=dataset&facets=%7B%22catalog%22:%5B%22regensburg-subcatalog%22%5D%7D
9. Stadt Amberg: Ämtergebäude (CC BY) https://amberg.de/fileadmin/opendata/aemtergebaeude.csv ,
   Einrichtungen (CC BY-ND 4.0) https://amberg.de/fileadmin/opendata/einrichtungen.csv ,
   katalog https://open.bydata.de/api/hub/search/datasets/einrichtungen-der-stadt-amberg (2026-10-07)
