# Mnichov, Horní Bavorsko a Švábsko – otevřená data o přístupnosti (úkol D2a)

Stav k 2026-10-07. Prověřen Mnichov (opendata.muenchen.de), Ingolstadt, Rosenheim, Augsburg, Kempten, Memmingen
a menší obce s vlastním katalogem v open.bydata.de (Haar, Pullach, Penzberg, Waldkraiburg, Kirchheim-Heimstetten).
Hledalo se v katalozích open.bydata.de (Open Data Bayern), GovData (CKAN API) a v CKAN API města Mnichova.
Navazuje na `tema_bavorsko.md` a `tema_bavorsko_franky.md` a neopakuje je.

## Shrnutí

- **Mnichov je jediné město v Bavorsku s více sadami o přístupnosti pod otevřenou licencí** (dl-de/by-2-0):
  veřejná WC s naměřenými rozměry, vyhrazená parkovací stání, P+R s počtem vyhrazených stání a volební místnosti
  s hodnocením bezbariérovosti [1][2][3][4].
- Do `data/by/open_mnichov.json` jde **1 192 míst** (1 186 Horní Bavorsko, 6 Švábsko):
  303 WC, 569 + 6 vyhrazených stání (Mnichov + Haar), 29 parkovišť P+R, 200 budov s volebními místnostmi, 85 turistických cílů z BayernCloud.
- **Mnichovská WC mají naměřené údaje:** šířka dveří, výška mísy, volný prostor vedle mísy, umyvadlo, madla, výtah.
  Bezbariérových kabin je **113 z 321** záznamů (35,2 %); u **73** z nich zdroj uvádí splnění DIN 18040-1 [1].
- **Volební místnosti Mnichov (BTW 2025):** **386 z 470** okrsků (82,1 %) bezbariérových, zbylých 84 jen částečně [4].
- **Ingolstadt, Rosenheim, Kempten a Memmingen nemají žádnou otevřenou sadu o přístupnosti míst.**
  Augsburg má jen statistiky (počet osob s těžkým postižením) [9][10].
- **BayernCloud Tourismus:** z 4 438 cílů v Horním Bavorsku a Švábsku má údaj o bezbariérovosti jen **134 (3,0 %)**.
  49 z nich má licenci CC BY-SA, a proto se nepřebírají [6].

## 1. Přehled měst

| Město (obvod) | Kde hledáno | Sada o přístupnosti? | Licence | Výsledek |
|---|---|---|---|---|
| Mnichov (Horní Bavorsko) | opendata.muenchen.de (CKAN API), open.bydata.de katalog „muenchen“ (337 sad) | ano: WC, vyhrazená stání, P+R, volební místnosti (BTW 2025, LTW 2023), bezbariérové kontejnery na sklo, vodicí systém pro nevidomé [1]–[5] | dl-de/by-2-0 | 4 sady převzaty, ostatní popsány níže |
| Haar (Horní Bavorsko, okres Mnichov) | open.bydata.de „haar-import“ (9 sad) | částečně: seznam POI obsahuje 7 vyhrazených stání [7] | CC BY 4.0 | 6 převzato (souřadnice z Nominatim po ulicích), 1 nenalezeno |
| Ingolstadt (Horní Bavorsko) | open.bydata.de „ingolstadt-import“ (203 sad), GovData | ne (statistiky, plochy, vlhkost půdy v Piusparku) [8] | CC BY 4.0 | nic k převzetí |
| Rosenheim (Horní Bavorsko) | open.bydata.de, GovData | ne; město nemá v open.bydata.de katalog, GovData má jen statistiky LfStat (školky) [8] | – | – |
| Augsburg (Švábsko) | open.bydata.de „augsburg-subcatalog“ (151), „augsburg-statistik“ (240), GovData | ne pro místa; zastávky MHD (453) jsou bez údaje o bezbariérovosti; statistiky ano [9][10][11] | CC BY 4.0 / CC0 | jen statistiky |
| Kempten (Švábsko) | open.bydata.de „kempten-import“ (4) | ne; jen zóny rezidentního parkování [8] | CC BY-SA 4.0 | nic (ani licence nevyhovuje) |
| Memmingen (Švábsko) | open.bydata.de „memmingen-import“ (11) | ne (např. dětská hřiště) [8] | – | – |
| Pullach, Penzberg, Waldkraiburg, Kirchheim-Heimstetten | open.bydata.de (vlastní katalogy) | ne; seznamy muzeí, bazén, hřiště bez údajů o přístupnosti [8] | různé | – |
| celé Bavorsko | BayernCloud Tourismus „Attraktionen in Bayern“ | u 3 % cílů označení nebo popis bezbariérovosti [6] | po objektech CC0 / CC BY / CC BY-SA | 85 převzato (jen CC0 a CC BY) |

