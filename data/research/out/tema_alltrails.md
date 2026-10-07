# AllTrails jako inspirace pro modul tras kudyprojedu

Podklad pro modul **Trasy** na kudyprojedu.cz (STENT-IN). Zpracováno 2026-10-07.

**Co tento dokument je a co není.** Studujeme jen *funkce a informační architekturu* AllTrails. Podmínky AllTrails zakazují stahování a přebírání obsahu, proto z něj nic nepřebíráme: žádné trasy, recenze, fotky ani popisy. Níže jsou jen popisy funkcí vlastními slovy a odkazy na zdroje. V `data/raw/alltrails_meta/zdroje_2026-10-07.json` je jen seznam navštívených adres a názvů článků, žádný obsah.

**Jak se zdroje četly.** Stránky `www.alltrails.com/czech-republic` a stránky tras i nápověda `support.alltrails.com` vracely 7. 10. 2026 při automatickém přístupu (curl, WebFetch) chybu 403 nebo ochranu Cloudflare. Ochranu jsme neobcházeli. Homepage šla načíst jednou [1]. Články nápovědy jsme četli ve veřejných snímcích Internet Archive z roku 2026 [2–19]. Stránky `/czech-republic` a `/germany/bavaria` se tedy přímo prohlédnout nepodařilo. Strukturu stránky trasy popisujeme podle nápovědy, která ji vysvětluje (sekce „Plan your visit → Accessibility“, karta podmínek, „Preview trail“, tlačítko „Map“, recenze).

**Refero.** Ve sbírce Refero AllTrails není. Dotazy „AllTrails trail detail“ a „AllTrails filters“ (iOS) vrátily obrazovky aplikace **komoot**, dotaz „trail map elevation profile“ (web) vrátil Windy, Chargetrip a Apple Maps [20–23]. Použili jsme je jako vzory UI pro stejný typ obrazovek.

---

## 1. Funkce AllTrails užitečné pro lidi na vozíku a s omezenou pohyblivostí

### 1.1 Vyhledávání a filtry
- **Filtry na webu i v aplikaci** [13]. Řazení: nejlepší shoda, nejoblíbenější, nejbližší, nově přidané. Dále aktivita (18 druhů), obtížnost, délka (0–50+ mi), převýšení (0–5 000+ ft), **Suitability**, atrakce, typ trasy (*out & back*, *loop*, *point to point*), hodnocení, provoz na trase (light/moderate/heavy) a stav dokončení.
- **Suitability** obsahuje štítky *Dog friendly, Kid friendly, **Wheelchair friendly, Stroller friendly, Paved, Partially paved*** [13]. Nápověda pro vozíčkáře je doporučuje kombinovat [7].
- Filtry se kombinují logikou **A** (AND): trasa musí mít všechny vybrané vlastnosti [13].
- Před potvrzením tlačítko ukazuje počet výsledků („See x trails“). Aktivní filtr je zvýrazněný zeleným rámečkem [13].
- Filtr **vzdálenost od mě** (5–60 mil) je jen pro placené členy [13].
- **Body zájmu (POI)** z OpenStreetMap. Po klepnutí na POI se ukáže seznam tras, které kolem něj vedou [16].

