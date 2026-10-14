# Wherethru – designový systém (verze 4)

Značka: **Wherethru** (dříve pracovní název kudyprojedu.cz). Tým a projekt STENT-IN zůstávají na stránce O projektu.
Claim: CZ „Objevuj · Plánuj · Zažij – bez bariér“, DE „Entdecken · Planen · Erleben – ohne Barrieren“,
EN „Explore · Plan · Experience – without barriers“. Doménu wherethru nikde netvrdíme.

Podklady: logo a paleta (identita), mockup ceníku a mockup aplikace. Z mockupů přebíráme **vzhled, ne data**:
hvězdičky, počty recenzí, „Verified accessibility“, akce s termíny, čísla v dashboardu, „Most popular“ a rozměry
v mockupu jsou vymyšlené a na web nepatří.

## Poctivost (platí beze změny z v3)
- Nikdy nevymýšlíme data, recenze, hodnocení, akce, partnery, uživatele, statistiky ani rozměry.
- Hodnocení a počty recenzí ukazujeme jen tehdy, když jsou v datech. Místo nich skutečné údaje: počet míst ze
  statistik (`data/stats.json`), zdroj údaje (naměřeno / web provozovatele / OpenStreetMap), datum.
- Místo „Most popular“ píšeme „Doporučujeme“. Akce bez dat = poctivý prázdný stav. Dashboard podniku = „ukázka
  s daty vašeho místa / prototyp“.
- „AI“ plánovače jsou pravidla nad skutečnými daty a tak je označujeme.
- Žádné platby, účty ani platební formuláře. Členství je prototyp s přepínačem „Vyzkoušet“.
- Fotky jen ze stávajících dat (Wikimedia Commons s autorem a licencí) nebo z Commons ověřené přes API; autor
  a licence u fotky a v `assets/img/CREDITS.md`. Žádné AI fotky, nic z mockupů.
- Texty česky, krátké, jasné, bez emoji a bez pomlčkových vsuvek. Nové texty přes i18n (`KP.t`, `data-i18n`).

## Barvy (tokeny v `assets/css/style.css`)
| token | světlý | tmavý | k čemu |
|---|---|---|---|
| `--brand-900` | #3A4A34 | #A9BBA0 | nadpisy, primární tlačítko, ikony, aktivní stav |
| `--brand-700` | #4E5F47 | #BCCBB4 | hover primárního |
| `--brand-500` | #7D8F76 | #8FA287 | plochy, ikony, obrysy, velký text. **Ne malý text na bílé (3,5 : 1).** |
| `--brand-300` | #C3CDBC | #36412F | zapnutý čip |
| `--brand-200` | #D9DED3 | #2F3A2B | výplně, čipy, aktivní položka navigace, linky |
| `--brand-100` | #EBEEE7 | #262E23 | jemné podklady sekcí |
| `--on-brand` | #FFFFFF | #171C15 | text na `--brand-900` |
| `--bg` | #F7F7F5 | #171C15 | podklad stránky |
| `--surface` | #FFFFFF | #20271D | karty, panely, pole |
| `--surface-2` / `-3` | #EFF1EC / #E3E7DF | #262E23 / #303A2C | výplně uvnitř karet |
| `--ink` / `--ink-2` / `--ink-3` | #1F261C / #3C4638 / #55604F | #EEF1EA / #D3DACD / #AEB8A7 | text / vedlejší / tlumený |
| `--heading` | #3A4A34 | #EEF1EA | nadpisy |
| `--line` / `--line-strong` | #E3E7DF / #B9C2B3 | #323C2E / #4A5745 | jemné linky / obrys polí |
| `--inverse` / `--on-inverse` | #3A4A34 / #F7F7F5 | #2A3426 / #EEF1EA | tmavé plochy (patička, zvýrazněná karta, panel dashboardu) |
| `--warn` / `--warn-soft` | #8A5A00 / #F6EBD6 | #E3B866 / #3B2F14 | jen varování (teplá okrová) |
| `--no` / `--no-soft` | #B3261E / #FBE4E1 | #FF9A8F / #431D1A | chyba, „nepřístupné“ |
| `--ok`, `--part`, `--unk` | stav přístupnosti (vždy tvar + text, `.status`) |||

Starší tokeny z v3 (`--signal`, `--on-signal`, `--rule`, `--tape`, `--action`) zůstávají jako aliasy, aby stránky
nepadaly, ale míří na nové barvy: `--signal` = `--brand-200`, `--rule` = `--line`, `--action` = `--brand-900`.
V novém kódu je nepoužívejte. Žlutá #FFD400 a ostré černé linky ve v4 nejsou.

Kontrast AA: text #3A4A34 na #F7F7F5 8,9 : 1, bílá na #3A4A34 9,5 : 1, #55604F na bílé 6,3 : 1. Šalvějová
#7D8F76 jen jako plocha, ikona nebo obrys (≥ 3 : 1), ne pro malý text.

