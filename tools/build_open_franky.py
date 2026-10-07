"""Otevřená data o přístupnosti – Franky a Horní Falc (Bavorsko) -> data/by/open_franky.json.

Prověřeno 2026-10-07 (katalogy open.bydata.de, GovData, portály měst). Prokazatelně otevřenou licenci
a údaje o přístupnosti konkrétních míst má jen tato sada:

  Würzburg – „Nette Toiletten im Stadtgebiet Würzburg“ (dataset barrierefreie-toiletten-im-stadtgebiet-wuerzburg)
    portál:  https://opendata.wuerzburg.de/explore/dataset/barrierefreie-toiletten-im-stadtgebiet-wuerzburg/
    licence: dl-de/by-2-0 (metadata ODS „license“ + katalog open.bydata.de, distribuce „Datenlizenz
             Deutschland Namensnennung 2.0“), vydavatel Stadt Würzburg, poslední změna 2024-06-14
    surová data: data/raw/by_open/franky/wue_toiletten.json (export JSON)

Bere se jen typ „Barrierefreie WC-Anlage“. „Nette Toilette“ (WC v podnicích pro veřejnost) a „Weitere Toilette“
údaj o bezbariérovosti nenesou. Řádky v x jsou jen hodnoty z popisu zdroje převedené do češtiny;
nic se nedopočítává. Souřadnice jsou ze zdroje (Stadt Würzburg); párování s OSM dělá integrátor.

Spuštění: python tools/build_open_franky.py
"""
import json
import math
import re
import unicodedata
import urllib.parse
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "by_open" / "franky"
OUT = ROOT / "data" / "by" / "open_franky.json"

WUE_DS = "barrierefreie-toiletten-im-stadtgebiet-wuerzburg"
WUE_URL = f"https://opendata.wuerzburg.de/explore/dataset/{WUE_DS}/"
WUE_DATE = "2024-06-14"
WUE_LIC = "dl-de/by-2-0"
WUE_ATTR = "Stadt Würzburg, opendata.wuerzburg.de (Datenlizenz Deutschland – Namensnennung – Version 2.0)"

NUM = r"(\d+(?:,\d+)?)"


def num(s):
    return s.replace(".", ",")


def last(pattern, text):
    m = list(re.finditer(pattern, text, flags=re.I))
    return m[-1] if m else None


def dims(m):
    return f"{m.group(1)} × {m.group(2)} cm"