### 1.2 Pravidla pro štítek „Wheelchair friendly“ [7]
Nejcennější zdroj. AllTrails má vlastní kritéria podle amerických a kanadských norem (ABAAS Outdoor, CSA, US Forest Service FSTAG):
- **Povrch:** pevný a hladký (beton, asfalt, povalový chodník, udusaná hlína nebo štěrk). Uvede, když povrch projede jen terénní nebo elektrický vozík.
- **Příčný sklon:** uvede, když je nerovný nebo **větší než 2 %**.
- **Šířka:** obvykle **3 ft (≈ 0,91 m) a víc**, při šířce pod **5 ft (≈ 1,52 m)** uvádí místa pro vyhnutí.
- **Překážky vyšší než 2 in (≈ 5 cm):** schody, změny povrchu, sloupky. Dále rizika, například přechody silnice nebo úseky sdílené s auty. Pokud to jde, zakreslí je jako waypointy.
- **Sklon ve slovních kategoriích:** ≤ 1 % rovina, ≤ 3 % mírný, ≤ 5 % převážně mírný, 5–8 % středně strmý, 8–12 % strmý, nad 12 % velmi strmý. Při delších úsecích od 5 % doporučuje terénní nebo elektrický vozík. Mechanický vozík nebo kočárek tam může potřebovat pomoc.
- **Místa k odpočinku:** lavičky a piknikové stoly.
- **Délka:** štítek může mít i dlouhá trasa. Uvede alternativní vstupy a nejpřístupnější část trasy.
- **Parkování:** počet vyhrazených stání u startu, stání pro dodávku s vyznačeným uličkou a povrch parkoviště. Když u startu vyhrazené stání není, zakreslí náhradní parkoviště.
- **Kvalita zážitku:** štítek může dostat i trasa, kde je přístupná jen vyhlídka blízko startu. Naopak upozorní, když bod zájmu mimo trasu přístupný není.
- **Spolupráce s místními organizacemi**, například Access Northern California nebo Disabled Hikers. Jejich příspěvky se na stránce trasy citují. Pokud park označí trasu jako přístupnou, AllTrails to převezme a cituje.
- **Na stránce trasy** je strukturovaná sekce *Accessibility* (Equipment, Parking, Surface, Grade, More info). Najdete ji na webu v části „Plan your visit“, v aplikaci v karuselu „Helpful Links“.
- **Stránky parků** mají souhrn přístupnosti celého areálu: WC s rozměry, půjčovny pomůcek, kyvadlová doprava pro vozíky, mapy v Braillu, přístupné pláže a mola.
- **Profil sklonu:** grafem sklonu a výšky lze posouvat a sklon je v něm odhadnutý **zhruba po 100 m** [7].
- **Hlášení chyb:** recenze s fotkami, „suggest an edit“ a e-mail [7].

### 1.3 Detail trasy a plánování
- **Obtížnost** má 4 stupně (Easy, Moderate, Hard, Strenuous). Trasy hodnotí i komunita a stránka ukazuje souhrn hodnocení [3].
- **Odhad času** počítá upravené Naismithovo pravidlo z délky a převýšení, a jen pro chůzi [6].
- **3D náhled trasy** („Preview trail“) projede trasu na satelitní 3D mapě. Během něj se načítá převýšení a náhled lze pozastavit a přiblížit [12].
- **AI souhrn recenzí** shrnuje recenze za poslední rok, sezónní informace a stav trasy [4].
- **Trail Conditions:** počasí, srážky, sníh, kvalita ovzduší, slunce a měsíc a předpověď na 7 dní. Data dodávají třetí strany (Meteomatics, Tomorrow.io). Podrobný přehled je jen v nejvyšším tarifu [9].
- **Ověřené trasy vs. úseky z OSM:** ručně ověřená trasa je na mapě silná zelená čára, úseky z OSM jsou čárkované a AllTrails je neověřuje [17]. Nové trasy navrhují uživatelé a schvalují je moderátoři. Program Public Lands umožňuje správcům území vydávat upozornění přímo na stránce trasy [5].

### 1.4 Mapa a vrstvy [14]
- Podkladové mapy: AllTrails, satelitní, terénní, silniční, OSM, OpenCycleMap a národní topografické mapy.
- Překryvy (overlays): komunitní heatmapa provozu, srážky, teplota a výška sněhu, plus osobní heatmapa.
- Doplňky (extras) na webu: geotagované fotky, waypointy, okolní trasy, **kilometrovníky** a značené trasy.
- **Komunitní heatmapa** se počítá z veřejných záznamů za 12 měsíců a obnovuje se měsíčně. Pomáhá najít klidná místa [8].

