# Bavorsko – zemská a celostátní otevřená data (úkol D2c)

Stav k 2026-10-07. Prověřeny: Deutsche Bahn (OpenStation, StaDa, FaSta), MVV, VGN, Bayerisches Landesamt für Statistik (LfStat),
BayernAtlas / LDBV, katalogy open.bydata.de a Mobilithek. Navazuje na `tema_bavorsko.md`, `tema_bavorsko_franky.md`; nic z nich neopakuje.
Vytvořeno skriptem `tools/by_open_zemske.py` (surová data v `data/raw/by_open/zemske/`).

## Shrnutí

- **DB InfraGO OpenStation (CC0)** popisuje bezbariérovost **924 nádraží a zastávek DB v Bavorsku** [1][2]. Všechna jsou v `data/by/open_zemske.json` se souřadnicemi z OSM. U každého je stav přístupu pro vozík, nástupiště, výška hrany, výtahy s rozměry kabiny, rampy, plošiny a asistence.
- Podle DB je pro vozík přístupných **727 z 924** stanic (78,7 %), částečně 140, nepřístupných 51, neznámo 6 [1].
- **LfStat:** k 31. 12. 2025 žilo v Bavorsku **1 191 585 osob s těžkým zdravotním postižením** (Schwerbehinderte, GdB ≥ 50), tj. **9,0 %** obyvatel (13 245 503) [3][4]. Z toho 698 330 (58,6 %) je ve věku 65+.
- **MVV a VGN** mají otevřené jízdní řády GTFS (CC BY), ale **bez údajů o bezbariérovosti** (chybí `wheelchair_boarding`) [6][7].
- **BayernAtlas / LDBV nemá otevřenou vrstvu přístupnosti**: katalog geoportal.bayern.de pro „barrierefrei“ nevrátil žádný záznam [9].

## 1. Nádraží DB v Bavorsku (OpenStation, CC0)

Zdroj: NeTEx export OpenStation, vydaný 2026-10-07 02:29 UTC [1]. Výběr: Province = Bayern nebo AGS začínající 09. Souřadnice: OSM (shoda podle RIL100, IFOPT, EVA nebo názvu), 1 stanice přes Nominatim.

| Vládní obvod | Stanic | Přístupné | Částečně | Nepřístupné | Neznámo | Podíl přístupných |
|---|---:|---:|---:|---:|---:|---:|
| Horní Bavorsko | 295 | 240 | 37 | 17 | 1 | 81,4 % |
| Dolní Bavorsko | 56 | 47 | 6 | 3 | 0 | 83,9 % |
| Horní Falc | 76 | 50 | 20 | 3 | 3 | 65,8 % |
| Horní Franky | 114 | 92 | 16 | 6 | 0 | 80,7 % |
| Střední Franky | 157 | 131 | 20 | 6 | 0 | 83,4 % |
| Dolní Franky | 78 | 46 | 22 | 9 | 1 | 59,0 % |
| Švábsko | 148 | 121 | 19 | 7 | 1 | 81,8 % |
| **Bavorsko** | **924** | **727** | **140** | **51** | **6** | **78,7 %** |

- Výtahy: **364** v 181 stanicích; u většiny je šířka a hloubka kabiny a nosnost.
- Nástupiště: 1573, z toho přístupných pro vozík **1327** (84,4 %), nepřístupných 223, neznámo 23.
- Výška nástupní hrany: 76 cm: 495, 38 cm: 322, 55 cm: 294, 96 cm: 154, 34 cm: 42; bez údaje 105.
- Mobilní zvedací plošina (Hublift) je na 54 stanicích, asistenční služba DB (nutno objednat) na 61, WC pro vozíčkáře eviduje DB na 83.
- Údaje o WC jsou podle DB „nově publikované“; část vybavení může chybět, pokud prostor není označen jako veřejný [2].

## 2. Osoby s těžkým zdravotním postižením (LfStat, CC BY 4.0)

Tabulky GENESIS-Online Bayern 22711-001r, 22711-003z, 22711-004z a 12411-003r (obyvatelé) [3][4]. Stav k 31. 12. 2025, poslední změna tabulky 2026-09-20. Od roku 2021 LfStat čísla zaokrouhluje na 5 (odchylka max. 2), součty proto nemusí přesně sedět [3].

### 2.1 Vývoj v Bavorsku

| Stichtag | Osob s těžkým postižením |
|---|---:|
| 31. 12. 2015 | 1 145 467 |
| 31. 12. 2017 | 1 148 722 |
| 31. 12. 2019 | 1 174 145 |
| 31. 12. 2021 | 1 159 220 |
| 31. 12. 2023 | 1 157 065 |
| 31. 12. 2025 | 1 191 585 |

Mezi 2023 a 2025 přibylo 34 520 osob.

### 2.2 Podle věku (2025)

