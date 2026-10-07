# Konkurence v ČR do hloubky – podklad pro podnikatelský plán kudyprojedu.cz

Stav k 2026-10-05, zrychlený běh: 15 otevřených zdrojů. Doplňuje a zpřesňuje soubory `tema_trh_konkurence.md` a `tema_financovani_partneri.md` (co je v nich, tady neopakuji). Fakta mají v hranatých závorkách číslo zdroje [n]. Co jsem na otevřené stránce nenašel, je označené **neověřeno**. Moje vlastní výpočty a úsudky jsou označené jako *(výpočet)* nebo *(úsudek)*.

Weby presbariery.cz, ostrava-bezbarier.cz a bezbarier.c-budejovice.cz jsem podle pravidel neotevíral. O presbariery.cz píšu jen to, co uvádí výroční zpráva POV [11].

## Shrnutí v bodech

- **VozejkMap (CZEPA)** je největší česká komunitní mapa: **19 551 míst** v API platformy Mapotic [2][3], CZEPA uvádí „více než 19 tisíc“ [4]. Místa vkládají uživatelé a provozovatelé, kontroluje je administrátor [4]. Mapa má 1 978 sledujících a 2 545 892 zobrazení [2]. Aplikace je zdarma, bez registrace a bez reklam [2][4].
- **Mapy bez bariér (Konto Bariéry / Nadace Charty 77)** mají v mapě **39 224 objektů** *(výpočet: součet kategorií na úvodní stránce [5])*. Data jsou **profesionální i komunitní** [5]. Profesionálové zapisovali i **měřené údaje** (šíře dveří, sklon rampy, rozměry výtahové kabiny) [6]. Data jsou **otevřená (ODbL)** a dostupná přes API, export XML/JSON/CSV a SPARQL [7]. Projekt byl spolufinancován z EFRR [6]. Tím se opravuje dřívější „neověřeno“ o rozměrech v `tema_trh_konkurence.md`.
- **POV (Přes bariéry / presbariery.cz)** spravovala v roce 2025 **4 315 profesionálně zmapovaných objektů** po celé ČR [11]. Mapuje i **na zakázku**: ÚMČ Praha 1 (10 objektů), Česká spořitelna (22 poboček a 108 bankomatů), ERÚ (5 budov), UHK (3 budovy), CzechTourism (2 trasy) [11]. Je to jediný doložený **placený B2B model** v ČR.
- **Financování POV v roce 2025:** příjmy celkem 3 210 541,83 Kč. Z toho vlastní hospodářská činnost 1 530 235,54 Kč, MMR 800 000 Kč, Úřad vlády 392 500 Kč a MHMP 375 709 Kč. Náklady byly 4 210 589,32 Kč [11].
- **Google Maps** má atributy přístupnosti vstupu, WC, sezení, parkování a výtahu. Kritérium „bezbariérový“ je ano/ne podle jednoho pravidla: **šířka 1 m a žádné schody** [12]. V roce 2020 měly Mapy Google údaje o vozíku u více než 15 mil. míst a přes 500 mil. aktualizací od komunity [13].
- **Mapy.com** v nápovědě uvádějí přístupnost jen u **plánování veřejné dopravy**: bezbariérové spoje a zastávky, trasy vhodné pro kočárky [14]. Hledání „bezbariérový“ v nápovědě jiný článek nenašlo [15]. Vrstva přístupnosti míst tedy **neověřeno / nejspíš chybí**.
- **Bezbariérový Hradec:** web jsem nenašel (doména neodpověděla), takže **neověřeno**. **Ostrava a České Budějovice** mají vlastní městské atlasy (weby vyloučené z vytěžování). Rozsah a model jsou **neověřeno**. Město České Budějovice je partnerem projektu Mapy bez bariér [6].
- **Mezera pro kudyprojedu** *(úsudek)*: nikdo nespojuje (1) měřené rozměry ve strojově čitelném formátu, (2) celou ČR, (3) řetěz cesty doprava → vstup → WC a (4) průběžnou aktualizaci. MBB mají měřená data, ale profesionální mapování skončilo převážně v roce 2015 (asi 600 objektů) [6]. VozejkMap je velký, ale bez metodiky měření [4]. Google zná jen ano/ne [12].

## 1. Profily konkurentů