### 1.5 Navigace, offline a sdílení
- **Navigate:** sledování polohy na trase, ujetá část se barví. Při **75 %** ověřené trasy získáte odznak „Verified Completed“ [15].
- **Graf převýšení v navigaci** ukazuje polohu na profilu. Úseky stoupání **6–11 % jsou žlutě, od 11 % červeně**. Podržením prstu zobrazíte sklon v bodě [19].
- **Upozornění na odbočení z trasy** přijde po **50 m** mimo trasu, i na zamčený displej a hodinky [11].
- **Offline:** stažení trasy, parku nebo vlastní oblasti (až 500 tras na oblast). Filtry se uloží se staženou oblastí [18].
- Dále: vlastní trasy, otočení směru trasy, export GPX, tisk mapy do PDF, Live Share polohy, seznamy (Saved → Lists), komunitní feed a soukromí obsahu [1][2].
- **Tarify:** Base (zdarma), Plus (offline, upozornění na odbočení, 3D náhled, Live Share), Peak (vlastní trasy, podmínky na trase, heatmapy) [10].

---

## 2. Co AllTrails chybí z pohledu přístupnosti

| Chybí nebo je slabé | Proč to vadí | Zdroj / poznámka |
|---|---|---|
| **Maximální sklon** a filtr podle něj | Sklon se průměruje zhruba po 100 m, takže krátká strmá rampa (např. 15 m s 12 %) v průměru zanikne. Filtr umí jen převýšení celé trasy. | [7][13] |
| **Příčný sklon** jako údaj a filtr | Je jen zmínka v textu „když je známo“. Pro mechanický vozík je přitom kritický. | [7] |
| **Šířka** jako číslo a filtr | Šířka je jen v textu, ve filtrech chybí. | [7][13] |
| **Povrch po úsecích** | Ve filtrech jsou jen Paved a Partially paved. Není vidět, kde přesně začíná štěrk nebo dlažba ani jak je úsek dlouhý. | [13] |
| **Jeden štítek pro všechny** | „Wheelchair friendly“ zahrnuje i trasy *částečně* sjízdné a trasy s přístupnou jen vyhlídkou. Pro elektrický vozík, mechanický vozík, chodítko a kočárek není rozlišení. | [7] |
| **Personalizace podle profilu** | Filtry nemají uložený profil potřeb (typ pomůcky, max. sklon, max. schod). Logika AND jen zužuje výběr a nevysvětlí, *proč* trasa nevyhovuje. | [13] |
| **Lavičky, WC a parkování ZTP jako data** | Jsou v textu sekce Accessibility, ne jako body s polohou na trase („lavička na 1,2 km“). Na mapě nejsou zvlášť filtrovatelné. | [7][14] |
| **Bezbariérová MHD ke startu** | Není. Parkování řeší jen autem. | [7] |
| **Odhad času pro vozík** | Odhad času je jen pro chůzi (Naismith). | [6] |
| **Barvy sklonu v grafu** | Barvy začínají od 6 % (žlutá) a 11 % (červená). Rozmezí 3–6 %, podstatné pro mechanický vozík, se nezvýrazní. | [19] |
| **Otočky a únikové body** | Text zmíní „nejpřístupnější část“, ale chybí strukturovaný údaj typu „do km 2,4 bez bariér, pak schody, otočit se lze na km 2,3“. | [7] |
| **Aktuální bariéry nahlášené komunitou** | Hlášení jde přes recenze nebo „suggest an edit“. Chybí rychlé hlášení typu „spadlý strom / bláto / rozkopáno“ s datem a vypršením platnosti. | [7] |
| **Kontext v Česku** | Hodnocení přístupnosti dělá malý tým na dálku, hlavně v USA. Česká data o přístupnosti tras (KČT, kraje, Mapy bez bariér) nevyužívá. | [7] |
| **Placené funkce** | Offline, upozornění na odbočení a podmínky na trase jsou za předplatným. | [10] |

---

## 3. Konkrétní návrh pro kudyprojedu