| Věk | Osob | Podíl |
|---|---:|---:|
| unter 6 | 5 515 | 0,5 % |
| 6 bis unter 15 | 21 265 | 1,8 % |
| 15 bis unter 18 | 7 315 | 0,6 % |
| 18 bis unter 25 | 19 315 | 1,6 % |
| 25 bis unter 35 | 38 715 | 3,2 % |
| 35 bis unter 45 | 58 085 | 4,9 % |
| 45 bis unter 55 | 93 420 | 7,8 % |
| 55 bis unter 60 | 99 505 | 8,4 % |
| 60 bis unter 62 | 54 705 | 4,6 % |
| 62 bis unter 65 | 95 415 | 8,0 % |
| 65 oder älter | 698 330 | 58,6 % |

### 2.3 Podle vládních obvodů (2025)

| Vládní obvod | Osob s těžkým postižením | Obyvatel 31. 12. 2025 | Podíl na obyvatelích | Nádraží DB přístupná pro vozík |
|---|---:|---:|---:|---:|
| Horní Bavorsko (Oberbayern) | 358 095 | 4 767 226 | 7,5 % | 240 z 295 |
| Dolní Bavorsko (Niederbayern) | 114 745 | 1 260 007 | 9,1 % | 47 z 56 |
| Horní Falc (Oberpfalz) | 119 820 | 1 120 630 | 10,7 % | 50 z 76 |
| Horní Franky (Oberfranken) | 116 855 | 1 051 584 | 11,1 % | 92 z 114 |
| Střední Franky (Mittelfranken) | 197 870 | 1 795 514 | 11,0 % | 131 z 157 |
| Dolní Franky (Unterfranken) | 127 685 | 1 314 706 | 9,7 % | 46 z 78 |
| Švábsko (Schwaben) | 156 515 | 1 935 836 | 8,1 % | 121 z 148 |
| **Bavorsko** | **1 191 585** | **13 245 503** | **9,0 %** | **727 z 924** |

### 2.4 Okresy a městské okresy (Kreise) – 10 s nejvíce osobami (2025)

| Kreis | Osob | Podíl na obyvatelích |
|---|---:|---:|
| München, Landeshauptstadt | 107 835 | 7,2 % |
| Nürnberg (Krfr.St) | 60 755 | 11,4 % |
| München (Lkr) | 25 125 | 7,1 % |
| Augsburg (Krfr.St) | 24 890 | 8,2 % |
| Augsburg (Lkr) | 21 390 | 8,1 % |
| Rosenheim (Lkr) | 20 255 | 7,8 % |
| Regensburg (Lkr) | 20 005 | 10,2 % |
| Ansbach (Lkr) | 19 520 | 10,4 % |
| Nürnberger Land (Lkr) | 19 245 | 11,4 % |
| Passau (Lkr) | 18 850 | 9,7 % |

### 2.5 Kreise s nejvyšším a nejnižším podílem (2025)

| Kreis | Osob | Podíl |
|---|---:|---:|
| Kronach (Lkr) | 8 360 | 13,1 % |
| Ansbach (Krfr.St) | 5 075 | 12,5 % |
| Hof (Krfr.St) | 5 785 | 12,4 % |
| Weiden i.d.OPf. (Krfr.St) | 5 175 | 12,2 % |
| Coburg (Krfr.St) | 4 960 | 12,1 % |
| Eichstätt (Lkr) | 9 720 | 7,1 % |
| München (Lkr) | 25 125 | 7,1 % |
| Ebersberg (Lkr) | 10 175 | 7,0 % |
| Freising (Lkr) | 12 535 | 6,8 % |
| Starnberg (Lkr) | 9 230 | 6,6 % |

Celá tabulka všech 96 Kreise je v `data/raw/by_open/zemske/lfstat/` (JSON-stat z GENESIS).

### 2.6 Stupeň postižení (GdB, 2025)

| GdB | Osob | Podíl |
|---|---:|---:|
| 50 | 463 960 | 38,9 % |
| 60 | 175 825 | 14,8 % |
| 70 | 115 260 | 9,7 % |
| 80 | 142 230 | 11,9 % |
| 90 | 52 140 | 4,4 % |
| 100 | 242 170 | 20,3 % |

### 2.7 Druh nejtěžšího postižení (2025)

| Druh (originál LfStat) | Osob | Podíl |
|---|---:|---:|
| Beeinträchtigung der Funktionen innerer Organe bzw. Organsysteme | 288 190 | 24,2 % |
| Querschnittlähmung, zerebr.Störungen, geistig-seel.Beh., Suchtkrankh. | 282 375 | 23,7 % |
| Sonstige und ungenügend bezeichnete Behinderungen | 275 115 | 23,1 % |
| Funktionseinschränkung von Gliedmaßen | 122 540 | 10,3 % |
| Funktionseinschränkung Wirbelsäule, Rumpf, Brustkorb | 76 140 | 6,4 % |
| Verlust einer oder beider Brüste, Entstellungen u.a. | 57 325 | 4,8 % |
| Sprach- und Sprechstörung, Taubheit, Schwerhörigkeit | 48 355 | 4,1 % |
| Blindheit und Sehbehinderung | 37 265 | 3,1 % |
| Verlust oder Teilverlust von Gliedmaßen | 4 275 | 0,4 % |

