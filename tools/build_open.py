"""Zapojí otevřená data s naměřenými údaji do data/places.json.

Zdroje (data/open/):
  mbb_certified.json   Mapy bez bariér (Konto Bariéry), certifikované objekty, licence v poli license (ODbL / CC BY-SA 4.0)
  brno_budovy.geojson  Brno – Mapa přístupnosti, budovy (data.brno.cz), CC BY 4.0
  praha_ztp.geojson    IPR Praha / TSK – vyhrazená stání ZTP, CC BY 4.0
                       (stáhne se, pokud chybí: ArcGIS FeatureServer se stránkováním)

Postup: objekt se spáruje s místem z OSM (vzdálenost < 40 m a podobný název; u stání ZTP
< 20 m od místa kategorie parkování), jinak vznikne nové místo (id mbb123 / brno123 / pz123).
Naměřené údaje jdou do pole x. Nic se nedopočítává: řádky jsou jen hodnoty ze zdroje.
Skript je opakovatelný: před zápisem odstraní pole x a místa z dřívějšího běhu.

Spuštění: python tools/build_data.py && python tools/build_open.py
"""
import html
import json
import math
import re
import sys
import time
import unicodedata
import urllib.request
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_data import load_gh, locate  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OPEN = ROOT / "data" / "open"
UA = "kudyprojedu-student-project/0.1 (VSTE Ceske Budejovice)"

PZ_LAYER = "https://mp.iprpraha.cz/arcgis/rest/services/Hosted/DOP_CUR_DOP_TSK_STANI_ZTP_B/FeatureServer/0"
BRNO_URL = "https://data.brno.cz/datasets/cca344ea2fb24eecb4e449c5970fd401_0/about"
MBB_URL = "https://mapybezbarier.cz/cs?id={}&do=detail"

CAT3 = {"yes": "Přístupný", "limited": "Částečně přístupný", "no": "Nepřístupný"}

# ---------------------------------------------------------------- pomocné


def fmt_num(x, dec=2):
    if x is None:
        return None
    x = round(float(x), dec)
    s = ("%d" % x) if x == int(x) else ("%." + str(dec) + "f") % x
    return s.rstrip("0").rstrip(".").replace(".", ",") if "." in s else s


def cm(x):
    return None if x is None else fmt_num(x) + " cm"


