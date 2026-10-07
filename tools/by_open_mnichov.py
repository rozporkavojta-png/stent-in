"""D2a – otevřená data o přístupnosti: Mnichov, Horní Bavorsko, Švábsko → data/by/open_mnichov.json

Vstupy (data/raw/by_open/mnichov/, stáhne tento skript nebo ručně curl, viz data/by/zdroje_mnichov.json):
  muc_wc.geojson        WC-Standorte der LH München (dl-de/by-2-0)
  muc_bpp.geojson       Behindertenparkplätze München (dl-de/by-2-0)
  muc_pr.csv            P+R Anlagen München (dl-de/by-2-0)
  muc_wahl_btw25.csv    Wahlräume Bundestagswahl 2025 München (dl-de/by-2-0)
  muc_wahl_btw25.zip    Wahlräume BTW 2025 – bodová vrstva (Shape, souřadnice volebních místností; dl-de/by-2-0)
  haar_poi.dat          Stadt Haar – POI-Verzeichnis (CC BY 4.0), jen Behindertenparkplatz
  bc_*.jsonld           BayernCloud Tourismus (objekty s licencí CC0 / CC BY; CC BY-SA se vynechává)

Výstup: pole míst ve schématu data/places.json + "z":"de" + pole x s údaji ze zdroje.
Souřadnice: ze zdrojové sady (oficiální body města / BayernCloud), u volebních místností z bodové vrstvy téže sady.
Haar (POI-Verzeichnis uvádí jen ulici): Nominatim (countrycodes=de, 1 dotaz/s, cache nominatim_cache.json).
Párování s OSM dělá integrátor. Nic se nedopočítává.

Spuštění: python tools/by_open_mnichov.py
"""
import csv
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "by_open" / "mnichov"
OUT = ROOT / "data" / "by" / "open_mnichov.json"
UA = "kudyprojedu-student-project/0.1"
TODAY = time.strftime("%Y-%m-%d")

K_CZ = {"Oberbayern": "Horní Bavorsko", "Niederbayern": "Dolní Bavorsko", "Oberpfalz": "Horní Falc", "Oberfranken": "Horní Franky",
        "Mittelfranken": "Střední Franky", "Unterfranken": "Dolní Franky", "Schwaben": "Švábsko"}

DLDE = "dl-de/by-2-0 (Datenlizenz Deutschland – Namensnennung 2.0)"
URL_WC = "https://opendata.muenchen.de/dataset/wc_finder"
URL_BPP = "https://opendata.muenchen.de/dataset/behindertenparkplaetze"
URL_PR = "https://opendata.muenchen.de/dataset/p-r-anlagen-muenchen"
URL_BTW = "https://opendata.muenchen.de/dataset/bundestagswahl-2025-wahlraeume-in-muenchen"
URL_BC = "https://open.bydata.de/datasets/https-data-bayerncloud-digital-api-v4-endpoints-list_attractions"


# ---------------------------------------------------------------- pomocné

def de_date(s):
    """'10.03.2025 / 04.02.2026' → poslední datum v ISO."""
    m = re.findall(r"(\d{2})\.(\d{2})\.(\d{4})", s or "")
    return f"{m[-1][2]}-{m[-1][1]}-{m[-1][0]}" if m else None


def val(x):
    if x is None:
        return None
    x = str(x).strip()
    return x or None


def yesno(x):
    return {"1": "ano", "0": "ne", "true": "ano", "false": "ne"}.get(str(x).strip().lower()) if x is not None else None


def cmv(x):
    """Číslo ze zdroje (cm) → 'N cm'; text (např. 'mind. 90') ponechá v originále s jednotkou."""
    x = val(x)
    if x is None or x == "0":
        return None
    return x + " cm" if re.match(r"^\d+([.,]\d+)?$", x) else x


def strip_html(s, limit=600):
    if not s:
        return None
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", html.unescape(s)).strip()
    if len(s) > limit:
        s = s[:limit].rsplit(" ", 1)[0] + " …"
    return s or None


_last = [0.0]