def wue_rows(desc):
    t = re.sub(r"\s+", " ", desc or "").strip()
    rows = []

    def add(label, val):
        if val not in (None, ""):
            rows.append([label, val])

    # Euro-klíč
    no_key = re.search(r"ohne Euro|Kein Euro-WC-Schl", t, re.I)
    need_key = re.search(r"(?<!Kein )Euro-WC-Schl\w* notwendig|nur mit Euro", t, re.I)
    if no_key and need_key:
        add("Euroklíč (Euro-WC-Schlüssel)", "podle vstupu/podlaží: část bez klíče, část jen s klíčem")
    elif need_key:
        add("Euroklíč (Euro-WC-Schlüssel)", "nutný")
    elif no_key:
        add("Euroklíč (Euro-WC-Schlüssel)", "není potřeba")
    if re.search(r"Barrierefreiheit wurde nicht überprüft", t):
        add("Ověření", "bezbariérovost město neověřilo, údaj provozovatele")
    if re.search(r"Toiletten-Geld", t):
        add("Poplatek", "dobrovolný příspěvek")
    rest = re.sub(r"Barrierefreiheit wurde nicht überprüft \(Angaben laut Betreiber\)!|(freiwilliges )?Toiletten-Geld( \(Sammelteller\))?|"
                  r"(Zugang )?(auch )?(ohne|Ohne|Kein) Euro-(WC-)?Schlüssel( notwendig| möglich| zugänglich)?|Euro-WC-Schlüssel notwendig", " ", t)
    rest = re.sub(r"\s+", " ", rest).strip(" .;")
    if "Uhr" in rest and len(rest.split()) <= 15:
        add("Otevírací doba (údaj zdroje, německy)", rest)
    if re.search(r"Toilette für alle", t):
        extra = [x for x, p in (("stojací zvedák", "Standlifter"), ("polohovací lehátko", "Pflegeliege")) if p in t]
        add("Toaleta pro všechny (Toilette für alle)", "ano" + (": " + ", ".join(extra) if extra else ""))
    m = re.search(r"im (\d+)\. OG", t)
    if m:
        add("Umístění", f"{m.group(1)}. patro" + (", přístup výtahem" if "Aufzug" in t else ""))
    # rampy u vstupu
    slopes = re.findall(r"Steigung: ?" + NUM + r" ?%", t)
    if slopes:
        add("Rampa u vstupu – sklon (údaj zdroje)", "; ".join(num(s) + " %" for s in slopes))
    lens = re.findall(r"Gesamtlänge der Rampe: ?" + NUM + r" ?m|Gesamtlänge: ?" + NUM + r" ?m Breite: ?\d+ ?cm Steigung", t)
    lens = [a or b for a, b in lens]
    if lens and slopes:
        add("Rampa – celková délka", "; ".join(num(s) + " m" for s in lens))
    widths = re.findall(r"Breite: ?(\d+) ?cm Steigung", t)
    if widths:
        add("Rampa – šířka", "; ".join(w + " cm" for w in widths))
    # výtah
    bw, bd = last(r"Breite der Aufzugskabine: ?" + NUM + " ?cm", t), last(r"Tiefe der Aufzugskabine: ?" + NUM + " ?cm", t)
    if bw and bd:
        add("Výtah: kabina (š × hl)", f"{bw.group(1)} × {bd.group(1)} cm")
    m = last(r"Du\w*gangsbreite der Aufzugstüre: ?" + NUM + " ?cm", t)
    if m:
        add("Výtah: dveře", m.group(1) + " cm")
    # dveře do WC = poslední uvedené dveře v popisu (vstup -> chodba -> WC)
    doors = list(re.finditer(r"Durchgangsbreite der Türe: ?" + NUM + " ?cm", t))
    if doors:
        add("Šířka dveří do WC", doors[-1].group(1) + " cm")
        tail = t[doors[-1].start():]
    else:
        tail = t
    m = re.search(r"Höhe der Türschwelle: ?" + NUM + " ?cm", tail)
    if m:
        add("Práh dveří WC", m.group(1) + " cm")
    m = re.search(r"Platz vor der Türe: ?" + NUM + r"(?: ?cm)? ?x ?" + NUM + " ?cm", tail)
    if m:
        add("Volná plocha před dveřmi", dims(m))
    m = re.search(r"Platz hinter der Türe: ?" + NUM + r"(?: ?cm)? ?x ?" + NUM + " ?cm", tail)
    if m:
        add("Volná plocha za dveřmi", dims(m))
    m = re.search(r"Höhe des Türgriffs: ?" + NUM + " ?cm", tail)
    if m:
        add("Výška kliky dveří WC", m.group(1) + " cm")
    m = re.search(r"Kra\w*aufwand für Öffnung der Türe: ?" + NUM + " ?Kilopond", tail)
    if m:
        add("Síla k otevření dveří", m.group(1) + " kp")
    m = re.search(r"Öffnungsrichtung:? ?(nach außen|nach innen|Schiebetüre)", tail)
    if m:
        add("Otevírání dveří", {"nach außen": "ven", "nach innen": "dovnitř", "Schiebetüre": "posuvné dveře"}[m.group(1)])
    m = re.search(r"Gesamtabmessungen? ?(?:\(Breite x Tiefe\))?: ?" + NUM + r"(?: ?cm)? ?x ?" + NUM + " ?cm", tail)
    if m:
        add("Místnost WC (š × hl)", dims(m))
    m = last(r"Bewegungsfläche: ?" + NUM + r"(?: ?cm)? ?x ?" + NUM + r"(?: ?cm)?", tail)
    if m:
        add("Manipulační plocha", dims(m))
    m = re.search(r"Platz links vom WC: ?" + NUM + " ?cm", tail)
    if m:
        add("Volný prostor vlevo od mísy", m.group(1) + " cm")
    m = re.search(r"Platz rechts v\w+ (?:vom |dem )?WC: ?" + NUM + " ?cm", tail)
    if m:
        add("Volný prostor vpravo od mísy", m.group(1) + " cm")
    m = re.search(r"Platz vor dem WC(?: \(Breite x Tiefe\))?: ?" + NUM + r"(?: ?cm)? ?x ?" + NUM + " ?cm", tail)
    if m:
        add("Volná plocha před mísou", dims(m))
    m = re.search(r"(Halte)?[Gg]riffe?:? ?(links und rechts|links|rechts)", tail)
    if m:
        add("Madla u mísy", {"links und rechts": "vlevo i vpravo", "links": "vlevo", "rechts": "vpravo"}[m.group(2)])
    elif re.search(r"Haltegriff links Haltegriff rechts", tail):
        add("Madla u mísy", "vlevo i vpravo")
    if re.search(r"keine Umsteigehilfe|Umsteigehilfe:? nein", tail, re.I):
        add("Pomůcka k přesedání", "ne")
    elif re.search(r"Umsteigehilfe vorhanden", tail, re.I):
        add("Pomůcka k přesedání", "ano")
    m = re.search(r"Höhe des Toilettensitzes: ?" + NUM + " ?cm", tail)
    if m:
        add("Výška sedátka mísy", m.group(1) + " cm")
    m = re.search(r"Höhe des Toilettenabzugs: ?" + NUM + " ?cm", tail)
    if m:
        add("Výška splachování", m.group(1) + " cm")
    m = re.search(r"Höhe des Handwaschbeckens: ?" + NUM + " ?cm", tail)
    if m:
        add("Výška umyvadla", m.group(1) + " cm")
    m = re.search(r"Kniefreiheit unter dem Waschbecken: ?" + NUM + " ?cm", tail)
    if m:
        add("Volný prostor pod umyvadlem", m.group(1) + " cm")
    if re.search(r"Spiegel in Sitzhöhe", tail):
        add("Zrcadlo ve výšce vsedě", "ano")
    if re.search(r"Kein Alarmknopf", tail):
        add("Nouzová signalizace", "ne")
    elif re.search(r"Alarm(knopf|knöpfe|schnur|schalter|knopr)", tail):
        add("Nouzová signalizace", "ano")
    if re.search(r"Kein rutschhemmender", tail, re.I):
        add("Protiskluzová podlaha", "ne")
    elif re.search(r"rutschhemmend", tail, re.I):
        add("Protiskluzová podlaha", "ano")
    m = re.search(r"Wickeltisch vorhanden(?: - Höhe " + NUM + " cm)?", t)
    if m:
        add("Přebalovací pult", "ano" + (f", výška {m.group(1)} cm" if m.group(1) else ""))
    pk = [int(x) for x in re.findall(r"(\d+) (?:kombinierte )?Behinderten-?[Pp]arkpl", t)]
    if not pk and re.search(r"(\d+|ein) Behindertenparkplatz", t):
        pk = [1]
    if pk:
        add("Vyhrazená stání pro OZP v okolí", str(sum(pk)))
    return rows