### 1.1 VozejkMap (CZEPA)

| Položka | Zjištění | Zdroj |
|---|---|---|
| Provozovatel | Česká asociace paraplegiků – CZEPA, z. s. (vlastník mapy na platformě) | [2][4] |
| Technologie | white-label mapa na platformě **Mapotic** (map_id 1304), aplikace iOS a Android | [1][2][4] |
| Rozsah dat | **19 551 bodů** (API), „více než 19 tisíc míst“ (CZEPA) | [2][3][4] |
| Dosah | 1 978 sledujících, 2 545 892 zobrazení mapy (čítač platformy, období neuvedeno) | [2] |
| Kategorie | 20 kategorií: jídlo, ubytování, kultura, sport, instituce, školy, obchody, služby, příroda, trasy, veřejné WC, doprava, parkování, čerpací stanice, nabíjecí stanice, lékaři a lékárny, banky a bankomaty, Škoda Handy, akce, ostatní | [2] |
| Co hodnotí | podle CZEPA nejen vstup, ale i WC a parkování; fotky, komentáře, hodnocení | [4] |
| Zdroj dat | crowdsourcing (uživatelé a provozovatelé), data ověřuje administrátor; automatické zveřejnění nových míst je vypnuté, fotka je povinná | [2][4] |
| Obchodní model | aplikace „je a vždy bude“ zdarma, bez registrace; reklamy vypnuté | [2][4] |
| Financování | na stránce neuvedeno, **neověřeno** (CZEPA zmiňuje „partnery projektu“ bez jmen v textu) | [4] |
| Ocenění | Cena Rafael (Nadace Vodafone, 2015), Být vidět (Fórum dárců, 2013), 2. místo Společně otevíráme data (2013) | [4] |
| Kanály | aplikace v Google Play a App Store, web, Facebook VozejkMapCZ, leták | [2][4] |
| Slabiny *(úsudek)* | bez měřených rozměrů a bez veřejné metodiky; kvalita závisí na přispěvateli; závislost na komerční platformě Mapotic; otevřená data **neověřeno** (v API je pole „opendata_entry_level“, význam neznámý) | [2][4] |

### 1.2 Mapy bez bariér (Konto Bariéry / Nadace Charty 77)

| Položka | Zjištění | Zdroj |
|---|---|---|
| Rozsah dat | služby 12 175, doprava 4 736, pohostinství 3 165, úřady 2 084, kultura 1 444, ubytování 1 410, zdravotnictví 1 015, církevní budovy 644, sport 509, památky 329, volný čas 269, vzdělávání 53, památníky 39, rozhledny 29, zahrady 6, sociální služby 2, jiné 11 315; **celkem 39 224** *(výpočet; kategorie se mohou překrývat, neověřeno)* | [5] |
| Filtry | typ přístupnosti (hendikepovaní / rodiče s dětmi / senioři), 3 stupně přístupnosti, podklady profesionální / komunitní | [5] |
| Profesionální mapování | do konce roku 2015 skoro 600 objektů po celé ČR, hlavně památky a turistické cíle; měřily se šíře dveří, rampa a její sklon, výtahová kabina, toalety | [6] |
| Metodika | podle vyhlášky MMR a Metodiky mapování POV | [8] |
| Otevřenost | data pod **ODbL**, kód pod CC BY-NC 4.0, API (Apiary), export XML/JSON/CSV, SPARQL a dump Turtle, zdrojové kódy na GitHubu | [7] |
| Financování | spolufinancováno z EU (EFRR); partneři Asociace krajů ČR, Svaz měst a obcí ČR a město České Budějovice | [6] |
| Obchodní model | neziskový, součást projektů Konta Bariéry (sbírky, dárcovské certifikáty, firemní fondy) | [9] |
| Kanály | web, kód pro vloženou mapu, export, Facebook, jazykové verze | [5][7] |
| Slabiny *(úsudek)* | profesionální jádro je z roku 2015 a malé (~600 [6]); většinu tvoří neprofesionální nebo importovaná data; aktuálnost **neověřeno**; sekce Novinky vrací chybu 404 (známka útlumu, úsudek) | [6] |

### 1.3 POV – Přes bariéry / presbariery.cz (Praha, celá ČR)