def strip_html(s, limit=900):
    if not s:
        return None
    s = re.sub(r"<\s*(br|/li|/p|/div)\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s).replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return None
    if len(s) > limit:
        s = s[:limit].rsplit(" ", 1)[0] + " …"
    return s


def dist_m(la1, lo1, la2, lo2):
    k = math.pi / 180
    x = (lo2 - lo1) * k * math.cos((la1 + la2) / 2 * k)
    y = (la2 - la1) * k
    return math.hypot(x, y) * 6371000


STOP = set("""a i u v ve na do z ze s se o k sv sv. the and of cz s.r.o sro a.s as o.p.s ops z.s spol
lekarna restaurace kavarna hotel muzeum kostel banka posta pobocka brno praha mesto mestsky mestska urad
centrum galerie nemocnice ordinace zdravotnicke zarizeni obchod bankomat divadlo knihovna kino bazen
cukrarna penzion infocentrum informacni turisticke wc toaleta verejne bistro pub bar cafe""".split())


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+", " ", s).split()


def similar(a, b):
    ta, tb = norm(a), norm(b)
    if not ta or not tb:
        return False
    ja, jb = " ".join(ta), " ".join(tb)
    if SequenceMatcher(None, ja, jb).ratio() >= 0.7:
        return True
    sa = {t for t in ta if len(t) >= 3 and t not in STOP}
    sb = {t for t in tb if len(t) >= 3 and t not in STOP}
    return bool(sa & sb)


class Grid:
    """Jednoduchý prostorový index (buňky ~ 0,001°)."""

    def __init__(self, places):
        self.cells = defaultdict(list)
        for p in places:
            self.add(p)

    def key(self, la, lo):
        return (int(la * 1000), int(lo * 1000))

    def add(self, p):
        self.cells[self.key(p["la"], p["lo"])].append(p)

    def near(self, la, lo, r):
        a, b = self.key(la, lo)
        for i in (-1, 0, 1):
            for j in (-1, 0, 1):
                for p in self.cells.get((a + i, b + j), ()):
                    d = dist_m(la, lo, p["la"], p["lo"])
                    if d < r:
                        yield d, p


# ---------------------------------------------------------------- Mapy bez bariér

MBB_CAT = {
    "AccessibleObjectMKPO": "yes", "PartlyAccessibleObjectMKPO": "limited", "InAccessibleObjectMKPO": "no",
}
MBB_TYPE = {
    "MedicalFacilityObjectCategory": ("zdravi", "Zdravotnické zařízení"), "InstitutionObjectCategory": ("urady", "Úřad / instituce"),
    "MuseumObjectCategory": ("pamatky", "Muzeum"), "PharmacyObjectCategory": ("zdravi", "Lékárna"),
    "BankObjectCategory": ("urady", "Banka"), "StoreObjectCategory": ("obchody", "Obchod"),
    "ChurchObjectCategory": ("pamatky", "Kostel"), "AtmObjectCategory": ("urady", "Bankomat"),
    "TheatreObjectCategory": ("kultura", "Divadlo"), "HotelObjectCategory": ("ubytovani", "Hotel"),
    "InformationCenterObjectCategory": ("urady", "Turistické informace"), "RestaurantObjectCategory": ("restaurace", "Restaurace"),
    "IndoorSwimmingPoolObjectCategory": ("sport", "Krytý bazén"), "PastryObjectCategory": ("restaurace", "Cukrárna"),
    "TransportObjectCategory": ("doprava", "Doprava"), "LibraryObjectCategory": ("kultura", "Knihovna"),
    "PostOfficeObjectCategory": ("urady", "Pošta"), "PublicToiletObjectCategory": ("wc", "Veřejné WC"),
    "LeisureTimeObjectCategory": ("sport", "Volný čas"), "CinemaObjectCategory": ("kultura", "Kino"),
    "SpaHouseObjectCategory": ("zdravi", "Lázeňský dům"),
}


def mbb_rows(o):
    rows = []
    g = o.get

    def add(label, val):
        if val not in (None, ""):
            rows.append([label, val])

    add("Šířka hlavního křídla dveří (vstup)", cm(g("entrance1Door1MainpanelWidth")))
    add("Šířka vedlejšího křídla dveří (vstup)", cm(g("entrance1Door1SidepanelWidth")))
    add("Druhé dveře vstupu, hlavní křídlo", cm(g("entrance1Door2MainpanelWidth")))
    add("Práh u dveří vstupu", cm(g("entrance1Door1StepHeight")))
    for i in (1, 2):
        n, h = g(f"entrance1Steps{i}NumberOf"), g(f"entrance1Steps{i}Height")
        if n:
            add("Schody u vstupu", f"{n} × {fmt_num(h)} cm" if h is not None else f"{n}")
    if g("objectSteps1NumberOf"):
        add("Schody v objektu", f"{g('objectSteps1NumberOf')}" + (f" ({g('objectSteps1Localization')})" if g("objectSteps1Localization") else ""))
    add("Šířka schodiště v objektu", cm(g("objectStairsWidth")))
    if g("entrance1LongitudinalInclination") is not None:
        add("Podélný sklon u vstupu (údaj zdroje)", fmt_num(g("entrance1LongitudinalInclination")))
    if g("entrance1TransverseInclination") is not None:
        add("Příčný sklon u vstupu (údaj zdroje)", fmt_num(g("entrance1TransverseInclination")))
    for r in g("rampskids") or []:
        for leg in (1, 2, 3):
            w, ln, inc = r.get(f"rampleg{leg}Width"), r.get(f"rampleg{leg}Length"), r.get(f"rampleg{leg}Inclination")
            if w or ln:
                v = " × ".join(x for x in [cm(w), cm(ln)] if x)
                if inc is not None:
                    v += f", sklon {fmt_num(inc)} (údaj zdroje)"
                add(f"Rampa, rameno {leg} (šířka × délka)", v)
    for i, e in enumerate(g("elevator") or [], 1):
        sfx = f" {i}" if len(g("elevator")) > 1 else ""
        if e.get("elevatorCageWidth") and e.get("elevatorCageDepth"):
            add(f"Výtah{sfx}: kabina (š × hl)", f"{fmt_num(e['elevatorCageWidth'])} × {fmt_num(e['elevatorCageDepth'])} cm")
        add(f"Výtah{sfx}: dveře", cm(e.get("door1Width")))
        add(f"Výtah{sfx}: umístění", e.get("elevatorLocalization"))
    for i, w in enumerate(g("wc") or [], 1):
        sfx = f" {i}" if len(g("wc")) > 1 else ""
        acc = {"AccessibleWCMKPO": "přístupné", "PartlyAccessibleWCMKPO": "částečně přístupné"}.get(w.get("wcAccessibility"))
        add(f"WC{sfx}: kategorie", acc)
        if w.get("wcCabinWidth") and w.get("wcCabinDepth"):
            add(f"WC{sfx}: kabina (š × hl)", f"{fmt_num(w['wcCabinWidth'])} × {fmt_num(w['wcCabinDepth'])} cm")
        add(f"WC{sfx}: dveře", cm(w.get("doorWidth")))
        add(f"WC{sfx}: výška mísy", cm(w.get("wcBasinSeatHeight")))
        add(f"WC{sfx}: umístění", w.get("wcLocalization"))
    if g("entrance1IsReservedParking") is True:
        add("Vyhrazené parkování u vstupu", f"ano, {g('entrance1NumberOfReservedParking')} stání" if g("entrance1NumberOfReservedParking") else "ano")
    elif g("entrance1IsReservedParking") is False:
        add("Vyhrazené parkování u vstupu", "ne")
    structured = len(rows)
    add("Popis mapovače", strip_html(g("description")))
    return rows, structured


def mbb_items():
    for o in json.loads((OPEN / "mbb_certified.json").read_text(encoding="utf-8")):
        if o.get("latitude") is None or o.get("longitude") is None:
            continue
        w = MBB_CAT.get(o.get("accessibility"))
        rows, structured = mbb_rows(o)
        c, s = MBB_TYPE.get(o.get("objectType"), ("urady", "Instituce"))
        street = " ".join(str(x) for x in [o.get("street"), o.get("streetDescNo")] if x)
        if o.get("streetOrientNo"):
            street += "/" + str(o["streetOrientNo"]) + (o.get("streetOrientSymbol") or "")
        yield {
            "src": "mapybezbarier", "id": "mbb" + str(o["objectId"]), "n": o.get("title"), "la": o["latitude"], "lo": o["longitude"],
            "c": c, "s": s, "w": w, "a": street or None, "web": o.get("webUrl") or None, "structured": structured,
            "x": {"src": "mapybezbarier", "name": o.get("title"), "label": "Mapy bez bariér (certifikované mapování)", "url": MBB_URL.format(o["objectId"]),
                  "date": (o.get("mappingDate") or "")[:10] or None, "license": o.get("license"),
                  "attribution": "Mapy bez bariér a přispěvatelé", "cat": CAT3.get(w), "rows": rows},
        }


# ---------------------------------------------------------------- Brno

BRNO_CAT = {"přístupné": "yes", "přístupné s asistencí": "limited", "nepřístupné": "no"}
BRNO_TYPE = {
    "ordinace, nemocnice": ("zdravi", "Ordinace / nemocnice"), "úřad": ("urady", "Úřad"),
    "muzeum, galerie, kulturní památka": ("pamatky", "Muzeum / galerie / památka"), "obchod": ("obchody", "Obchod"),
    "lékárna": ("zdravi", "Lékárna"), "banka, pojišťovna": ("urady", "Banka / pojišťovna"), "kostel": ("pamatky", "Kostel"),
    "divadlo, koncerty": ("kultura", "Divadlo / koncerty"), "bankomat": ("urady", "Bankomat"), "hotel": ("ubytovani", "Hotel"),
    "restaurace": ("restaurace", "Restaurace"), "kavárna": ("restaurace", "Kavárna"), "infocentrum": ("urady", "Turistické informace"),
    "bazén": ("sport", "Bazén"), "terminál hromadné dopravy": ("doprava", "Terminál hromadné dopravy"), "WC": ("wc", "Veřejné WC"),
    "pošta": ("urady", "Pošta"), "knihovna": ("kultura", "Knihovna"), "park": ("priroda", "Park"), "kino": ("kultura", "Kino"),
}


def brno_items():
    data = json.loads((OPEN / "brno_budovy.geojson").read_text(encoding="utf-8"))
    for f in data["features"]:
        if not f.get("geometry") or f["geometry"].get("type") != "Point":
            continue
        p = f["properties"]
        lo, la = f["geometry"]["coordinates"][:2]
        w = BRNO_CAT.get(p.get("pristupnost_budovy"))
        rows = []
        if p.get("pristupnost_budovy"):
            rows.append(["Kategorie přístupnosti", p["pristupnost_budovy"]])
        if p.get("wc"):
            rows.append(["WC", p["wc"]])
        if p.get("typ_budovy"):
            rows.append(["Typ budovy", p["typ_budovy"]])
        desc = strip_html(p.get("podrobny_popis_cz")) or strip_html(p.get("popis_cz"))
        if desc:
            rows.append(["Popis", desc])
        date = p.get("aktualizace") or p.get("last_date")
        if date:
            rows.append(["Datum aktualizace", date])
        c, s = BRNO_TYPE.get(p.get("typ_budovy"), ("urady", "Budova"))
        web = p.get("web_url")
        if web and not web.startswith("http"):
            web = "https://" + web
        yield {
            "src": "brno", "id": "brno" + str(p.get("ogcfid") or p.get("ObjectId")), "n": p.get("nazev_cz"), "la": la, "lo": lo,
            "c": c, "s": s, "w": w, "a": p.get("adresa") or None, "web": web or None, "ph": (p.get("telefon_cz") or "").strip() or None,
            "structured": 0,
            "x": {"src": "brno", "name": p.get("nazev_cz"), "label": "Brno – Mapa přístupnosti budov", "url": BRNO_URL, "date": date, "license": "CC BY 4.0",
                  "attribution": "Statutární město Brno, data.brno.cz", "cat": CAT3.get(w), "rows": rows},
        }


# ---------------------------------------------------------------- Praha IPR / TSK

PZ_TYP = {1: "Podélné", 2: "Šikmé", 3: "Kolmé", 4: "Kolmé částečně na chodníku", 5: "Podélné částečně na chodníku", 7: "Na registrační značce"}
PZ_POVRCH = {1: "Pevný a rovný", 2: "Souvislý s pravidelnými spárami do šířky max. 20 mm", 3: "Nepravidelný s výškovými rozdíly, se spárami o šířce > 20 mm"}
PZ_MAT = {1: "Asfalt", 2: "Betonová dlažba", 3: "Pražská mozaika", 4: "Betonový panel", 5: "Vegetační dlažba", 6: "Litý beton", 7: "Kamenná dlažba", 8: "Kovová dlažba"}


def fetch_praha():
    out = OPEN / "praha_ztp.geojson"
    try:
        if len(json.loads(out.read_text(encoding="utf-8")).get("features", [])) > 0:
            return
    except Exception:
        pass
    feats, off = [], 0
    while True:
        url = (PZ_LAYER + "/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&orderByFields=objectid"
               f"&resultOffset={off}&resultRecordCount=2000")
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=120) as r:
            d = json.loads(r.read().decode("utf-8"))
        feats += d.get("features", [])
        if not (d.get("properties") or {}).get("exceededTransferLimit"):
            break
        off += 2000
        time.sleep(2)
    out.write_text(json.dumps({"type": "FeatureCollection", "source": PZ_LAYER, "downloaded": time.strftime("%Y-%m-%d"),
                               "license": "CC BY 4.0", "features": feats}, ensure_ascii=False), encoding="utf-8")