### 3.1 Datový model trasy

Jedna trasa je jeden JSON objekt v `data/routes/*.json`. Geometrie je GeoJSON (WGS84). Délky jsou v metrech, sklony v %, výšky v cm (schod, obrubník) nebo v m (nadmořská výška). Ke každému údaji patří `src` (zdroj) a `d` (datum), stejně jako u míst.

```jsonc
{
  "id": "cb-slepi-rameno-01",
  "nazev": "…", "kraj": "jihocesky", "obec": "České Budějovice",
  "typ": "okruh | tam_a_zpet | z_bodu_do_bodu",
  "geom": { "type": "LineString", "coordinates": [[14.47, 48.97], …] },

  // souhrn (počítá se ze segmentů)
  "delka_m": 3200, "stoupani_m": 18, "klesani_m": 18, "vyska_min_m": 382, "vyska_max_m": 396,
  "sklon_max_pct": 7.4,           // max. na úseku ≥ 10 m (aby šum DMR nedělal špičky)
  "sklon_max_trvaly_pct": 5.1,    // max. průměr na úseku ≥ 50 m
  "podil_sklonu": { "do3": 0.82, "3az6": 0.15, "6az10": 0.03, "nad10": 0 },
  "prichny_sklon_max_pct": null,  // jen z měření / komunity, DMR to neumí
  "sirka_min_m": 1.5,
  "povrch_podil": { "asfalt": 0.7, "dlazba": 0.1, "zpevneny_strk": 0.2 },
  "stupen": "A | B | C | X",       // náš stupeň sjízdnosti (viz 3.2), počítaný
  "cas_min": { "elektricky": 40, "mechanicky": 55, "chuze_s_holi": 70 }, // odhad, viz pozn.

  // segmenty – jádro modelu
  "useky": [
    { "od_m": 0, "do_m": 420, "osm_way": 123456, "highway": "footway",
      "surface": "asphalt", "smoothness": "good", "sirka_m": 2.0,
      "sklon_pct": 1.2, "sklon_max_pct": 2.5, "osm_incline": null,
      "lit": true, "src": "OSM+DMR5G", "d": "2026-10-07" }
  ],
  // body podél trasy (poloha = metr od startu)
  "body": [
    { "typ": "schod | obrubnik | sloupek | branka | zavora | prechod | vytah | lavicka | wc | parkovani_ztp | zastavka_mhd | vyhlidka | otocka | vstup",
      "poloha_m": 1240, "lat": 48.97, "lon": 14.47,
      "vyska_cm": 12, "sirka_cm": null, "wheelchair": "yes|limited|no|null",
      "eurokey": null, "pocet": null, "obejiti": "ano|ne|neznamo",
      "osm": "node/987", "src": "OSM", "d": "2026-10-07" }
  ],
  "start": { "parkovani_ztp": { "pocet": 2, "vzdalenost_m": 60, "src": "…" },
             "mhd": { "zastavka": "…", "nizkopodlazni": null, "vzdalenost_m": 150 } },
  "pristupna_cast": { "do_m": 2400, "duvod": "schody na km 2,45" },
  "overeni": [{ "datum": "…", "kdo": "komunita|tym|spravce", "metoda": "projeto|zmereno|z_dat" }],
  "zdroje": [{ "nazev": "© přispěvatelé OpenStreetMap", "licence": "ODbL 1.0", "url": "…" },
             { "nazev": "ČÚZK – DMR 5G", "licence": "CC BY 4.0", "url": "…" }]
}
```

**Odkud data bereme (vše otevřené):**