| Položka | Zjištění | Zdroj |
|---|---|---|
| Organizace | Pražská organizace vozíčkářů, z. s., založena 1991; program **Přes bariéry** = mapování a odstraňování architektonických bariér | [10] |
| Rozsah dat | 4 315 položek profesionálně zmapovaných objektů po celé ČR (2025) | [11] |
| Zakázky v roce 2025 | MMR: 15 turistických objektů a infocenter; ÚMČ Praha 1: 10 objektů; UHK: 3 budovy včetně návrhu úprav; Česká spořitelna: 22 poboček a 108 bankomatů; ERÚ: 5 budov; CzechTourism: 2 trasy ve 2 krajích | [11] |
| Metodika | vede Pracovní skupinu pro jednotnou metodiku mapování a kategorizace přístupnosti (spolupráce s FA ČVUT); v roce 2025 témata i nabíjecí stanice a piktogramy | [11] |
| Financování webu | presbariery.cz udržován „za podpory Úřadu vlády ČR“ a z vlastních zdrojů; program Přes bariéry z dotace MMR | [11] |
| Hospodaření 2025 (Kč) | příjmy: Úřad vlády 392 500, MMR 800 000, MHMP 375 709, dary 80 970, vlastní hospodářská činnost 1 530 235,54, členské příspěvky 31 127,29, **celkem 3 210 541,83**; náklady **4 210 589,32** (z toho mzdy 2 880 181) | [11] |
| Ceník mapování | nenalezen, **neověřeno** | – |
| Kanály | web pov.cz a presbariery.cz, Noviny POV, Adresář (přes 900 kontaktů), akce (Hvězda, vycházky) | [10][11] |
| Slabiny *(úsudek)* | malý rozsah (4 315 objektů) a ztrátové hospodaření v roce 2025 (náklady převyšují příjmy zhruba o 1 mil. Kč, *výpočet*); závislost na ročních dotacích | [11] |

### 1.4 Google Maps a Mapy.com

| Položka | Google Maps | Mapy.com (Seznam) |
|---|---|---|
| Funkce | „Accessible Places“ (od 2020): ikona vozíku u vstupu, údaje o sezení, WC a parkování [13]; atributy profilu firmy: vstup, WC, sezení, parkování, výtah, naslouchadla, indukční smyčka [12] | bezbariérové spoje a zastávky ve veřejné dopravě, trasy pro kočárky [14] |
| Kritérium | ano/ne: vstup široký 1 m bez schodů (nebo s rampou), WC i kabinka 1 m; výtah „dost velký pro vozík“ [12] | podle dat dopravců, detail **neověřeno** |
| Rozsah | >15 mil. míst, >120 mil. Local Guides, >500 mil. aktualizací (stav 2020) [13]; počet v ČR **neověřeno** | **neověřeno** |
| Zdroj dat | Local Guides, uživatelé, majitelé firem [12][13] | jízdní řády, **neověřeno** |
| Slabiny *(úsudek)* | jedno binární kritérium; rozměry ani řetěz cesty nejsou; data nejsou otevřená | přístupnost míst (POI) v nápovědě nenalezena [15] |

### 1.5 Regionální atlasy

| Služba | Stav |
|---|---|
| presbariery.cz – Mapa přístupnosti Praha (POV) | viz 1.3; web jsem podle pravidel neotevíral |
| ostrava-bezbarier.cz | vyloučeno z vytěžování; rozsah, provozovatel a financování **neověřeno** |
| bezbarier.c-budejovice.cz | vyloučeno z vytěžování; **neověřeno**; město ČB je partnerem Map bez bariér [6] |
| Bezbariérový Hradec | doména bezbarierovyhradec.cz neodpověděla, na hradeckralove.org nenalezeno, **neověřeno**. POV v roce 2025 mapovala 3 budovy UHK [11] |

## 2. Srovnávací tabulka s kudyprojedu.cz