def praha_items():
    data = json.loads((OPEN / "praha_ztp.geojson").read_text(encoding="utf-8"))
    for f in data["features"]:
        if not f.get("geometry"):
            continue
        p = f["properties"]
        if p.get("typ_ps") == 6:  # zrušeno
            continue
        lo, la = f["geometry"]["coordinates"][:2]
        rows = []
        if p.get("pocet_ps"):
            rows.append(["Počet stání", str(p["pocet_ps"])])
        if p.get("rozm_delka") and p.get("rozm_sirka"):
            rows.append(["Rozměr stání (délka × šířka)", f"{fmt_num(p['rozm_delka'])} × {fmt_num(p['rozm_sirka'])} m"])
        if PZ_TYP.get(p.get("typ_ps")):
            rows.append(["Typ stání", PZ_TYP[p["typ_ps"]]])
        if p.get("pod_sklon") is not None:
            rows.append(["Podélný sklon (údaj TSK)", fmt_num(p["pod_sklon"])])
        if p.get("pric_sklon") is not None:
            rows.append(["Příčný sklon (údaj TSK)", fmt_num(p["pric_sklon"])])
        if PZ_POVRCH.get(p.get("typ_povrch")):
            rows.append(["Povrch", PZ_POVRCH[p["typ_povrch"]]])
        if PZ_MAT.get(p.get("mat_povrch")):
            rows.append(["Materiál povrchu", PZ_MAT[p["mat_povrch"]]])
        oid = p.get("objectid")
        yield {
            "src": "praha_ipr", "id": "pz" + str(oid), "n": "Vyhrazené stání ZTP", "la": la, "lo": lo, "c": "parkovani",
            "s": "Parkovací místo ZTP", "w": None, "pk": p.get("pocet_ps") or None, "structured": len(rows),
            "x": {"src": "praha_ipr", "name": "Vyhrazené stání ZTP", "label": "IPR Praha / TSK – vyhrazené stání ZTP", "url": f"{PZ_LAYER}/{oid}?f=pjson",
                  "license": "CC BY 4.0", "attribution": "IPR Praha, TSK hl. m. Prahy", "rows": rows},
        }