## 2. Mnichov – veřejná WC (WC-Finder)

Zdroj [1], stav sady k 2026-10-05, 321 záznamů (kabin) na 303 místech.

| Ukazatel | Hodnota |
|---|---|
| Záznamy celkem (kabiny) | 321 |
| z toho bezbariérové (kategorie obsahuje „barrierefrei“) | 113 (35,2 %) |
| místa s alespoň jednou bezbariérovou kabinou | 112 z 303 |
| bezbariérové kabiny se splněnou DIN 18040-1 (údaj zdroje) | 73 ze 113 |
| „Toilette für alle“ (lehátko, zvedák) | 28 |
| bezbariérové kabiny na Euroklíč | 85 ze 113 |
| stav bezbariérových kabin | 102 plně funkční, 6 částečně omezené, 5 mimo provoz |
| poplatek | 124 kabin zdarma, 95 za 0,60 €, u 96 neuvedeno |

Popis sady ve zdroji: data o přístupnosti, vybavení a stavu WC ve vlastnictví města; bez záruky správnosti [1].

## 3. Mnichov – vyhrazená parkovací stání (Behindertenparkplätze)

Zdroj [2], aktualizace denně, stav 2026-10-05. Jen obecná stání na veřejném prostranství. Stání přidělená konkrétní osobě sada nezahrnuje.

| Ukazatel | Hodnota |
|---|---|
| Místa (body) | 569 |
| Stání celkem | 961 |
| Podle účelu | obecná potřeba 194, zdravotnictví 119, sociální služby 114, úřad 46, zastávka 44, kultura 31, vzdělávání 21 |
| Stav | 544 v provozu, 12 dočasně přemístěno kvůli stavbě, 13 bez údaje |
| Vyhrazeno nepřetržitě | 19; u 550 platí vyhrazení jen v uvedené době |

## 4. Mnichov – P+R

Zdroj [3], stav 06/2025: 34 zařízení P+R se 7 941 stáními. Vyhrazená stání pro osoby s postižením má **29 zařízení**,
celkem **91 stání (1,1 % kapacity)**.

## 5. Mnichov – volební místnosti

| Volby | Okrsky / místnosti | Bezbariérové | Částečně bezbariérové | Zdroj |
|---|---|---|---|---|
| Spolkový sněm 2025 (BTW) | 470 okrsků ve 200 budovách | 386 (82,1 %) | 84 (17,9 %) | [4] |
| Zemský sněm 2023 (LTW) | 509 | 415 (81,5 %) | 94 (18,5 %) | [4b] |

U částečně bezbariérových místností zdroj označuje, pro které skupiny je místnost přístupná: vozíčkáři,
lidé s omezenou chůzí, slabozrací, nevidomí, lidé s kognitivním postižením. V `open_mnichov.json` je použita BTW 2025.
Souřadnice jsou z bodové vrstvy téže sady (Shape, převod z ETRS89/UTM 32N).

## 6. BayernCloud Tourismus (Horní Bavorsko a Švábsko)

Zdroj [6]: soubor „Attraktionen in Bayern“ (JSON-LD, 54 810 objektů, z toho 12 844 míst za celé Bavorsko).

| Ukazatel | Hodnota |
|---|---|
| Místa v Horním Bavorsku a Švábsku | 4 438 |
| s označením nebo popisem bezbariérovosti | 134 (3,0 %) |
| z toho otevřená licence objektu (CC BY 4.0 / CC0) → převzato | 85 (81 CC BY, 4 CC0) |
| z toho CC BY-SA 4.0 → vynecháno | 49 |
| převzatá místa s jasným hodnocením pro vozík | 4 přístupná, 1 nepřístupné; u 80 jen obecné „barrierefrei“ |
| hlavní poskytovatel převzatých míst | Chiemsee-Alpenland Tourismus (66) |

Obecné označení „barrierefrei“ neříká, pro koho a v jakém rozsahu. Proto u něj zůstává `w: null`
a v `x` je jen originální označení.

## 7. Statistiky – Augsburg

| Ukazatel | Rok | Hodnota | Zdroj |
|---|---|---|---|
| Osoby s těžkým postižením (GdB ≥ 50) | 2025 | 24 890, tj. 8,2 % obyvatel | [10] |
| totéž | 2015 | 23 909 (8,3 %) | [10] |
| z toho GdB 100 | 2025 | 5 345 | [10] |
| omezení funkce končetin / ztráta končetin | 2025 | 2 245 / 95 | [10] |
| podíl zaměstnanců města s GdB ≥ 50 | 2023 | 9,58 % (zákonná kvóta 5 %); 2008: 6,29 % | [9] |