## Tvary, stíny, rytmus
- Oblé rohy: karty `--r-card` 20 px, tlačítka a pole `--r` 14 px, malé prvky `--r-sm` 10 px, čipy pill 999 px,
  spodní panel `--r-lg` 28 px.
- Stíny jemné: `--shadow` = 0 1px 2px + 0 8px 24px rgba(30,40,25,.06); `--shadow-lg` pro panely a menu.
- Vzdušné mezery: sekce 56–96 px, uvnitř karet 20–24 px, mřížky 16–24 px. Obsah max. 1200 px (`--maxw`).
- Žádné ostré černé linky. Dělení obsahu mezerou, kartou nebo jemnou linkou `--line`.

## Písmo (Google Fonts, odkaz v `<head>` každé stránky)
- Nadpisy, logo, čísla v kartách: **Plus Jakarta Sans** 700–800 (`--f-display`).
- Text: **Atkinson Hyperlegible Next** (`--f-body`), kvůli čitelnosti pro lidi se zrakovým omezením. Rozměry
  a čísla v tabulkách: Atkinson Hyperlegible Mono (`.num`, `.mono`).
- Sekční nadpisy v duchu mockupu: patkové **Fraunces** 600 (`.h-serif`), volitelně.
- Ručně psaný doplněk **Caveat** (`.handnote`) jen jako dekor: `aria-hidden="true"`, nejvýš 1× na stránku.

## Prvky (třídy ve style.css)
- **Tlačítka** `.btn` + `.btn-primary` (tmavě olivové), `.btn-secondary` (šalvějová výplň `--brand-200`),
  `.btn-ghost` (obrys), `.btn-soft`, `.btn-quiet` (textové), `.btn-inverse` (na tmavé ploše), velikosti `.btn-sm`
  `.btn-lg`, `.btn-block`. Dotyk ≥ 44 px.
- **Pole** `input`, `select`, `textarea`, `.field`, `.hint`, `.check`, `.input-unit`; vyhledávání
  `.search-bar` (ikona lupy + pole + tlačítko filtru `.search-filter`), starší `.search-field` funguje dál.
- **Čipy** `.chip` (pill; zapnutý `aria-pressed="true"` = světle šalvějová výplň a šalvějový obrys),
  `.chip-row` (vodorovně posuvná řada), `.seg` (segmentový filtr Vše / Česko / Bavorsko, zapnutý = tmavý),
  **kategorie** `.cat-chips` + `.cat-chip` (ikona nad textem, jako v mockupu).
- **Karty** `.card` (bílá, 20 px, stín), `.card-flat` (bez stínu, s linkou), `.panel` (výplň `--brand-100`),
  **karta místa** `.place-tile` (fotka 4:3 `.place-tile-media`, kulatá ikona přístupnosti `.place-tile-access`,
  srdíčko `.place-tile-save`, text `.place-tile-body`), starší řádková `.place-card` funguje dál.
- **Seznam údajů přístupnosti** `.detail-list` (ikona + text + hodnota vpravo: Ano / Ne / cm).
- **Záložky** `.tabs` (`role="tablist"`, aktivní `aria-selected="true"` podtržený).
- **Ceník** `.price-grid` + `.price-card` (světlá), `.price-card.is-sage` (šalvějová), `.price-card.is-dark`
  (tmavá zvýrazněná) se štítkem `.price-flag` „Doporučujeme“.
- **Štítky** `.badge` + `-ok` `-part` `-no` `-unk` `-verified` `-community` `-business` `-soon`;
  **úroveň členství** `.tier-tag.tier-free|plus|premium` (Free / Explorer / Traveller).
- **Stav** `.status.ok|part|no|unk` (tvar + barva + text), **kóta** `.dim`, **měřidlo** `.tape-meter`.
- **Číslované kroky** `.steps` + `.step-num`; **statistika** `.stat` (`.n` číslo, `.l` popis).
- **Záhlaví stránky** `.page-head` (`.crumbs` drobečková navigace, H1, `.lede` krátký úvod, volitelně
  `.page-head-actions`); `.page-hero` je starší alias.
- **Prázdný stav** `.empty-state` (ikona, nadpis, věta, akce).
- **Panely** `.drawer`, `.sheet`, `.toast`, `.callout` (`.callout.warn`), tabulky `.table-wrap` + `table.data`.
- **Dekor**: vlnitý výřez fotky `.wave-photo` (maska SVG; `.wave-photo-left`), čárkovaná cesta ke špendlíku
  `.route-deco` (`aria-hidden`), `.handnote`.
- **Sekce a mřížky** `.wrap`, `.section`, `.section-tight`, `.section-alt` (`--brand-100`), `.section-head`,
  `.grid .grid-2|3|4`, `.stack`, `.row`, `.kicker` (malý prostrkaný štítek).