| Kritérium | kudyprojedu.cz (záměr) | VozejkMap | Mapy bez bariér | POV / presbariery | Google Maps | Mapy.com |
|---|---|---|---|---|---|---|
| Počet míst v ČR | začátek | 19 551 [2] | 39 224 *(výpočet)* [5] | 4 315 [11] | neověřeno | – |
| Měřené rozměry | ano (A11yJSON) | ne [4] | ano, jen profesionální část [6] | ano (profesionální mapování) [11] | ne, jen ano/ne s prahem 1 m [12] | ne |
| Zdroj dat | měření + komunita | komunita + admin [4] | profesionálové + komunita [5] | profesionálové [11] | komunita + firmy [12][13] | dopravci (neověřeno) |
| Řetěz cesty | ano | ne | ne | částečně (trasy pro CzechTourism) [11] | ne | jen MHD [14] |
| Otevřená data | ano (záměr) | neověřeno | ano, ODbL [7] | neověřeno | ne | ne |
| Celá ČR | ano | ano [2] | ano [5] | ano [11] | ano | ano |
| Model | freemium B2B (audity, obce) | zdarma, bez reklam [2] | nadace, EFRR [6][9] | dotace + zakázky [11] | ekosystém Google | předplatné Premium (viz starší podklad) |
| Mobilní aplikace | web (PWA) | iOS, Android [2] | web [5] | web | ano | ano |
| Převod CZ/DE standardů | ano | ne | ne | ne | ne | ne |

## 3. Ceny a obchodní modely – co z toho plyne

- Pro koncového uživatele je v ČR **všechno zdarma** [2][4][5][12]. Placená B2C verze nemá na trhu oporu *(úsudek)*.
- Jediný doložený **příjem z mapování** má POV: hospodářská činnost 1,53 mil. Kč v roce 2025 a zakázky pro banku, úřady, univerzitu a CzechTourism [11]. Ceník není veřejný (**neověřeno**). Zákazníky jsou **firmy se sítí poboček, městské části, univerzity a turistické organizace** [11]. To je přímý vzor segmentů pro kudyprojedu.
- Dotace pro mapování existují: MMR program (POV 800 000 Kč), Úřad vlády, MHMP [11], EFRR (MBB) [6].
- Doporučení *(úsudek)*: (1) nekonkurovat VozejkMap v komunitě, ale nabídnout výměnu dat; (2) převzít otevřená data MBB pod ODbL [7], což vyžaduje uvést zdroj a sdílet odvozenou databázi pod stejnou licencí; (3) konkurovat POV cenou a rychlostí auditu (mobilní měření) a navázat na jejich metodiku [8][11].

## Zdroje (vše otevřeno 2026-10-05)

1. VozejkMap – úvodní stránka (Mapotic white-label). https://www.vozejkmap.cz/
2. Mapotic API – mapa VozejkMap (id 1304). https://www.mapotic.com/api/v1/maps/1304/
3. Mapotic API – veřejné body VozejkMap (count). https://www.mapotic.com/api/v1/maps/1304/public-pois/?page_size=1
4. CZEPA – VozejkMap. https://czepa.cz/vozejkmap/
5. Mapy bez bariér – mapa. https://mapybezbarier.cz/cs
6. Mapy bez bariér – O projektu. https://web.mapybezbarier.cz/o-projektu/
7. Mapy bez bariér – Otevřená data. https://web.mapybezbarier.cz/otevrena-data/
8. Mapy bez bariér – Mapování. https://web.mapybezbarier.cz/mapovani/
9. Konto Bariéry – úvodní stránka. https://www.kontobariery.cz/
10. Pražská organizace vozíčkářů – O nás. https://www.pov.cz/o-nas
11. POV – Výroční zpráva 2025 (PDF). https://www.pov.cz/o-nas/vyrocni-zpravy?download=87:vyrocni-zprava-2025
12. Nápověda Firemní profil Google – Správa atributů firmy. https://support.google.com/business/answer/9049526?hl=cs
13. Google Blog – Find wheelchair accessible places with Google Maps (21. 5. 2020). https://blog.google/products/maps/wheelchair-accessible-places-google-maps/
14. Nápověda Mapy.com – Veřejná doprava. https://help.mapy.com/cs/planovani/verejna-doprava/
15. Nápověda Mapy.com – vyhledávání „bezbariérový“. https://help.mapy.com/cs/?s=bezbari%C3%A9rov%C3%BD

Nedostupné nebo nepoužité: bezbarierovyhradec.cz a bezbarierovy.hradeckralove.org (neodpověděly), hradeckralove.org (hledání 404), web.mapybezbarier.cz/novinky (404), vozejkmap.cz/opendata (404), support.google.com/maps/answer/9897039 (404), Google Play VozejkMap (404).