Pohybového aparátu (ztráta či omezení končetin, páteř a trup) se týká 202 955 osob (17,0 %). Kolik z nich používá vozík, statistika neuvádí. Ochrnutí je sloučeno s duševními postiženími a závislostmi do jedné skupiny (H).

## 3. Prověřené sady a licence

| Sada | Licence | Údaje o přístupnosti | Výsledek |
|---|---|---|---|
| DB InfraGO OpenStation NeTEx [1][2] | CC0 1.0 | ano: stanice, nástupiště, výtahy, rampy, plošiny, WC, asistence | **převzato** (924 stanic) |
| DB OpenStation SIRI FM – stav výtahů v reálném čase [2] | CC0 1.0 | ano (živý stav výtahů a eskalátorů) | nestaženo, vhodné pro budoucí živou funkci webu |
| DB API Marketplace – StaDa, FaSta [10] | API s registrací (klíč) | stanice, výtahy | nepřebíráno: obsah pokrývá OpenStation (CC0) bez registrace |
| MVV GTFS + seznam zastávek (CSV) [6] | CC BY („cc-by“, uvést MVV a datum) | ne (stops.txt bez `wheelchair_boarding`, trips.txt bez `wheelchair_accessible`) | nic k převzetí |
| VGN GTFS [7] | CC BY 3.0 DE (uvést „VGN – Verkehrsverbund Großraum Nürnberg GmbH“) | ne (stejně jako MVV) | nic k převzetí |
| Mobilithek: Ausstattungsmerkmale Barrierefreiheit (DELFI, VDV-462), TU Chemnitz [8] | „Free use“ Mobilithek; data jsou převod z OSM (ODbL) | ano, ale jde o data OSM (projekt OpenStop) | nepřebíráno zvlášť: integrátor je má přímo z OSM |
| LfStat GENESIS-Online Bayern [3][4] | CC BY 4.0 | statistiky | použito pro kap. 2 |
| BayernAtlas / LDBV, GDI-BY (geoportal.bayern.de) [9] | – | vrstva přístupnosti neexistuje (CSW: 0 záznamů „barrierefrei“) | – |
| open.bydata.de, hledání „barrierefrei“ [11] | – | 5 sad, všechny městské (Mnichov, Würzburg), řeší D2a/D2b | – |

## Zdroje

1. DB InfraGO: OpenStation NeTEx, Mobilithek https://mobilithek.info/offers/879076212433727488 (stažení https://bahnhof.de/daten/netex), vydáno 2026-10-07, CC0 1.0.
2. DB InfraGO: openstation-docs, README a NeTEx.md, https://github.com/dbinfrago/openstation-docs (licence: „released to the public domain (under the CC0 license)“).
3. Bayerisches Landesamt für Statistik, GENESIS-Online Bayern, tabulka 22711-001r, https://genesis-5-prod-extern.bayern.de/datenbank/online/table/22711-001r ; 22711-003z, https://genesis-5-prod-extern.bayern.de/datenbank/online/table/22711-003z ; 22711-004z, https://genesis-5-prod-extern.bayern.de/datenbank/online/table/22711-004z (staženo 2026-10-07).
4. Tamtéž, tabulka 12411-003r (obyvatelé k 31. 12. 2025), https://genesis-5-prod-extern.bayern.de/datenbank/online/table/12411-003r . Podmínky užití GENESIS-Online Bayern: CC BY 4.0, uvést „Datenquelle: Bayerisches Landesamt für Statistik“.
5. LfStat, statistika 22711 „Statistik der schwerbehinderten Menschen“, https://www.statistikdaten.bayern.de/genesis/online?operation=statistic&code=22711
6. MVV, OpenData pro vývojáře, https://www.mvv-muenchen.de/service-hilfe/mvv-content-fuer-entwickler (GTFS a Haltestellen-CSV, „Creative Commons Attribution License (cc-by)“).
7. VGN, Open Data GTFS, https://www.vgn.de/web-entwickler/open-data/ a https://www.vgn.de/opendata/ (CC BY 3.0 DE).
8. Mobilithek, „Ausstattungsmerkmale bzgl. Barrierefreiheit (gemäß DELFI e.V.) von Haltestellen in Deutschland gemäß VDV-462“, vydavatel TU Chemnitz (projekt OPENER next), https://mobilithek.info
9. Geoportal Bayern, katalog CSW https://geoportal.bayern.de/csw/gdi (dotaz AnyText like '%barrierefrei%', 2026-10-07: 0 záznamů).
10. DB API Marketplace, https://developers.deutschebahn.com/db-api-marketplace/apis/product/fasta a …/stada ; rozcestník https://data.deutschebahn.com/opendata
11. Open Data Bayern, https://open.bydata.de (API hledání „barrierefrei“, 2026-10-07).