def wue_items():
    data = json.loads((RAW / "wue_toiletten.json").read_text(encoding="utf-8"))
    seen = set()
    for r in data:
        if r["id"] in seen or r.get("toilettype") != "Barrierefreie WC-Anlage":
            continue
        seen.add(r["id"])
        g = r.get("geo_point_2d") or {}
        if g.get("lat") is None:
            continue
        desc = r.get("description") or ""
        rows = wue_rows(desc)
        unverified = "nicht überprüft" in desc
        rid = r["id"].split(".")[-1]
        need_key = any(a == "Euroklíč (Euro-WC-Schlüssel)" and b == "nutný" for a, b in rows)
        p = {
            "i": "wuewc" + rid, "n": re.sub(r"\s+", " ", r["company"]).strip(), "c": "wc", "s": "Veřejné WC",
            "la": round(g["lat"], 6), "lo": round(g["lon"], 6),
            "w": None if unverified else "yes", "t": "yes", "o": "Würzburg", "k": "Dolní Franky", "z": "de",
        }
        dw = next((b for a, b in rows if a == "Šířka dveří do WC"), None)
        if dw:
            p["dw"] = round(float(dw.split()[0].replace(",", ".")))
        pk = next((b for a, b in rows if a == "Vyhrazená stání pro OZP v okolí"), None)
        if pk:
            p["pk"] = int(pk)
        if need_key:
            p["ek"] = "yes"
        if any(a == "Přebalovací pult" for a, _ in rows):
            p["cp"] = "yes"
        p["u"] = WUE_DATE
        p["x"] = [{
            "src": "wuerzburg_wc", "name": p["n"], "label": "Stadt Würzburg – bezbariérová WC (Nette Toiletten)",
            "url": WUE_URL + "table/?q=" + urllib.parse.quote(r["id"]), "date": WUE_DATE, "license": WUE_LIC,
            "attribution": WUE_ATTR, "cat": None if unverified else "Přístupný", "coords": "zdroj (Stadt Würzburg)",
            "rows": rows,
        }]
        yield p


GENERIC = {"wurzburg", "strae", "strasse", "toilette", "toiletten", "ecke", "standort", "haus", "kombiniertes", "damen", "herren"}


def tokens(n):
    n = unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode().lower()
    return {t for t in re.findall(r"[a-z]{4,}", n) if t not in GENERIC}


def dist_m(a, b):
    k = math.pi / 180
    x = (b["lo"] - a["lo"]) * k * math.cos((a["la"] + b["la"]) / 2 * k)
    return math.hypot(x, (b["la"] - a["la"]) * k) * 6371000


def merge_dupes(places):
    """Stejné WC zapsané ve zdroji dvakrát (dva správci záznamů): do 120 m a se společným slovem v názvu.
    Zůstane jedno místo (to s více údaji) a obě položky zdroje v poli x."""
    places.sort(key=lambda p: -len(p["x"][0]["rows"]))
    out = []
    for p in places:
        tgt = next((q for q in out if dist_m(p, q) < 120 and tokens(p["n"]) & tokens(q["n"])), None)
        if tgt is None:
            out.append(p)
            continue
        tgt["x"] += p["x"]
        if p["w"] == "yes":
            tgt["w"] = "yes"
            for x in tgt["x"]:
                x["cat"] = x["cat"] or None
        for k in ("dw", "pk", "ek", "cp"):
            if p.get(k) and not tgt.get(k):
                tgt[k] = p[k]
    out.sort(key=lambda p: p["n"])
    return out


def main():
    places = merge_dupes(list(wue_items()))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(places, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    meas = sum(1 for p in places if len(p["x"][0]["rows"]) >= 5)
    print(f"{len(places)} míst -> {OUT}")
    print("se 5+ řádky měření:", meas, "| neověřeno:", sum(1 for p in places if p["w"] is None),
          "| euroklíč nutný:", sum(1 for p in places if p.get("ek")), "| dw:", sum(1 for p in places if p.get("dw")))
    print(Counter(len(p["x"][0]["rows"]) for p in places))


if __name__ == "__main__":
    main()