| Pole | Zdroj | Jak |
|---|---|---|
| geometrie, `highway`, `surface`, `smoothness`, `width`, `incline`, `wheelchair`, `tracktype`, `lit`, `bridge`/`tunnel` | OpenStreetMap přes Overpass API (ODbL) [24] | Stejný dotaz jako dnes v `assets/js/trasy.js`, ale podél linie trasy. Linie se rozdělí na úseky podle hranic OSM way. |
| schody (`highway=steps`, `step_count`), obrubníky (`barrier=kerb`, `kerb`, `kerb:height`), `barrier=bollard/gate/stile/kissing_gate/cycle_barrier`, výtahy, přechody | OSM [24] | Body do 10 m od linie, přepočet na `poloha_m`. Typy tvarů a barev už máme v `trasy.js`. |
| lavičky (`amenity=bench`), stoly (`leisure=picnic_table`), WC (`amenity=toilets` + `wheelchair`, `centralkey=eurokey`), stání ZTP (`amenity=parking_space` + `parking_space=disabled`, `capacity:disabled`), zastávky (`public_transport=platform` + `wheelchair`) | OSM [24], u WC a stání i naše `places.json` (IPR Praha, Mapy bez bariér…) | Body do 30–50 m od trasy, u startu do 300 m. |
| výškový profil, `sklon_pct`, `stoupani_m` | **ČÚZK DMR 5G**: střední chyba výšky 0,18 m v odkrytém a 0,3 m v zalesněném terénu, zdarma, CC BY 4.0 [25] | Převzorkovat linii po 5–10 m. Výšky vyhladit klouzavým průměrem přes cca 3 body. Sklon počítat z okna ≥ 10 m. **Mosty a lávky** (`bridge=yes`) interpolovat, protože DMR je model holého terénu. Mimo ČR (Bavorsko) použít Copernicus DEM nebo bavorský DGM (zdroj ještě ověřit). |
| `prichny_sklon_max_pct`, přesná `sirka_m` | Jen měření na místě (komunita, tým) | Metodika měření jako u míst (A11yJSON). |
| odkaz na směrování | openrouteservice, profil `wheelchair`: `maximum_incline` 3/6/10/15 %, `maximum_sloped_kerb` 0,03/0,06/0,1 m, `surface_type`, `smoothness_type`, `track_type`, `minimum_width` [26] | Volitelně pro funkci „najdi objížďku“ (potřebuje API klíč, viz kap. 4). |

**Ověřeno 7. 10. 2026:** služba ČÚZK `ags.cuzk.cz/arcgis2/rest/services/dmr5g/ImageServer` odpovídá na `identify` pro jeden bod (náměstí v ČB vrátilo 387,5 m) a posílá hlavičku CORS pro `rozporkavojta-png.github.io`. Hromadný `getSamples` vrací 403 [27]. Profil je proto lepší **předpočítat skriptem v `tools/`** a uložit ho do JSON, ne volat bod po bodu z prohlížeče.

### 3.2 Filtry (stránka Trasy, seznam tras)
Na rozdíl od AllTrails filtrujeme podle **měřitelných hodnot**, ne jen podle štítků:
1. **Max. sklon:** do 3 / 6 / 10 % / bez omezení. Hodnoty odpovídají profilu ORS [26]. Volitelně „max. trvalý sklon“.
2. **Povrch:** jen zpevněný (asfalt, beton, hladká dlažba) / povolit zpevněný štěrk / cokoli. Doplňkově „max. podíl nezpevněného povrchu“.
3. **Min. šířka:** 0,9 / 1,2 / 1,5 m (0,9 m jako u AllTrails, ≈ 3 ft [7]).
4. **Bez schodů a překážek** vyšších než X cm (2 / 3 / 6 / 10 cm, obrubník podle ORS [26]).
5. **Délka a převýšení** (rozsahy), **typ trasy** (okruh / tam a zpět / z bodu do bodu).
6. **Zázemí:** bezbariérové WC na trase nebo u startu, stání ZTP u startu, bezbariérová MHD, lavička aspoň každých X m.
7. **Ověření:** jen projeté nebo změřené, stáří dat.
8. **Řazení:** nejbližší, nejkratší, nejmírnější (podle `sklon_max_pct`), nejnověji ověřené.