## Styly stránek a jejich třídy
Kromě `style.css` má každá stránka svůj soubor; nové stránky přidávejte stejně (styl.css + jeden vlastní soubor).
- **`filters.css`** (mapa.html, ubytovani.html, komponenty z `assets/js/filters.js`): vyhledávání s tlačítkem
  Filtry a počtem zapnutých filtrů (`.kf-count`), řada kategorií s ikonou nad textem (`.kf-cats`, `.kf-cat`, šipky
  `.kf-scroll`), rychlé čipy přístupnosti, aktivní filtry jako odebíratelné čipy, panel Filtry (na PC boční, na
  mobilu spodní sheet, `html.kf-lock` zamkne posun stránky) a karta místa ve výsledcích. Počty u filtrů se vždy
  počítají ze skutečně načtených dat.
- **Dashboard podniku** (`podnik.css`): `.pd-dash` (boční menu 260 px + obsah, pod 900 px jeden sloupec),
  `.pd-ring` (kruhový ukazatel úplnosti profilu v SVG, číslo uprostřed). Čísla jsou jen z dat vybraného místa
  a z tohoto prohlížeče, nic vymyšleného.
- **`.pf-*`**: předpona „profil“ se používá na třech místech: `profil.css` / `pages-b.css` = Můj profil
  (`.pf-layout`, `.pf-needs`, `.pf-list`, `.pf-toc`, `.pf-form`), `pages-a.css` = karty členství (`.pf-claim-row`,
  `.pf-try`, `.pf-proto`), `pages-e.css` = Pro podniky (`.pf-cards`, `.pf-ic`, `.pf-err`). Třídy se nesdílejí
  mezi stránkami, stačí je hledat v souboru dané stránky.
- **`table.data.table-cards`** (`pages-e.css`): tabulka se na mobilu (≤ 640 px) změní na karty, jeden řádek =
  jedna karta, hlavička se skryje a popisky nese `data-label` u buňky. Použité v Pro podniky.
- **`.st-quickbar`** (`pages-e.css`, stezky.html): rychlá lišta nad seznamem tras (hledání + čipy), na mobilu pod
  sebou.
- **Štítky zdroje** (`KP.sourceBadge`, `KP.srcLevel`): „Ověřeno“ (`-verified`) jen u dat naměřených proškoleným
  mapovačem (Mapy bez bariér), ostatní otevřená data měst, krajů a dopravců mají štítek „Otevřená data“,
  OpenStreetMap „OpenStreetMap“, provozovatel „Provozovatel“.

## Ikony
Sada SVG v `assets/icons/` (tah 1,75, 24 × 24, `currentColor`), sprite `assets/icons/sprite.svg`.
V JS vždy `KP.icon(název)`, v HTML `<span data-icon="název"></span>`. Staré názvy zůstávají, nové jsou aliasy
(např. `bed` = `accommodation`, `food` = `restaurant`, `wc` = `toilet`, `museum` = `attraction`,
`heart` = `saved`, `wheel` = `wheelchair`, `sliders` = `filters`). Dokud sprite neexistuje, kreslí se vložené ikony
z core.js.

## Navigace
- **PC (≥ 900 px)**: logo vlevo (`assets/brand/logo.svg`, výška 32 px). Mapa · Plánovat (rozbalí: Jednodenní výlet,
  Vícedenní dovolená, Moje itineráře) · Průvodci · Ubytování · Akce · Pro podniky · Více (Komunita, Stezky a trasy,
  Kraje, Jak měříme, Zdroje, O projektu, Přidat místo, Členství). Vpravo jazyk, úroveň, Moje potřeby, Uložené,
  Profil. Aktivní položka = výplň `--brand-200` (pill).
- **Mobil (< 900 px)**: horní lišta logo (28 px) + Hledat + Menu (spodní panel se všemi stránkami a nastavením).
  Spodní lišta Domů · Mapa · Plánovat · Uložené · Profil, aktivní = ikona v pill `--brand-200`.
- **Patička**: logo, claim, přepínač jazyka a režimu; 4 sloupce Objevuj · Plánuj · Pro podniky · O projektu;
  licence dat a „prototyp“.

## Mapa
Světlý tlumený podklad (CSS filtr do zelenošeda), špendlíky = kapka #3A4A34 s bílou ikonou kategorie, vybraný
větší s obrysem #7D8F76, clustery zelené kruhy (`.marker-cluster-kp`).

## Přístupnost a responzivita
Šířky 360, 390, 768, 1024, 1440 px bez vodorovného posunu; dotyk ≥ 44 px; klávesnice a viditelný fokus
(`--focus`, 3 px); světlý i tmavý režim (`data-theme` i `prefers-color-scheme`); `prefers-reduced-motion`.
Stav vždy tvar + text, nikdy jen barva. Němčina se nesmí lámat přes okraj (dlouhá slova `overflow-wrap`).
