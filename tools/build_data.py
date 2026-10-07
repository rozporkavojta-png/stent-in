"""Převede stažená data z OpenStreetMap na data webu kudyprojedu.cz.

Vstup:  data/raw/*.json (z tools/fetch_osm.py)
Výstup: data/places.json  – všechna místa v kompaktním tvaru
        data/stats.json   – souhrnná čísla pro úvodní stránku a pro obce

Nic se nedopočítává ani nevymýšlí: každé pole pochází z konkrétního tagu OSM.
Jediný odvozený údaj je obec a kraj (podle polohy), protože adresa v OSM často chybí.
"""
import glob
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

from shapely.geometry import LineString, Point, shape
from shapely.ops import polygonize, unary_union
from shapely.prepared import prep
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"

# kategorie webu ← tagy OSM
CAT_RULES = [
    ("ubytovani", "tourism", {"hotel": "Hotel", "guest_house": "Penzion", "hostel": "Hostel", "apartment": "Apartmány", "chalet": "Chata",
                               "motel": "Motel", "camp_site": "Kemp", "alpine_hut": "Horská chata", "caravan_site": "Karavanové stání"}),
    ("restaurace", "amenity", {"restaurant": "Restaurace", "cafe": "Kavárna", "pub": "Hospoda", "bar": "Bar", "fast_food": "Rychlé občerstvení",
                                "ice_cream": "Zmrzlina", "biergarten": "Pivní zahrádka"}),
    ("wc", "amenity", {"toilets": "Veřejné WC"}),
    ("parkovani", "amenity", {"parking": "Parkoviště", "parking_space": "Parkovací místo ZTP"}),
    ("pamatky", "tourism", {"museum": "Muzeum", "gallery": "Galerie", "attraction": "Turistický cíl", "zoo": "Zoo", "theme_park": "Zábavní park", "aquarium": "Akvárium"}),
    ("pamatky", "historic", {"castle": "Hrad / zámek", "monument": "Památník", "memorial": "Pamětní místo", "church": "Kostel", "monastery": "Klášter",
                              "ruins": "Zřícenina", "archaeological_site": "Archeologické naleziště", "building": "Historická budova", "*": "Památka"}),
    ("kultura", "amenity", {"theatre": "Divadlo", "cinema": "Kino", "arts_centre": "Kulturní centrum", "library": "Knihovna", "community_centre": "Komunitní centrum"}),
    ("priroda", "tourism", {"viewpoint": "Vyhlídka", "picnic_site": "Místo k pikniku"}),
    ("priroda", "leisure", {"park": "Park", "garden": "Zahrada", "nature_reserve": "Přírodní rezervace"}),
    ("sport", "leisure", {"sports_centre": "Sportovní centrum", "swimming_pool": "Bazén", "stadium": "Stadion", "water_park": "Aquapark", "ice_rink": "Zimní stadion"}),
    ("zdravi", "amenity", {"hospital": "Nemocnice", "clinic": "Poliklinika", "doctors": "Lékař", "dentist": "Zubař", "pharmacy": "Lékárna"}),
    ("urady", "amenity", {"townhall": "Městský / obecní úřad", "post_office": "Pošta", "police": "Policie", "courthouse": "Soud", "bank": "Banka",
                           "marketplace": "Tržiště", "university": "Vysoká škola", "college": "Vyšší odborná škola"}),
    ("urady", "office", {"government": "Úřad"}),
    ("urady", "tourism", {"information": "Turistické informace"}),
    ("doprava", "railway", {"station": "Nádraží"}),
    ("doprava", "amenity", {"bus_station": "Autobusové nádraží"}),
    ("obchody", "shop", {"supermarket": "Supermarket", "mall": "Obchodní centrum", "department_store": "Obchodní dům", "bakery": "Pekárna",
                          "chemist": "Drogerie", "optician": "Optika", "medical_supply": "Zdravotnické potřeby"}),
]

SKIP_TOURISM = {"artwork", "yes", "trail_riding_station", "wilderness_hut", "camp_pitch", "board", "guidepost", "map"}


def classify(t):
    if t.get("tourism") == "information" and t.get("information") not in (None, "office", "visitor_centre"):
        return None, None
    for cat, key, mapping in CAT_RULES:
        v = t.get(key)
        if v is None:
            continue
        if key == "tourism" and v in SKIP_TOURISM:
            continue
        if v in mapping:
            return cat, mapping[v]
        if "*" in mapping:
            return cat, mapping["*"]
    return None, None


def cm(val):
    """Šířka/výška z OSM (metry nebo cm) → celé centimetry, jinak None."""
    if not val:
        return None
    m = re.match(r"^\s*([\d.,]+)\s*(cm|m)?\s*$", val)
    if not m:
        return None
    x = float(m.group(1).replace(",", "."))
    unit = m.group(2) or ("cm" if x > 5 else "m")
    return round(x * 100) if unit == "m" else round(x)