U filtrů zachováme dobré vzory AllTrails: počet výsledků v tlačítku a zvýraznění aktivního filtru [13]. Navíc **u vyřazených tras ukážeme důvod** („vyřazeno: schod 12 cm na km 1,2“), stejně jako dnes `core.js → match()` u míst.

### 3.3 Stránka detailu trasy (sekce)
1. **Hlavička:** název, obec a kraj, **stupeň sjízdnosti pro můj profil** (vyhovuje / s pomocí / nevyhovuje a proč), datum posledního ověření, uložit, sdílet.
2. **Souhrnná dlaždice:** délka, typ, převýšení, **max. sklon**, **min. šířka**, podíl zpevněného povrchu, počet bariér, odhad času podle pomůcky.
3. **Mapa:** trasa obarvená podle sklonu nebo povrchu (přepínač), body bariér (tvary z `trasy.js`), lavičky, WC, ZTP a MHD, kilometrovníky. Vzor: AllTrails extras „Distance markers“ a „Waypoints“ [14].
4. **Profil sklonu a výšky:** pásy **do 3 % / 3–6 % / 6–10 % / nad 10 %**. Jsou jemnější než 6/11 % v AllTrails [19] a odpovídají potřebám mechanického vozíku. Najetí na graf zvýrazní místo na mapě (vzor Apple Maps a Chargetrip [22][23]).
5. **Úsek po úseku** (tabulka nebo seznam): od–do, povrch, šířka, sklon, bariéry. Přístupné bez mapy a vhodné pro čtečky obrazovky.
6. **Start a dojezd:** stání ZTP (počet, vzdálenost), zastávka MHD, alternativní vstupy, **přístupná část trasy a místo pro otočení**.
7. **Zázemí na trase:** WC (Euroklíč), lavičky (rozestupy), občerstvení z `places.json`.
8. **Hlášení a ověření komunitou:** poslední hlášení s datem, tlačítko „nahlásit překážku“.
9. **Zdroje a licence:** OSM, DMR 5G, měření, každý údaj se zdrojem a datem (princip webu).
10. **Akce:** stáhnout GPX, otevřít v Google Maps nebo Mapy.cz, vytisknout PDF.

### 3.4 Personalizace podle profilu potřeb
Rozšíříme stávající `DEFAULT_NEEDS` v `core.js` (dnes `aid`, `acceptLimited`, `needWc`, `needParking`, `onlyChecked`) o pole pro trasy:
- `aid`: elektrický vozík / mechanický vozík / mechanický s doprovodem / chodítko nebo hole / kočárek. Pomůcka nastaví **výchozí hodnoty** ostatních polí.
- `maxIncline` (%), `maxSustainedIncline` (%), `maxStepCm`, `minWidthM`, `surfaces` (povolené), `maxLengthM`, `benchEveryM`, `needWcOnRoute`.
- Výsledek pro trasu: **vyhovuje / vyhovuje s pomocí / nevyhovuje / nevíme** s výčtem důvodů a s polohou problému na trase. Stav „nevíme“ (chybějící data) se zobrazí odlišně, princip „nezakreslený schod neznamená, že tam schod není“ už web používá.
- Odhad času podle pomůcky: rychlost, kterou zadá uživatel (výchozí hodnotu je třeba ověřit, zatím nemáme zdroj), plus penalizace za stoupání. Musí být jasně označen jako odhad.

### 3.5 Komunitní funkce
- **Rychlé hlášení překážky** (bod na mapě + typ + volitelná fotka) s **platností** (např. rozkopávka 30 dní, bláto 7 dní). Odpovídá to podmínkám na trase u AllTrails [9], ale lokálně a ručně.
- **„Projel(a) jsem“:** potvrzení sjízdnosti s typem pomůcky a datem. Obdoba „Verified Completed“ [15], ale jako **ověření dat**, ne jako odznak.
- **Měření** (šířka, příčný sklon, výška schodu) podle naší metodiky. Má vyšší váhu než odvozená data.
- **Návrh nové trasy** schvaluje moderátor (vzor [5]). Volitelně opravy přes OSM. U POI AllTrails samo odkazuje na editaci OSM [16].
- **Správci území** (obce, kraj, KČT, CHKO) mohou vydat upozornění na trase (vzor Public Lands [5]).
- Recenze jsou strukturované (co bylo a nebylo sjízdné), ne jen volný text. AI souhrn recenzí [4] má smysl až při dostatku dat.