## 8. Sady, které se nepřebírají (jen popis)

- **Mnichov – bezbariérové kontejnery na sklo** (dl-de/by-2-0) [5]: licence je otevřená, ale nejde o místa k návštěvě. Nepřevzato.
- **Mnichov – Blindenleitsystem Altstadt – Fußgängerzone** (Baureferat, dl-de/by-2-0) [5b]: hmatové vodicí prvky v pěší zóně (dlažba, varovné pásy) pro nevidomé. Nejsou to místa a pro vozík nejsou relevantní.
- **Mnichov – Landtagswahl 2023 – Wahlräume** [4b]: novější BTW 2025 ji nahrazuje. Použita jen pro statistiku.
- **BayernCloud – objekty s CC BY-SA 4.0** (49 v oblasti): licence vyžaduje sdílení za stejných podmínek a není v povoleném seznamu. Nepřevzato.
- **Kempten – Parkzonen für Bewohnerparken** (CC BY-SA 4.0): netýká se přístupnosti a licence nevyhovuje.
- **Augsburg – zastávky MHD** (CC BY 4.0) [11]: bez údaje o bezbariérovosti.
- **Mnichov – MVV zastávky, koupaliště SWM, kulturní místa, POI (bayernCloud export města)**: v raw jsou stažené, ale nemají údaje o přístupnosti.

## Zdroje

- [1] Landeshauptstadt München – WC-Standorte (WC-Finder), dl-de/by-2-0: https://opendata.muenchen.de/dataset/wc_finder (2026)
- [2] Landeshauptstadt München – Behindertenparkplätze, dl-de/by-2-0: https://opendata.muenchen.de/dataset/behindertenparkplaetze (2026)
- [3] P+R Park & Ride GmbH München – P+R Anlagen München (Stand 06/2025), dl-de/by-2-0: https://opendata.muenchen.de/dataset/p-r-anlagen-muenchen (2025)
- [4] Landeshauptstadt München – Bundestagswahl 2025 – Wahlräume in München, dl-de/by-2-0: https://opendata.muenchen.de/dataset/bundestagswahl-2025-wahlraeume-in-muenchen (2025)
- [4b] Landeshauptstadt München – Landtagswahl 2023 – Wahlräume in München, dl-de/by-2-0: https://opendata.muenchen.de/dataset/landtagswahl-2023-wahlraeume-in-muenchen (2023)
- [5] Landeshauptstadt München – Barrierefreie Container für Altglas, dl-de/by-2-0: https://opendata.muenchen.de/dataset/awm_container_barrierefrei (2026)
- [5b] Landeshauptstadt München – Blindenleitsystem Altstadt – Fußgängerzone: https://opendata.muenchen.de/dataset/baut_blindenleitsystem_altstadt (2026)
- [6] BayernCloud Tourismus – Attraktionen in Bayern (licence po objektech): https://open.bydata.de/datasets/https-data-bayerncloud-digital-api-v4-endpoints-list_attractions (stav 2026-10-05)
- [7] Stadt Haar – Verzeichnis der Points of Interest (POI), CC BY 4.0: https://open.bydata.de/datasets/poi-haar (2025)
- [8] open.bydata.de – katalogy měst (API https://open.bydata.de/api/hub/search/search, filtr catalog) a GovData CKAN (https://www.govdata.de/ckan/api/3/action/package_search, organizace open-data-bayern), dotazy 2026-10-07
- [9] Stadt Augsburg – Nachhaltigkeitsbericht K3.1 Beschäftigte mit Behinderungsgrad 50, CC BY 4.0: https://open.bydata.de/datasets/nachhaltigkeitsbericht-augsburg-k3-1-beschaeftigte-mit-behinderungsgrad-50 (2025)
- [10] Stadt Augsburg – Sozialwesen – Schwerbehinderte, CC BY 4.0: https://informationsportal.augsburg.de/OpenDataAugsburg/dataset/de-by-augsburg-sozialwesen_-_schwerbehinderte/content.csv (2025)
- [11] Stadt Augsburg – Haltestellen von ÖPNV und Nachtbus im Stadtgebiet, CC BY 4.0: https://www.govdata.de/ckan/api/3/action/package_show?id=stadt-augsburg-haltestellen-von-opnv-und-nachtbus-im-stadtgebiet (2025)