# ---------------------------------------------------------------- hlavní běh


def main():
    fetch_praha()
    places_path = ROOT / "data" / "places.json"
    places = json.loads(places_path.read_text(encoding="utf-8"))
    places = [p for p in places if not re.match(r"^(mbb|brno|pz)\d", p["i"])]
    for p in places:
        p.pop("x", None)
    osm_count = len(places)

    KRAJE = load_gh("kraje_gh.json", strip=True)
    OBCE = load_gh("obce_gh.json")
    grid = Grid(places)
    added = Counter()
    matched = Counter()
    structured = Counter()

    for gen in (mbb_items, brno_items, praha_items):
        for it in gen():
            it["n"] = re.sub(r"\s+", " ", it.get("n") or "").strip()
            it["x"]["name"] = it["n"]
            if not it["n"]:
                continue
            target, best = None, None
            if it["c"] == "parkovani":
                for d, p in grid.near(it["la"], it["lo"], 20):
                    if p["c"] == "parkovani" and (best is None or d < best):
                        target, best = p, d
            else:
                for d, p in grid.near(it["la"], it["lo"], 40):
                    if p["c"] != "parkovani" and similar(it["n"], p["n"]) and (best is None or d < best):
                        target, best = p, d
            if target is None:
                target = {"i": it["id"], "n": it["n"], "c": it["c"], "s": it["s"], "la": round(it["la"], 6), "lo": round(it["lo"], 6),
                          "w": it.get("w"), "t": None, "o": locate(OBCE, it["la"], it["lo"]), "k": locate(KRAJE, it["la"], it["lo"])}
                for k in ("a", "web", "ph", "pk"):
                    if it.get(k):
                        target[k] = it[k]
                if it["x"].get("date"):
                    target["u"] = it["x"]["date"]
                places.append(target)
                grid.add(target)
                added[it["src"]] += 1
            else:
                matched[it["src"]] += 1
                if not target.get("w") and it.get("w") and target["c"] != "parkovani":
                    target["w"] = it["w"]
                for k in ("a", "web", "ph"):
                    if it.get(k) and not target.get(k):
                        target[k] = it[k]
                if it["src"] == "praha_ipr" and it.get("pk") and not target.get("pk"):
                    target["pk"] = it["pk"]
            target.setdefault("x", []).append(it["x"])
            if it["structured"]:
                structured[it["src"]] += 1

    places.sort(key=lambda r: (r["k"], r["o"], r["n"]))
    places_path.write_text(json.dumps(places, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # statistiky přepočítané stejně jako v build_data.py + počty podle zdrojů
    stats_path = ROOT / "data" / "stats.json"
    stats = json.loads(stats_path.read_text(encoding="utf-8"))
    cats, by_city = Counter(), defaultdict(Counter)
    for r in places:
        cats[r["c"]] += 1
        cats["w_" + str(r.get("w"))] += 1
        if r.get("t"):
            cats["t_" + r["t"]] += 1
        by_city[r["o"]][r.get("w") or "unk"] += 1
    src_counts = Counter()
    for r in places:
        if re.match(r"^[nwr]\d", r["i"]):
            src_counts["osm"] += 1
        for x in r.get("x", []):
            src_counts[x["src"]] += 1
    stats.update({
        "total": len(places),
        "cats": dict(cats),
        "cities": sorted(({"o": o, "n": sum(c.values()), **c} for o, c in by_city.items() if o), key=lambda x: -x["n"])[:400],
        "kraje": dict(Counter(r["k"] for r in places)),
        "sources": {k: src_counts.get(k, 0) for k in ("osm", "mapybezbarier", "brno", "praha_ipr")},
        "measured": sum(1 for r in places if r.get("x")),
        "open_data": {
            "mapybezbarier": {"name": "Mapy bez bariér", "attribution": "Mapy bez bariér a přispěvatelé", "license": "ODbL / CC BY-SA 4.0",
                              "url": "https://mapybezbarier.cz/otevrena-data", "added": added["mapybezbarier"], "matched": matched["mapybezbarier"],
                              "structured": structured["mapybezbarier"]},
            "brno": {"name": "Brno – Mapa přístupnosti budov", "attribution": "Statutární město Brno", "license": "CC BY 4.0",
                     "url": BRNO_URL, "added": added["brno"], "matched": matched["brno"]},
            "praha_ipr": {"name": "IPR Praha / TSK – vyhrazená stání ZTP", "attribution": "IPR Praha, TSK hl. m. Prahy", "license": "CC BY 4.0",
                          "url": PZ_LAYER, "added": added["praha_ipr"], "matched": matched["praha_ipr"]},
        },
    })
    stats_path.write_text(json.dumps(stats, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OSM míst: {osm_count}, celkem: {len(places)}, s naměřenými údaji: {stats['measured']}")
    print("nová místa:", dict(added), "spárováno:", dict(matched), "se strukturovanými rozměry:", dict(structured))
    print("zdroje:", stats["sources"])


if __name__ == "__main__":
    main()