### 3.6 Itinerář
- Den složený z **trasy + míst z `places.json`** (start: stání ZTP → trasa → bezbariérové WC → kavárna → zastávka MHD). Už dnes existuje plánovač A→B a „Moje trasy“ v prohlížeči.
- Kontrola itineráře proti profilu (stejná funkce `match()`), celková délka a čas, místa k odpočinku.
- Výstupy: tisk a PDF, GPX, sdílený odkaz (stav v URL), později uložení na účet.

---

## 4. Co jde postavit hned staticky a co potřebuje server

| Funkce | Statický prototyp (GitHub Pages, bez serveru) | Potřebuje server nebo službu |
|---|---|---|
| Datový model, seznam a detail trasy | ✔ JSON v `data/routes/` generovaný skriptem v `tools/` (Overpass + DMR 5G offline) | — |
| Výškový profil a sklony | ✔ předpočítané v `tools/`. Živě jen pro krátké úseky přes `identify` DMR 5G (CORS funguje [27]). | Hromadné vzorkování libovolné trasy uživatele (vlastní endpoint nebo dlaždice DEM) |
| Filtry podle sklonu, povrchu, šířky, bariér | ✔ v prohlížeči nad JSON | — |
| Profil potřeb a hodnocení tras | ✔ rozšíření `core.js` (`localStorage`) | Synchronizace profilu mezi zařízeními |
| Mapa s obarvením podle sklonu a povrchu, kilometrovníky | ✔ Leaflet | — |
| Živé bariéry z OSM kolem trasy | ✔ už existuje (Overpass z prohlížeče) | — |
| Export GPX, tisk, sdílení odkazem | ✔ generování v prohlížeči, stav v URL | — |
| Itinerář trasa + místa | ✔ v prohlížeči, uložení do `localStorage` | Uložení na účet a sdílení s ostatními |
| Navigace s polohou a upozornění na odbočení | ✔ základ přes Geolocation API (poloha na profilu, vzdálenost od linie) | Spolehlivě na pozadí a se zamčeným displejem jen v nativní aplikaci |
| Offline | ✔ částečně: Service Worker uloží stránku a JSON trasy | Offline mapové dlaždice ve větším rozsahu (podmínky poskytovatele dlaždic) |
| Směrování a objížďky podle profilu | — | openrouteservice (API klíč, limity) nebo vlastní instance [26] |
| Komunitní hlášení, „projel jsem“, měření, fotky, moderace | — (jen formulář do e-mailu nebo issue jako provizorium) | ✔ databáze, účty, moderace, úložiště fotek, vypršení platnosti hlášení |
| Podmínky na trase (počasí) | ✔ jednoduché načtení otevřené předpovědi z prohlížeče (zdroj ještě vybrat) | Agregace a historie |
| Heatmapa provozu | — | ✔ sběr záznamů a ochrana soukromí |

**Doporučené pořadí:** (1) skript `tools/build_routes.py` pro 3–5 pilotních tras v Českých Budějovicích (OSM + DMR 5G), (2) detail trasy s profilem a výpisem úseků, (3) filtry a profil potřeb, (4) itinerář s místy, (5) serverová část pro komunitu.

---

## Zdroje
Všechny navštíveny 2026-10-07. Články nápovědy AllTrails jsou čtené přes Internet Archive (snímky z roku 2026), protože přímý přístup vracel 403.

