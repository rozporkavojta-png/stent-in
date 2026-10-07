# kudyprojedu.cz – designový systém (verze 3, „městský průvodce“)

Cíl: web s vlastní identitou, který nevypadá jako šablona. Přehledný na PC i telefonu.
Vzory z Refero: **Art In DUMBO** (tištěný průvodce galeriemi – výpisy s tenkými linkami, ostré hrany, jedna signální barva),
**Eindhoven Design District** (modernistický plakát – velké těsně sázené nadpisy, fotky jako čisté obdélníky, tlačítka jako pilulky s černým obrysem),
**IKEA** (žlutá jako plošná značka, černé písmo na žluté). Navigace a mapové vzory z verze 2 zůstávají (Fresha, Tripsy, Airbnb, Chargetrip).

## Co NEdělat (typické znaky „AI webu“)
- žádné zaoblené karty s pastelovým podkladem a ikonkou v kolečku; žádné „Jak to funguje ve 3 krocích“ s ikonami
- žádné měkké stíny, gradienty, zelené/fialové akcenty, emoji
- žádné mřížky stejných dlaždic s ikonou + číslem jen pro efekt
- žádné centrované vše; žádné prázdné fráze

## Principy
1. **Černá, bílá, žlutá.** `--ink` černá na bílé. `--signal` (žlutá #FFD400, jako dopravní značení a svinovací metr) se používá **plošně**: pás v hero, aktivní stav, zvýraznění čísla, štítek. Text na žluté vždy černý. Akční tlačítko = **černá pilulka** (`.btn-primary`), vedlejší = pilulka s černým obrysem (`.btn-ghost`). Stavové barvy (zelená/oranžová/červená) jen pro stav přístupnosti.
2. **Ostré hrany:** karty, fotky, panely, inputy `border-radius: 0` (inputy 2 px). Zaoblení jen u tlačítek a čipů (pilulka 999 px) a u kruhových ikonových tlačítek.
3. **Linky místo krabic:** obsah se dělí tenkou černou linkou (1 px `--rule`), výpisy jsou řádky oddělené linkou (adresář), ne karty. Šedá plocha `--surface-2` jen výjimečně pro velký blok.
4. **Typografie:** nadpisy **Archivo** (700–800, těsná sazba −0.03 až −0.045em, velké velikosti: h1 až 72 px na desktopu); text **Atkinson Hyperlegible Next** (čitelnost pro slabozraké – důvod, proč tu je); čísla a rozměry **Atkinson Hyperlegible Mono**. Malé štítky sekcí: 13 px, verzálky, prostrkané (.kicker).
5. **Fotky jsou obsah:** skutečné fotky míst z Wikimedia Commons (pole `img`, `KP.commonsImg(file, šířka)`) jako čisté obdélníky (4:3 nebo 3:2), vždy s drobným popiskem autora/licence odkazem. Kde fotka není, žádný zástupný obrázek – rozvržení musí fungovat i bez ní.
6. **Rytmus:** sekce 64–120 px, uvnitř 24 px. Mřížka 12 sloupců na desktopu, obsah často asymetrický (nadpis vlevo 4 sloupce, obsah vpravo 8).
7. **Přístupnost:** stav vždy tvar + text, kontrast AA, dotyk ≥ 44 px, viditelný focus (černo-žlutý).

## Navigace
Beze změny proti verzi 2 (desktop: Mapa · Ubytování · Trasy · Kraje · Pro podniky · Více; mobil: spodní lišta Domů · Mapa · Ubytování · Uložené · Více), jen ve stylu v3: bílá hlavička s černou linkou dole, aktivní položka podtržená žlutou čarou 3 px, spodní lišta bílá s černou linkou nahoře, aktivní ikona černá na žlutém kolečku.

## Komponenty (třídy ve style.css)
`.btn-primary` černá pilulka · `.btn-ghost` obrysová pilulka · `.btn-signal` žlutá pilulka · `.btn-soft` šedá pilulka · `.btn-quiet` textový odkaz
`.chip` pilulka s obrysem, zapnutý = černá · `.badge` malý štítek (ostrý, 2 px) · `.kicker` štítek sekce
`.rule-list` + `.rule-row` výpis s linkami · `.card` = blok bez stínu s linkou nahoře · `.panel` šedý blok · `.tile` údaj s černou linkou nahoře a velkým textem
`.signal-band` žlutý pás · `.photo` (obrázek + popisek) · `.stat` (velké číslo + popis) · `.sheet`, `.drawer`, `.toast`