def load_elements():
    seen = {}
    files = [f for f in glob.glob(str(RAW / "*.json")) if not re.search(r"(cz_boundary|kraje|_gh|places_s\d)", f)]
    # novější soubory s metadaty (_sN) mají přednost před staršími celostátními
    files.sort(key=lambda f: (re.search(r"_s\d+\.json$", f) is not None, f))
    for f in files:
        try:
            data = json.loads(Path(f).read_text(encoding="utf-8"))
        except Exception:
            continue
        for e in data.get("elements", []):
            if e.get("type") not in ("node", "way", "relation"):
                continue
            key = e["type"][0] + str(e["id"])
            seen[key] = e
    return seen


def load_border():
    data = json.loads((RAW / "cz_boundary.json").read_text(encoding="utf-8"))
    rel = data["elements"][0]
    lines = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]]) for m in rel["members"]
             if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry")]
    poly = unary_union(list(polygonize(unary_union(lines))))
    return prep(poly.buffer(0.002))


def load_admin(fname):
    """Hranice z RÚIAN (github.com/siwekm/czech-geojson): vrací (STRtree, [(name, prepared)])."""
    p = RAW / fname
    if not p.exists():
        return None, []
    feats = json.loads(p.read_text(encoding="utf-8"))["features"]
    geoms = [shape(f["geometry"]) for f in feats]
    return STRtree(geoms), [(f["name"], prep(g)) for f, g in zip(feats, geoms)]


def load_gh(fname, strip=False):
    """Hranice z data/raw/*_gh.json (github.com/siwekm/czech-geojson, data ČÚZK/RÚIAN)."""
    p = RAW / fname
    if not p.exists():
        return None
    feats = json.loads(p.read_text(encoding="utf-8"))["features"]
    names, geoms = [], []
    for f in feats:
        n = f["name"]
        if strip:
            n = n.replace(" kraj", "").replace("Kraj ", "")
        names.append(n)
        geoms.append(shape(f["geometry"]))
    return names, geoms, STRtree(geoms)


def locate(index, lat, lng):
    if not index:
        return ""
    names, geoms, tree = index
    pt = Point(lng, lat)
    for i in tree.query(pt):
        if geoms[i].contains(pt):
            return names[i]
    return ""


def load_kraje():
    p = RAW / "kraje.json"
    if not p.exists():
        return []
    out = []
    for rel in json.loads(p.read_text(encoding="utf-8"))["elements"]:
        name = rel.get("tags", {}).get("name", "")
        lines = [LineString([(q["lon"], q["lat"]) for q in m["geometry"]]) for m in rel.get("members", [])
                 if m.get("type") == "way" and m.get("role") == "outer" and m.get("geometry")]
        if not lines:
            continue
        poly = unary_union(list(polygonize(unary_union(lines))))
        out.append((name.replace(" kraj", "").replace("Kraj ", ""), prep(poly), poly))
    return out


def load_places():
    nodes = []
    for f in sorted(glob.glob(str(RAW / "places_s*.json"))):
        for e in json.loads(Path(f).read_text(encoding="utf-8")).get("elements", []):
            t = e.get("tags", {})
            if t.get("name"):
                nodes.append((t["name"], t.get("place"), e["lat"], e["lon"], int(t.get("population", "0").replace(" ", "") or 0) if t.get("population", "").replace(" ", "").isdigit() else 0))
    return nodes