1. AllTrails – homepage. https://www.alltrails.com/
2. AllTrails Help Center (seznam článků, snímek 12. 7. 2026). https://support.alltrails.com/hc/en-us · archiv: http://web.archive.org/web/20260712133251/https://support.alltrails.com/hc/en-us
3. Difficulty ratings on AllTrails. https://support.alltrails.com/hc/en-us/articles/16596491196436
4. Review Summaries. https://support.alltrails.com/hc/en-us/articles/23871576516500
5. How does a trail end up on AllTrails? https://support.alltrails.com/hc/en-us/articles/30315531476628
6. How do I know how long it will take to complete a trail? https://support.alltrails.com/hc/en-us/articles/360041658932
7. Accessibility guide for wheelchair-friendly trails. https://support.alltrails.com/hc/en-us/articles/360056963411
8. Community Heatmaps. https://support.alltrails.com/hc/en-us/articles/36898308536852
9. Trail Conditions. https://support.alltrails.com/hc/en-us/articles/36933535617300
10. AllTrails Plans. https://support.alltrails.com/hc/en-us/articles/37186483585556
11. Wrong-turn alerts. https://support.alltrails.com/hc/en-us/articles/37213407013908
12. Trail previews on trail pages. https://support.alltrails.com/hc/en-us/articles/37212870983700
13. How to use filters to find trails. https://support.alltrails.com/hc/en-us/articles/37227964040852
14. AllTrails map types, overlays, and extras. https://support.alltrails.com/hc/en-us/articles/37228180990228
15. Using the Navigate feature. https://support.alltrails.com/hc/en-us/articles/37228358315668
16. Points of Interest (POIs) on Explore. https://support.alltrails.com/hc/en-us/articles/37237393095572
17. Verified routes vs. OSM (OpenStreetMap) segments. https://support.alltrails.com/hc/en-us/articles/4410231246100
18. Download custom areas for offline use. https://support.alltrails.com/hc/en-us/articles/37758009767444
19. How do I use the elevation graph in Navigator? https://support.alltrails.com/hc/en-us/articles/360038534672
20. Refero – komoot, detail trasy (záložky, statistiky, waypointy, tlačítko Navigate). https://refero.design/screens/7e303d56-0ad7-4f64-8b6f-ae2ae04e5079 , https://refero.design/screens/6b0c18b4-4324-40d4-aa7a-59bccb8a3fb6
21. Refero – komoot, filtry (čas/vzdálenost, obtížnost, start), uložené trasy s ikonami offline a soukromí. https://refero.design/screens/84561640-6799-45be-b7c4-c98dfbe6728c , https://refero.design/screens/b30da41d-2d98-44f0-87c7-7608a365e3a6
22. Refero – Apple Maps, cyklotrasa s výškovým profilem, upozorněními a pokyny. https://refero.design/pages/cf0948c4-a287-44a3-880f-0b09aa0e4261
23. Refero – Windy a Chargetrip, mapa s výškovým profilem ve spodním panelu. https://refero.design/pages/59db3671-77a1-4a2b-92e1-1f5b48d0f1da , https://refero.design/pages/dbbd080a-2396-46d4-8ae4-7a87ffd10146
24. OpenStreetMap Wiki – klíče `incline`, `width`, `surface`, `smoothness`, `wheelchair`, `kerb`, `barrier`, `amenity=bench`, `parking_space=disabled`, `centralkey`. https://wiki.openstreetmap.org/wiki/Key:incline (a obdobně `Key:<název>`)
25. ČÚZK – metadata DMR 5G (přesnost, formát LAZ, CC BY 4.0, zdarma, ATOM/WMS). https://geoportal.cuzk.gov.cz/(S(0))/Default.aspx?mode=TextMeta&side=vyskopis&metadataID=CZ-CUZK-DMR5G-V&head_tab=sekce-02-gp&menu=302
26. openrouteservice – Routing options, omezení profilu wheelchair. https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options
27. ČÚZK ArcGIS ImageServer DMR 5G (vlastní test `identify` a `getSamples` 2026-10-07). https://ags.cuzk.cz/arcgis2/rest/services/dmr5g/ImageServer