def nominatim(q):
    cache_p = RAW / "nominatim_cache.json"
    cache = json.loads(cache_p.read_text(encoding="utf-8")) if cache_p.exists() else {}
    if q in cache:
        return cache[q]
    wait = 1.1 - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": q, "format": "jsonv2", "limit": 1, "countrycodes": "de"})
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
            res = json.loads(r.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        print("nominatim chyba", q, e)
        res = []
    _last[0] = time.time()
    hit = [float(res[0]["lat"]), float(res[0]["lon"]), res[0].get("osm_type", "")[:1] + str(res[0].get("osm_id"))] if res else None
    cache[q] = hit
    cache_p.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    return hit


class Bezirke:
    """Vládní obvody Bavorska z OSM (data/raw/by_bezirke.json) → český název."""

    def __init__(self):
        from shapely.geometry import LineString, Point  # noqa: F401
        from shapely.ops import polygonize, unary_union
        self.Point = Point
        self.polys = []
        p = ROOT / "data" / "raw" / "by_bezirke.json"
        for rel in json.loads(p.read_text(encoding="utf-8"))["elements"]:
            name = rel.get("tags", {}).get("name")
            if name not in K_CZ:
                continue
            lines = [LineString([(q["lon"], q["lat"]) for q in m["geometry"]]) for m in rel["members"]
                     if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry")]
            poly = unary_union(list(polygonize(unary_union(lines))))
            self.polys.append((K_CZ[name], poly))

    def __call__(self, la, lo):
        pt = self.Point(lo, la)
        for name, poly in self.polys:
            if poly.contains(pt):
                return name
        return ""


def place(i, n, c, s, la, lo, o, k, w=None, t=None, **opt):
    rec = {"i": i, "n": n, "c": c, "s": s, "la": round(float(la), 6), "lo": round(float(lo), 6), "w": w, "t": t, "o": o, "k": k}
    rec.update({a: b for a, b in opt.items() if b not in (None, "", [])})
    rec["z"] = "de"
    return rec


def xrec(src, name, label, url, date, lic, attribution, cat, rows):
    return {"src": src, "name": name, "label": label, "url": url, "date": date, "license": lic, "attribution": attribution,
            "cat": cat, "rows": [r for r in rows if r[1] not in (None, "")]}


CAT3 = {"yes": "Přístupný", "limited": "Částečně přístupný", "no": "Nepřístupný"}

# ---------------------------------------------------------------- Mnichov – WC

WC_CAT = {"männlich": "muži", "weiblich": "ženy", "barrierefrei": "bezbariérové", "divers/unisex": "unisex",
          "divers/unisex und barrierefrei": "unisex a bezbariérové", "weiblich und barrierefrei": "ženy a bezbariérové",
          "männlich und barrierefrei": "muži a bezbariérové"}
ZUSTAND = {"voll funktionsfähig": "plně funkční", "teilweise Beeinträchtigung": "částečně omezené", "defekt oder nicht zugänglich": "mimo provoz nebo nepřístupné"}


def wc_room_rows(p, pre):
    R = []

    def add(label, v):
        if v not in (None, ""):
            R.append([pre + label, v])
    add("norma DIN 18040-1 splněna (údaj zdroje)", yesno(p.get("din_18040_1")))
    add("„Toilette für alle“ (s lehátkem a zvedákem)", "ano" if str(p.get("toilette_fuer_alle")) == "1" else None)
    add("vstupní dveře – šířka", cmv(p.get("eingangstuer_breite")))
    add("vstupní dveře – otáčecí prostor", cmv(p.get("eingangstuer_wendekreis")))
    add("vstupní dveře – typ (originál)", val(p.get("eingangstuer_typ")))
    add("vstupní dveře – Euroklíč", yesno(p.get("eingangstuer_euro_schluessel")))
    add("vstupní dveře – snadno ovladatelné", yesno(p.get("eingangstuer_leichte_fuehrung")))
    add("rampa", {"fest": "pevná", "mobil": "mobilní"}.get(val(p.get("rampe")) or "", val(p.get("rampe"))))
    add("sklon rampy (údaj zdroje)", val(p.get("rampe_steigung")))
    if str(p.get("treppe_vorhanden")) == "1":
        n, h = val(p.get("treppe_stufenanzahl")), val(p.get("treppe_stufenhoehe"))
        add("schody", (f"{n} schodů" if n and n != "0" else "ano") + (f", výška {h} cm" if h and h != "0" else ""))
    elif str(p.get("treppe_vorhanden")) == "0":
        add("schody", "ne")
    add("schodišťová plošina", yesno(p.get("rollstuhllift")))
    if str(p.get("aufzug_vorhanden")) == "1":
        b, t_, d = val(p.get("aufzug_breite")), val(p.get("aufzug_tiefe")), val(p.get("aufzug_tuerbreite"))
        add("výtah", "ano")
        if b and t_:
            add("výtah – kabina (š × hl)", f"{b} × {t_} cm")
        add("výtah – dveře", cmv(d))
    elif str(p.get("aufzug_vorhanden")) == "0":
        add("výtah", "ne")
    add("šířka chodby", cmv(p.get("gebaeudeinneres_gangbreite")))
    add("dveře kabiny WC – šířka", cmv(p.get("wctuer_breite")))
    add("dveře kabiny WC – otáčecí prostor", cmv(p.get("wctuer_wendekreis")))
    add("dveře kabiny WC – typ (originál)", val(p.get("wctuer_typ")))
    add("dveře kabiny WC – Euroklíč", yesno(p.get("wctuer_euro_schluessel")))
    add("výška sedátka mísy", cmv(p.get("wc_sitzhoehe")))
    add("volný prostor před mísou", cmv(p.get("wc_platz_davor")))
    add("volný prostor vpravo od mísy", cmv(p.get("wc_platz_rechts")))
    add("volný prostor vlevo od mísy", cmv(p.get("wc_platz_links")))
    sides = [s for s, k in (("vpravo", "wc_buegel_rechts"), ("vlevo", "wc_buegel_links")) if str(p.get(k)) == "1"]
    if sides or p.get("wc_buegel_rechts") is not None:
        add("sklopná madla", ", ".join(sides) if sides else "ne")
    add("madla – výška", cmv(p.get("wc_buegelhoehe")))
    add("madla – vzdálenost", cmv(p.get("wc_buegel_distanz")))
    add("umyvadlo – horní hrana", cmv(p.get("wc_waschbecken_oberkante")))
    add("umyvadlo – podjezdná výška", cmv(p.get("wc_waschbecken_hoehe_unterfahrbar")))
    add("umyvadlo – podjezdná hloubka", cmv(p.get("wc_waschbecken_tiefe_unterfahrbar")))
    add("zrcadlo – výška", cmv(p.get("wc_spiegelhoehe")))
    add("nouzové volání", val(p.get("wc_position_notruf")))
    add("nouzové volání – výška", cmv(p.get("wc_hoehe_notruf")))
    add("stropní zvedák", "ano" if str(p.get("wc_deckenlifter")) == "1" else None)
    add("lehátko", "ano" if str(p.get("wc_liege")) == "1" else None)
    add("vhodné pro vodicího psa", yesno(p.get("eignung_blindenhunde")))
    add("omezení (originál)", val(p.get("einschraenkungen")))
    add("poznámka (originál)", val(p.get("wc_bermerkung")) or val(p.get("wctuer_bemerkung")))
    return R


def muc_wc(bez):
    fs = json.loads((RAW / "muc_wc.geojson").read_text(encoding="utf-8"))["features"]
    groups = defaultdict(list)
    for f in fs:
        lo, la = f["geometry"]["coordinates"][:2]
        groups[(round(la, 4), round(lo, 4), (f["properties"].get("name") or "").strip().lower())].append(f)
    out = []
    for key, members in groups.items():
        props = [m["properties"] for m in members]
        p0 = props[0]
        lo, la = members[0]["geometry"]["coordinates"][:2]
        bf = [p for p in props if "barrierefrei" in (p.get("kategorie") or "")]
        t = "yes" if bf else "no"
        rows = [["Kabiny podle zdroje", ", ".join(sorted({WC_CAT.get(p.get("kategorie"), p.get("kategorie") or "?") for p in props}))]]
        rows.append(["Stav", ", ".join(sorted({ZUSTAND.get(p.get("zustand"), p.get("zustand")) for p in props if p.get("zustand")}))])
        oh = sorted({val(p.get("oeffnungszeiten")) for p in props if val(p.get("oeffnungszeiten"))})
        if oh:
            rows.append(["Otevírací doba (originál)", " | ".join(oh)])
        prices = sorted({str(p.get("preis")) for p in props if p.get("preis") is not None})
        if prices:
            rows.append(["Poplatek", ", ".join("zdarma" if x in ("0", "0.0") else x.replace(".", ",") + " €" for x in prices)])
        if any(str(p.get("wickeln")) == "1" for p in props):
            rows.append(["Přebalovací pult", "ano"])
        et = sorted({val(p.get("etage")) for p in props if val(p.get("etage"))})
        if et:
            rows.append(["Podlaží (originál)", ", ".join(et)])
        for j, p in enumerate(bf, 1):
            pre = f"Bezbariérová kabina{(' ' + str(j)) if len(bf) > 1 else ''}: "
            rows += wc_room_rows(p, pre)
        dates = sorted(filter(None, (de_date(p.get("erzeugt_bearbeitet")) for p in props)))
        date = dates[-1] if dates else None
        name = re.sub(r"\s+", " ", p0.get("name") or "Öffentliche Toilette").strip()
        addr = " ".join(x for x in [val(p0.get("strasse")), val(p0.get("hausnr"))] if x) or None
        fid = min(int(m["id"].split(".")[-1]) for m in members)
        ec = "yes" if any(str(p.get("eingangstuer_euro_schluessel")) == "1" or str(p.get("wctuer_euro_schluessel")) == "1" for p in props) else None
        o = val(p0.get("stadt")) or "München"
        rec = place(f"mucwc{fid}", name, "wc", "Veřejné WC", la, lo, o, bez(la, lo) or "Horní Bavorsko", w=("yes" if bf else None), t=t,
                    a=addr, web=val(p0.get("website")), ph=val(p0.get("telefon")), cd=date, u=date, op=val(p0.get("zustaendiges_referat")),
                    fee=("no" if prices and all(x in ("0", "0.0") for x in prices) else ("yes" if prices else None)), ek=ec,
                    cp=("yes" if any(str(p.get("wickeln")) == "1" for p in props) else None))
        rec["x"] = [xrec("muc_wc", name, "Landeshauptstadt München – WC-Standorte (WC-Finder)", URL_WC, date, DLDE,
                         "Landeshauptstadt München – GeodatenService", CAT3.get(rec["w"]) if rec["w"] else None, rows)]
        out.append(rec)
    return out


# ---------------------------------------------------------------- Mnichov – vyhrazená stání

BPP_KAT = {"Allgemeiner Bedarf": "obecná potřeba", "Medizin": "zdravotnictví", "Soziales": "sociální služby", "Amt": "úřad",
           "Haltestelle": "zastávka", "Kultur": "kultura", "Bildung": "vzdělávání"}
BPP_STATUS = {"in Bestand": "v provozu", "Baustelle": "dočasně přemístěno (stavba)"}


def muc_bpp(bez):
    fs = json.loads((RAW / "muc_bpp.geojson").read_text(encoding="utf-8"))["features"]
    out = []
    for f in fs:
        p = f["properties"]
        lo, la = f["geometry"]["coordinates"][:2]
        date = de_date(p.get("erfasst_bearbeitet"))
        rows = [
            ["Počet stání", val(p.get("anzahl_stellplaetze"))],
            ["Účel (kategorie zdroje)", BPP_KAT.get(p.get("kategorie"), val(p.get("kategorie")))],
            ["U objektu (originál)", val(p.get("detail")) if p.get("detail") != p.get("kategorie") else None],
            ["Stav", BPP_STATUS.get(p.get("status"), val(p.get("status")))],
            ["Vyhrazeno nepřetržitě", {"Ja": "ano", "Nein": "ne (jen v uvedené době)"}.get(p.get("dauerhaft_verfuegbar"))],
            ["Časové omezení (originál)", val(p.get("zeitliche_einschraenkung"))],
            ["Upozornění (originál)", val(p.get("hinweis"))],
        ]
        if p.get("status") == "Baustelle":
            rows.append(["Stavba", " – ".join(x for x in [val(p.get("baustelle_beginn")), val(p.get("baustelle_ende"))] if x)])
            rows.append(["Původní umístění (originál)", val(p.get("bezeichnung_anordnung"))])
        rows.append(["Městský obvod", val(p.get("stadtbezirk"))])
        n = int(p["anzahl_stellplaetze"]) if str(p.get("anzahl_stellplaetze") or "").isdigit() else None
        rec = place(f"mucbpp{p.get('parkplatz_id')}", "Vyhrazené stání ZTP", "parkovani", "Parkovací místo ZTP", la, lo, "München",
                    bez(la, lo) or "Horní Bavorsko", a=val(p.get("bezeichnung")), pk=n, cd=date, u=date)
        rec["x"] = [xrec("muc_bpp", rec["n"], "Landeshauptstadt München – Behindertenparkplätze", URL_BPP, date, DLDE,
                         "Landeshauptstadt München – opendata.muenchen.de", None, rows)]
        out.append(rec)
    return out


# ---------------------------------------------------------------- Mnichov – P+R

def dms(s):
    m = re.match(r"\s*(\d+)°(\d+)'([\d.]+)\"?\"?([NSEW])", s or "")
    if not m:
        return None
    v = int(m.group(1)) + int(m.group(2)) / 60 + float(m.group(3)) / 3600
    return -v if m.group(4) in "SW" else v


def muc_pr(bez):
    rows_in = list(csv.DictReader(open(RAW / "muc_pr.csv", encoding="utf-8-sig"), delimiter=";"))
    out = []
    for j, r in enumerate(rows_in, 1):
        beh = (r.get("stellplaetze_beh.") or "").strip()
        if not beh.isdigit() or int(beh) == 0:
            continue
        la, lo = dms(r.get("latitude")), dms(r.get("longitude"))
        if la is None or lo is None:
            continue
        rows = [["Vyhrazená stání pro osoby s postižením", beh], ["Stání celkem", val(r.get("stellplaetze_gesamt"))],
                ["Typ (originál)", val(r.get("bauform"))], ["Vjezdová výška (originál)", val(r.get("einfahrtshoehe"))],
                ["Napojení na MHD", val(r.get("oepnv-anbindung"))], ["Stav údajů", "06/2025 (podle názvu souboru)"]]
        name = "P+R " + r["name_anlage"].strip()
        rec = place(f"mucpr{j}", name, "parkovani", "Parkoviště", la, lo, "München", bez(la, lo) or "Horní Bavorsko",
                    a=val(r.get("adresse")), pk=int(beh), web="https://www.parkundride.de", op="P+R Park & Ride GmbH München", fee="yes")
        rec["x"] = [xrec("muc_pr", name, "P+R Park & Ride GmbH München – P+R Anlagen", URL_PR, "2025-06-26", DLDE,
                         "P+R Park & Ride GmbH München, opendata.muenchen.de", None, rows)]
        out.append(rec)
    return out


# ---------------------------------------------------------------- Mnichov – volební místnosti

GROUPS = [("ROLLSTUHLFAHRENDE", "vozíčkáři"), ("GEHBEHINDERTE", "lidé s omezenou chůzí"), ("SEHBEEINTRÄCHTIGTE", "slabozrací"),
          ("BLINDE", "nevidomí"), ("KOGNITIV_BEEINTRAECHTIGTE", "lidé s kognitivním postižením")]


def read_point_shp(zpath, stem):
    """Minimální čtečka bodového shapefile (Point/PointZ) + DBF ze zip → [(x, y, {pole: hodnota})]."""
    import struct
    import zipfile
    z = zipfile.ZipFile(zpath)
    shp, dbf = z.read(stem + ".shp"), z.read(stem + ".dbf")
    n, hl, rl = struct.unpack("<IHH", dbf[4:12])
    fields, o = [], 32
    while dbf[o] != 0x0D:
        fields.append((dbf[o:o + 11].split(b"\0")[0].decode(), dbf[o + 16]))
        o += 32
    recs = []
    for i in range(n):
        r, q, row = dbf[hl + i * rl:hl + (i + 1) * rl], 1, {}
        for name, ln in fields:
            row[name] = r[q:q + ln].decode("utf-8", "replace").strip()
            q += ln
        recs.append(row)
    pts, o = [], 100
    while o < len(shp):
        clen = struct.unpack(">i", shp[o + 4:o + 8])[0] * 2
        st, x, y = struct.unpack("<idd", shp[o + 8:o + 28])
        pts.append((x, y) if st in (1, 11, 21) else None)
        o += 8 + clen
    return [(p[0], p[1], r) for p, r in zip(pts, recs) if p]


def muc_wahl(bez):
    """Volební místnosti BTW 2025 – souřadnice z bodové vrstvy téže sady (Shape, ETRS89/UTM 32N → WGS84)."""
    from pyproj import Transformer
    tr = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)
    coords = {}
    for x, y, r in read_point_shp(RAW / "muc_wahl_btw25.zip", "wahlraeume_25_point"):
        lo, la = tr.transform(x, y)
        coords[r["WBZ"].lstrip("0")] = (la, lo)
    btw = list(csv.DictReader(open(RAW / "muc_wahl_btw25.csv", encoding="utf-8-sig")))
    seen = {}
    geo = Counter()
    for r in btw:
        r = {k.strip(): (v or "").strip() for k, v in r.items()}
        c = coords.get(r["WBZ"].lstrip("0"))
        if not c:
            geo["bez_souradnic"] += 1
            continue
        geo["shape"] += 1
        k2 = (r["WAHLLOKAL_NAME"].lower(), r["STRANAM"].lower(), r["NR"].lower())
        bf = r.get("BARRIEREFREIHEIT", "")
        w = {"barrierefrei": "yes", "teilweise barrierefrei": "limited"}.get(bf)
        flagged = [cz for col, cz in GROUPS if r.get(col) == "1"]
        if k2 in seen:  # více okrsků v jedné budově
            seen[k2]["x"][0]["rows"][-1][1] += ", " + r["WBZ"]
            continue
        rows = [["Bezbariérovost volební místnosti (BTW 2025)", {"barrierefrei": "bezbariérová", "teilweise barrierefrei": "částečně bezbariérová"}.get(bf, bf)]]
        if flagged:
            rows.append(["Skupiny označené ve zdroji (u částečně bezbariérových)", ", ".join(flagged)])
        if r.get("ERLAEUTERUNG"):
            rows.append(["Místnost / upřesnění (originál)", r["ERLAEUTERUNG"]])
        rows.append(["Volební okrsky", r["WBZ"]])
        addr = f"{r['STRANAM']} {r['NR']}"
        rec = place(f"mucwl{r['WBZ']}", r["WAHLLOKAL_NAME"], "urady", "Volební místnost", c[0], c[1], "München", bez(c[0], c[1]) or "Horní Bavorsko",
                    w=w, a=addr, cd="2025-01-09", u="2025-01-09")
        rec["x"] = [xrec("muc_wahl", r["WAHLLOKAL_NAME"], "Landeshauptstadt München – Wahlräume Bundestagswahl 2025", URL_BTW, "2025-01-09", DLDE,
                         "Landeshauptstadt München, Kreisverwaltungsreferat", CAT3.get(w), rows)]
        seen[k2] = rec
    print("volební místnosti – souřadnice:", dict(geo))
    return list(seen.values())


# ---------------------------------------------------------------- Haar – vyhrazená stání (POI-Verzeichnis, CC BY 4.0)

URL_HAAR = "https://open.bydata.de/datasets/poi-haar"
HAAR_Q = {"Behindertenparkplatz S-Bahnhof Gronsdorf": "Bahnhof Gronsdorf, Haar", "Behindertenparkplatz Salmdorf Kirche": "Böcklhofweg, Salmdorf, Haar"}


def haar_bpp(bez):
    """Zdroj uvádí jen ulici bez čísla → souřadnice z Nominatim, přesnost na úroveň ulice / místa."""
    t = (RAW / "haar_poi.dat").read_bytes().decode("utf-8-sig")
    out = []
    for j, r in enumerate(csv.DictReader(t.splitlines(), delimiter=";"), 1):
        if r.get("Art") != "Behindertenparkplatz":
            continue
        q = HAAR_Q.get(r["Name"], f"{r['Straße']}, {r['Ort']}")
        hit = nominatim(q)
        if not hit:
            print("Haar – nenalezeno:", q)
            continue
        la, lo = hit[0], hit[1]
        rows = [["Druh (originál)", r["Art"]], ["Popis (originál)", val(r.get("Beschreibung"))],
                ["Poloha", "zdroj uvádí jen ulici; bod je přibližný (Nominatim: " + q + ")"]]
        rec = place(f"haarbpp{j}", r["Name"], "parkovani", "Parkovací místo ZTP", la, lo, "Haar", bez(la, lo) or "Horní Bavorsko",
                    a=val(r.get("Straße")))
        rec["x"] = [xrec("haar_poi", r["Name"], "Stadt Haar – Verzeichnis der Points of Interest (POI)", URL_HAAR, "2025-03-11",
                         "CC BY 4.0", "Stadt Haar (open.bydata.de, CC BY 4.0)", None, rows)]
        rec["x"][0]["coords"] = "Nominatim (OSM), přibližně – ulice: " + q + (f" [{hit[2]}]" if hit[2] else "")
        out.append(rec)
    return out


# ---------------------------------------------------------------- BayernCloud Tourismus (Horní Bavorsko + Švábsko)

OPEN_LIC = {"https://creativecommons.org/publicdomain/zero/1.0/": "CC0 1.0", "https://creativecommons.org/licenses/by/4.0/": "CC BY 4.0",
            "https://creativecommons.org/licenses/by/2.0/": "CC BY 2.0"}
BC_TYPE = [("Museum", "pamatky", "Muzeum"), ("Castle", "pamatky", "Hrad / zámek"), ("Church", "pamatky", "Kostel"),
           ("Zoo", "pamatky", "Zoo"), ("Park", "priroda", "Park"), ("PublicSwimmingPool", "sport", "Bazén"),
           ("SportsActivityLocation", "sport", "Sportoviště"), ("TouristInformationCenter", "urady", "Turistické informace"),
           ("FoodEstablishment", "restaurace", "Restaurace"), ("Restaurant", "restaurace", "Restaurace"), ("LodgingBusiness", "ubytovani", "Ubytování"),
           ("TouristAttraction", "pamatky", "Turistický cíl"), ("LandmarksOrHistoricalBuildings", "pamatky", "Památka")]
ACC_RX = re.compile(r"barriere|barrierefei|rollstuhl|reisen für alle|behindert|stufenlos|sehbehind|gehörlos|hörbehind|blinde|DIN 18040", re.I)
# klasifikace (skos:prefLabel) → hodnocení pro vozík; obecné „barrierefrei“ se nehodnotí (není jasné, pro koho)
BC_W_YES = re.compile(r"^(ohne barrieren für menschen im\s+rollstuhl|barrierefrei für rollstuhlfahrer|für rollstuhlfahrer geeignet|rollstuhlgerecht|"
                      r"barrierefrei; rollstuhlgerecht.*|behindertengerecht \(lokal und toiletten mit rollstuhl erreichbar\)|barrierefrei nach din 18040)$", re.I)
BC_W_LIM = re.compile(r"^(weitgehend barrierefrei für menschen im rollstuhl|teilweise barrierefrei für rollstuhlfahrer|bedingt rollstuhlgerecht)$", re.I)
BC_W_NO = re.compile(r"^nicht barrierefrei für menschen im rollstuhl$", re.I)
BC_T_YES = re.compile(r"^(barrierefreies wc|rollstuhlgerechtes wc|wc barrierefrei)$", re.I)


def iter_graph(path):
    """Proudově vrací objekty z pole @graph (bez načtení celého JSON do paměti jako stromu)."""
    dec = json.JSONDecoder()
    with open(path, encoding="utf-8") as fh:
        buf = fh.read(1 << 20)
        i = buf.find('"@graph":[')
        while i < 0:
            more = fh.read(1 << 20)
            if not more:
                return
            buf = buf[-20:] + more
            i = buf.find('"@graph":[')
        buf = buf[i + 10:]
        while True:
            buf = buf.lstrip(", \n\r\t")
            if buf.startswith("]"):
                return
            try:
                obj, end = dec.raw_decode(buf)
            except json.JSONDecodeError:
                more = fh.read(1 << 22)
                if not more:
                    return
                buf += more
                continue
            yield obj
            buf = buf[end:]
            if len(buf) < (1 << 16):
                buf += fh.read(1 << 22)


def bc_lic(o):
    """Objekt je převzatelný jen když sdLicense i (pokud je uvedena) cc:license jsou otevřené (CC0 / CC BY)."""
    sd, cc = o.get("sdLicense"), o.get("cc:license")
    if sd not in OPEN_LIC or (cc and cc not in OPEN_LIC):
        return None
    return OPEN_LIC[sd] if not cc or cc == sd else OPEN_LIC[sd] + " / " + OPEN_LIC[cc]


def bayerncloud(bez, files):
    # 1) průchod: pojmy klasifikace a doplňkové texty „Barrierefreiheit“ (CreativeWork) podle @id
    info, concepts = {}, {}
    for f in files:
        for o in iter_graph(f):
            t = str(o.get("@type"))
            if t == "skos:Concept":
                lab = re.sub(r"\s+", " ", str(o.get("skos:prefLabel") or "")).strip()
                if ACC_RX.search(lab) and not lab.startswith("additionaltext"):
                    concepts[o["@id"]] = lab
            elif "CreativeWork" in t and "ImageObject" not in t and ACC_RX.search(o.get("name") or "") and o.get("description"):
                info[o["@id"]] = (o.get("name"), strip_html(o.get("description")), o.get("sdLicense") or o.get("cc:license"))
    print("BayernCloud – pojmy o bezbariérovosti:", len(concepts), "doplňkové texty:", len(info))
    out, stat = [], Counter()
    for f in files:
        for o in iter_graph(f):
            if "Place" not in str(o.get("@type")):
                continue
            geo = o.get("geo") or {}
            if isinstance(geo, list):
                geo = geo[0] if geo else {}
            la, lo = geo.get("latitude"), geo.get("longitude")
            if la is None or lo is None or not o.get("name"):
                continue
            k = bez(float(la), float(lo))
            if k not in ("Horní Bavorsko", "Švábsko"):
                continue
            stat["poi_v_oblasti"] += 1
            labs = sorted({concepts[c["@id"]] for c in o.get("dc:classification") or [] if isinstance(c, dict) and c.get("@id") in concepts})
            refs = [r.get("@id") for r in (o.get("dc:additionalInformation") or []) if isinstance(r, dict)]
            texts = [info[r] for r in refs if r in info]
            if not labs and not texts:
                continue
            stat["s_udajem_o_pristupnosti"] += 1
            lic = bc_lic(o)
            if not lic:
                stat["neotevrena_licence_vynechano"] += 1
                stat["lic:" + str(o.get("sdLicense"))] += 1
                continue
            # doplňkový text s vlastní neotevřenou licencí se nepřebírá
            texts = [x for x in texts if not x[2] or x[2] in OPEN_LIC]
            if not labs and not texts:
                continue
            types = o.get("@type") if isinstance(o.get("@type"), list) else [o.get("@type")]
            c, s = "pamatky", "Turistický cíl"
            for t_, c_, s_ in BC_TYPE:
                if t_ in types:
                    c, s = c_, s_
                    break
            w = "yes" if any(BC_W_YES.match(x) for x in labs) else "limited" if any(BC_W_LIM.match(x) for x in labs) else \
                "no" if any(BC_W_NO.match(x) for x in labs) else None
            tt = "yes" if any(BC_T_YES.match(x) for x in labs) else None
            adr = o.get("address") or {}
            if isinstance(adr, list):
                adr = adr[0] if adr else {}
            date = (o.get("dct:modified") or "")[:10] or None
            rows = []
            if labs:
                rows.append(["Označení bezbariérovosti (klasifikace poskytovatele, originál)", "; ".join(labs)])
            for nm, tx, _ in texts:
                rows.append([f"{nm} (popis poskytovatele, originál)", tx])
            street = val(adr.get("streetAddress"))
            rec = place("bc" + o["@id"], re.sub(r"\s+", " ", o["name"]).strip(), c, s, la, lo,
                        val(adr.get("addressLocality")) or "", k, w=w, t=tt, a=street, web=val(o.get("url")),
                        ph=val(adr.get("telephone") or o.get("telephone")), u=date)
            rec["x"] = [xrec("bayerncloud", rec["n"], "BayernCloud Tourismus (Bayern Tourismus Marketing GmbH) – Attraktionen in Bayern",
                             o.get("dc:entityUrl") or URL_BC, date, lic, o.get("copyrightNotice") or "BayernCloud Tourismus", CAT3.get(w), rows)]
            rec["x"][0]["coords"] = "zdroj (BayernCloud Tourismus)"
            out.append(rec)
            stat["prevzato"] += 1
    print("BayernCloud:", dict(stat))
    return out, stat


# ---------------------------------------------------------------- hlavní běh

def main():
    bez = Bezirke()
    allp, counts = [], {}
    for name, fn in (("muc_wc", muc_wc), ("muc_bpp", muc_bpp), ("muc_pr", muc_pr), ("muc_wahl", muc_wahl), ("haar_bpp", haar_bpp)):
        items = fn(bez)
        counts[name] = len(items)
        allp += items
    bc_files = sorted(RAW.glob("bc_*.jsonld"))
    if bc_files and "--bez-bc" not in sys.argv:
        items, _ = bayerncloud(bez, bc_files)
        counts["bayerncloud"] = len(items)
        allp += items
    for r in allp:
        r["x"][0].setdefault("coords", "zdroj (" + r["x"][0]["attribution"] + ")")
    allp.sort(key=lambda r: (r["k"], r["o"], r["c"], r["n"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(allp, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("zapsáno", len(allp), counts, "->", OUT)
    print("obvody:", dict(Counter(r["k"] for r in allp)))


if __name__ == "__main__":
    main()