def main():
    els = load_elements()
    border = load_border()
    KRAJE = load_gh("kraje_gh.json", strip=True)
    OBCE = load_gh("obce_gh.json")
    obce_tree, obce_list = load_admin("obce_gh.json")
    kraje_tree, kraje_list = load_admin("kraje_gh.json")
    kraje = load_kraje()
    places_nodes = load_places()
    big = [p for p in places_nodes if p[1] in ("city", "town")]
    tree_all = STRtree([Point(p[3], p[2]) for p in places_nodes]) if places_nodes else None
    tree_big = STRtree([Point(p[3], p[2]) for p in big]) if big else None

    def in_admin(tree, lst, lat, lng):
        if tree is None:
            return None
        pt = Point(lng, lat)
        for i in tree.query(pt):
            if lst[i][1].contains(pt):
                return lst[i][0]
        return None

    def obec(lat, lng, t):
        o = in_admin(obce_tree, obce_list, lat, lng)
        if o:
            return o
        if t.get("addr:city"):
            return t["addr:city"]
        pt = Point(lng, lat)
        if tree_big is not None:
            i = tree_big.nearest(pt)
            if big[i] and math.dist((big[i][3], big[i][2]), (lng, lat)) < 0.045:  # ~3–5 km
                return big[i][0]
        if tree_all is not None:
            return places_nodes[tree_all.nearest(pt)][0]
        return ""

    def kraj(lat, lng):
        k = in_admin(kraje_tree, kraje_list, lat, lng)
        if k:
            return k
        pt = Point(lng, lat)
        for name, pp, _ in kraje:
            if pp.contains(pt):
                return name
        return ""

    out = []
    stats = Counter()
    by_city = defaultdict(Counter)
    for key, e in els.items():
        t = e.get("tags", {})
        cat, sub = classify(t)
        if not cat:
            continue
        lat = e.get("lat") or (e.get("center") or {}).get("lat")
        lng = e.get("lon") or (e.get("center") or {}).get("lon")
        if lat is None or not border.contains(Point(lng, lat)):
            continue
        w = t.get("wheelchair")
        if w not in ("yes", "limited", "no", "designated"):
            w = None
        if w == "designated":
            w = "yes"
        wc = t.get("toilets:wheelchair")
        if cat == "wc" and not wc:
            wc = "yes" if w == "yes" else None
        if wc not in ("yes", "no", "limited"):
            wc = None
        name = t.get("name") or t.get("official_name")
        if not name:
            if cat not in ("wc", "parkovani"):
                continue
            name = sub
        cap_dis = t.get("capacity:disabled")
        if cat == "parkovani":
            if sub == "Parkovací místo ZTP":
                cap_dis = cap_dis or "1"
            if not cap_dis or not cap_dis.isdigit() or cap_dis == "0":
                if not (cap_dis and cap_dis in ("yes",)):
                    continue
        if w is None and wc is None and cat != "parkovani":
            continue
        addr = " ".join(x for x in [t.get("addr:street") or t.get("addr:place"), t.get("addr:housenumber") or t.get("addr:conscriptionnumber")] if x)
        o = locate(OBCE, lat, lng) or obec(lat, lng, t)
        k = locate(KRAJE, lat, lng) or kraj(lat, lng)
        img = t.get("wikimedia_commons") if (t.get("wikimedia_commons") or "").startswith("File:") else None
        if not img and re.search(r"\.(jpe?g|png)$", t.get("image", ""), re.I) and "commons" in t.get("image", ""):
            img = "File:" + t["image"].split("/")[-1]
        rec = {
            "i": key,
            "n": name,
            "c": cat,
            "s": sub,
            "la": round(lat, 6),
            "lo": round(lng, 6),
            "w": w,
            "t": wc,
            "o": o,
            "k": k,
        }
        opt = {
            "a": addr or None,
            "d": t.get("wheelchair:description:cs") or t.get("wheelchair:description") or None,
            "de": t.get("wheelchair:description:en") if not t.get("wheelchair:description") else None,
            "sc": int(t["step_count"]) if (t.get("step_count") or "").isdigit() else None,
            "rp": t.get("ramp:wheelchair") or t.get("ramp") or None,
            "dw": cm(t.get("door:width")) or (cm(t.get("width")) if t.get("entrance") or t.get("door") else None),
            "pk": int(cap_dis) if (cap_dis or "").isdigit() else None,
            "pw": t.get("parking:wheelchair") or None,
            "web": t.get("website") or t.get("contact:website") or None,
            "ph": t.get("phone") or t.get("contact:phone") or None,
            "oh": t.get("opening_hours") or None,
            "img": img,
            "cd": t.get("check_date:wheelchair") or t.get("check_date") or t.get("survey:date") or None,
            "u": (e.get("timestamp") or "")[:10] or None,
            "v": e.get("version"),
            "st": t.get("stars") or None,
            "op": t.get("operator") or None,
            "fee": t.get("fee") or None,
            "ek": "yes" if (t.get("centralkey") == "eurokey" or "euro" in (t.get("toilets:wheelchair:key") or "").lower()) else None,
            "cp": t.get("changing_table") or None,
        }
        rec.update({k2: v2 for k2, v2 in opt.items() if v2 is not None})
        out.append(rec)
        stats[cat] += 1
        stats["w_" + str(w)] += 1
        if wc:
            stats["t_" + wc] += 1
        by_city[o][w or "unk"] += 1

    out.sort(key=lambda r: (r["k"], r["o"], r["n"]))
    (ROOT / "data" / "places.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    city_stats = sorted(({"o": o, "n": sum(c.values()), **c} for o, c in by_city.items() if o), key=lambda x: -x["n"])
    summary = {"total": len(out), "fetched": "2026-10-05", "cats": dict(stats), "cities": city_stats[:400],
               "kraje": dict(Counter(r["k"] for r in out))}
    (ROOT / "data" / "stats.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(out)} míst", dict(stats))


if __name__ == "__main__":
    main()
