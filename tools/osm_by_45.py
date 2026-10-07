"""OpenStreetMap pro bavorské vládní obvody Střední Franky a Dolní Franky (z Geofabrik extraktů).

  python tools/osm_by_45.py extract stredni-franky   – stáhne .pbf, proudově vybere objekty, smaže .pbf
  python tools/osm_by_45.py build stredni-franky     – převod do schématu webu + fotky + vstupy pro rešerše
  python tools/osm_by_45.py all                      – obojí pro oba obvody, jeden po druhém

Výběr objektů = stejné filtry jako tools/fetch_osm.py (Overpass QUERIES), převod = stejná pravidla jako
tools/build_data.py (classify, cm, mapování tagů). Obec (o) = obec (Gemeinde, OSM admin_level=8) podle polohy,
jinak addr:city, jinak nejbližší sídlo place=city|town|village|hamlet. Kraj (k) = vládní obvod česky, "z":"de".

Zdroje: © přispěvatelé OpenStreetMap, ODbL 1.0 (https://www.openstreetmap.org/copyright),
extrakty https://download.geofabrik.de/europe/germany/bayern/ ; fotky: Wikidata P18 (CC0 metadata),
soubory Wikimedia Commons (licence u každého souboru).
Surová a mezivýsledková data jen v data/raw/ (je v .gitignore).
"""
import json
import math
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_data import classify, cm  # noqa: E402  (stejné kategorie a převody jako ČR)

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "by"
RES = ROOT / "data" / "research" / "inputs_by"
UA = "kudyprojedu-student-project/0.1 (VSTE Ceske Budejovice)"

BEZIRKE = {
    "stredni-franky": {"geofabrik": "mittelfranken", "rel": 17614, "cs": "Střední Franky"},
    "dolni-franky": {"geofabrik": "unterfranken", "rel": 17585, "cs": "Dolní Franky"},
}

# --- výběr objektů: přepis Overpass dotazů z tools/fetch_osm.py (QUERIES) ---------------------------
FOOD = {"cafe", "ice_cream", "pub", "bar", "fast_food", "biergarten", "restaurant"}
LEISURE = {"park", "sports_centre", "swimming_pool", "stadium", "nature_reserve", "garden", "water_park", "ice_rink"}
SHOP = {"supermarket", "mall", "department_store", "bakery", "chemist", "optician", "medical_supply"}
PUBLIC = {"toilets", "pharmacy", "townhall", "library", "theatre", "cinema", "arts_centre", "community_centre", "hospital",
          "clinic", "doctors", "dentist", "post_office", "bank", "police", "courthouse", "marketplace", "bus_station",
          "university", "college"}
PLACES = {"city", "town", "village", "hamlet"}


def wanted(t):
    a = t.get("amenity")
    if "wheelchair" in t:
        if a in FOOD or a in PUBLIC or "historic" in t or "tourism" in t:
            return True
        if t.get("leisure") in LEISURE or t.get("railway") == "station" or t.get("office") == "government":
            return True
        if t.get("shop") in SHOP and "name" in t:
            return True
    if a == "toilets" and "toilets:wheelchair" in t:
        return True
    if t.get("toilets:wheelchair") == "yes" and "name" in t:
        return True
    if a == "parking" and "capacity:disabled" in t:
        return True
    if a == "parking_space" and t.get("parking_space") == "disabled":
        return True
    return False


def is_admin8(t):
    return t.get("boundary") == "administrative" and t.get("admin_level") == "8" and "name" in t


def meta(o):
    ts = o.timestamp
    return {"version": o.version or None, "timestamp": ts.strftime("%Y-%m-%d") if ts and ts.year > 1971 else None}


# --- 1. extrakce z .pbf --------------------------------------------------------------------------
def download(slug):
    g = BEZIRKE[slug]["geofabrik"]
    pbf = RAW / f"{g}-latest.osm.pbf"
    if not pbf.exists() or pbf.stat().st_size < 10_000_000:
        url = f"https://download.geofabrik.de/europe/germany/bayern/{g}-latest.osm.pbf"
        print("stahuji", url, flush=True)
        subprocess.run(["curl", "-sSL", "-A", UA, "-o", str(pbf), url], check=True)
    return pbf


def extract(slug):
    import osmium
    from shapely.geometry import LineString, MultiPoint, Polygon

    out = RAW / f"by45_{slug}.json"
    if out.exists():
        print(out.name, "už existuje", flush=True)
        return
    pbf = download(slug)
    idx = RAW / f"by45_{slug}.nodeidx"

    def locs(o):
        pts = []
        for n in o.nodes:
            if n.location.valid():
                pts.append((n.location.lon, n.location.lat))
        return pts

    def centre(pts):
        if not pts:
            return None
        if len(pts) >= 4 and pts[0] == pts[-1]:
            p = Polygon(pts)
            c = p.centroid if p.is_valid and p.area > 0 else MultiPoint(pts).centroid
        elif len(pts) >= 2:
            c = LineString(pts).centroid
        else:
            return pts[0]
        return (c.x, c.y)

    # průchod 1: body, cesty (střed z obrysu), relace (jen seznam členských cest)
    els, places, rels, admins = [], [], [], []
    fp = (osmium.FileProcessor(str(pbf))
          .with_locations(f"sparse_file_array,{idx}")
          .with_filter(osmium.filter.EmptyTagFilter())
          .with_filter(osmium.filter.KeyFilter("wheelchair", "toilets:wheelchair", "amenity", "place", "boundary")))
    t0 = time.time()
    for o in fp:
        t = dict(o.tags)
        if o.is_node():
            if t.get("place") in PLACES and t.get("name"):
                places.append({"n": t["name"], "p": t["place"], "la": o.location.lat, "lo": o.location.lon})
            if wanted(t):
                els.append({"type": "node", "id": o.id, "tags": t, "lat": o.location.lat, "lon": o.location.lon, **meta(o)})
        elif o.is_way():
            if wanted(t):
                c = centre(locs(o))
                if c:
                    els.append({"type": "way", "id": o.id, "tags": t, "center": {"lat": c[1], "lon": c[0]}, **meta(o)})
        elif o.is_relation():
            if wanted(t):
                ways = [m.ref for m in o.members if m.type == "w" and m.role in ("outer", "")]
                rels.append({"type": "relation", "id": o.id, "tags": t, "ways": ways, **meta(o)})
            if is_admin8(t):
                admins.append({"id": o.id, "name": t["name"], "tags": {k: t[k] for k in ("name", "de:amtlicher_gemeindeschluessel",
                               "de:regionalschluessel", "official_name") if k in t},
                               "ways": [m.ref for m in o.members if m.type == "w" and m.role in ("outer", "")]})
    print(f"průchod 1: {len(els)} objektů, {len(rels)} relací, {len(admins)} obcí, {len(places)} sídel, {time.time() - t0:.0f} s", flush=True)

    # průchod 2: geometrie členských cest relací (místa + hranice obcí)
    need = {w for r in rels for w in r["ways"]} | {w for a in admins for w in a["ways"]}
    geom = {}
    fp = (osmium.FileProcessor(str(pbf))
          .with_locations(f"sparse_file_array,{idx}")
          .with_filter(osmium.filter.EntityFilter(osmium.osm.WAY))
          .with_filter(osmium.filter.IdFilter(need)))
    for o in fp:
        pts = locs(o)
        if len(pts) >= 2:
            geom[o.id] = [(round(x, 7), round(y, 7)) for x, y in pts]
    print(f"průchod 2: {len(geom)} z {len(need)} cest, {time.time() - t0:.0f} s", flush=True)
    try:
        idx.unlink()
    except OSError:
        pass

    from shapely.ops import polygonize, unary_union
    for r in rels:
        lines = [LineString(geom[w]) for w in r.pop("ways") if w in geom]
        if not lines:
            continue
        polys = list(polygonize(unary_union(lines)))
        c = unary_union(polys).centroid if polys else unary_union(lines).centroid
        r["center"] = {"lat": c.y, "lon": c.x}
        els.append(r)
    for a in admins:
        a["lines"] = [geom[w] for w in a.pop("ways") if w in geom]
    out.write_text(json.dumps({"source": f"Geofabrik {BEZIRKE[slug]['geofabrik']}-latest.osm.pbf, staženo {time.strftime('%Y-%m-%d')}",
                               "elements": els, "places": places, "admins": admins}, ensure_ascii=False), encoding="utf-8")
    print("uloženo", out.name, flush=True)
    pbf.unlink()
    print("smazán", pbf.name, flush=True)


# --- 2. převod do schématu webu ------------------------------------------------------------------
def bezirk_poly(rel_id):
    from shapely.geometry import LineString
    from shapely.ops import polygonize, unary_union
    for rel in json.loads((RAW / "by_bezirke.json").read_text(encoding="utf-8"))["elements"]:
        if rel["id"] == rel_id:
            lines = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]]) for m in rel["members"]
                     if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry")]
            return unary_union(list(polygonize(unary_union(lines))))
    raise KeyError(rel_id)


def wikidata_images(qids):
    """Wikidata P18 (obrázek) dávkově po 50, pauza 1 s. Vrací {Q: 'File:...'}."""
    res, qids = {}, sorted(qids)
    for i in range(0, len(qids), 50):
        ids = "|".join(qids[i:i + 50])
        url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(
            {"action": "wbgetentities", "ids": ids, "props": "claims", "format": "json"})
        for attempt in range(6):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                    data = json.loads(r.read().decode("utf-8"))
                break
            except Exception as e:
                print("  wikidata:", e, flush=True)
                ra = getattr(e, "headers", None) and e.headers.get("Retry-After")
                time.sleep(int(ra) if (ra or "").isdigit() else 15 * (attempt + 1))
        else:
            print("  wikidata: dávka vynechána", i, flush=True)
            continue
        for q, ent in (data.get("entities") or {}).items():
            for cl in (ent.get("claims") or {}).get("P18", []):
                v = (cl.get("mainsnak") or {}).get("datavalue", {}).get("value")
                if isinstance(v, str) and v:
                    res[q] = "File:" + v
                    break
        time.sleep(1)
    return res


def domain(url):
    u = url.strip()
    if "://" not in u:
        u = "http://" + u
    h = (urllib.parse.urlsplit(u).hostname or "").lower()
    return h[4:] if h.startswith("www.") else h


def build(slug):
    from shapely.geometry import LineString, Point
    from shapely.ops import polygonize, unary_union
    from shapely.prepared import prep
    from shapely.strtree import STRtree

    cfg = BEZIRKE[slug]
    src = json.loads((RAW / f"by45_{slug}.json").read_text(encoding="utf-8"))
    bz = prep(bezirk_poly(cfg["rel"]))

    # obce (Gemeinden) z hranic admin_level=8
    gnames, ggeoms = [], []
    for a in src["admins"]:
        polys = list(polygonize(unary_union([LineString(l) for l in a["lines"]]))) if a["lines"] else []
        if polys:
            gnames.append(a["name"])
            ggeoms.append(unary_union(polys))
    # kreisfreie Städte (Nürnberg, Würzburg…) jsou v OSM jen admin_level=6 – hranice z Overpass (out geom)
    kfs = RAW / f"by45_{slug}_kfs.json"
    if not kfs.exists():
        q = (f'[out:json][timeout:180];rel({cfg["rel"]});map_to_area->.a;'
             'rel[boundary=administrative][admin_level=6](area.a);out geom;')
        req = urllib.request.Request("https://overpass-api.de/api/interpreter",
                                     data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": UA})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=300) as r:
                    kfs.write_bytes(r.read())
                break
            except Exception as e:  # Overpass bývá přetížený (504/429)
                print("  overpass:", e, flush=True)
                time.sleep(30 * (attempt + 1))
        else:
            raise RuntimeError("Overpass nedostupný")
        time.sleep(1)
    for rel in json.loads(kfs.read_text(encoding="utf-8"))["elements"]:
        nm = (rel.get("tags") or {}).get("name", "")
        if not nm or nm.startswith("Landkreis") or nm in gnames:
            continue
        lines = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]]) for m in rel.get("members", [])
                 if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry")]
        polys = list(polygonize(unary_union(lines))) if lines else []
        if polys:
            gnames.append(nm)
            ggeoms.append(unary_union(polys))
            print("  kreisfreie Stadt:", nm, flush=True)
    gtree = STRtree(ggeoms)
    gprep = [prep(g) for g in ggeoms]
    pl = src["places"]
    ptree = STRtree([Point(p["lo"], p["la"]) for p in pl])
    big = [p for p in pl if p["p"] in ("city", "town")]
    btree = STRtree([Point(p["lo"], p["la"]) for p in big])
    print(f"{slug}: {len(gnames)} obcí s hranicí, {len(pl)} sídel", flush=True)

    def obec(lat, lng, t):
        pt = Point(lng, lat)
        for i in gtree.query(pt):
            if gprep[i].contains(pt):
                return gnames[i]
        if t.get("addr:city"):
            return t["addr:city"]
        i = btree.nearest(pt)
        if i is not None and math.dist((big[i]["lo"], big[i]["la"]), (lng, lat)) < 0.045:
            return big[i]["n"]
        return pl[ptree.nearest(pt)]["n"]

    out, seen = [], set()
    for e in src["elements"]:
        key = e["type"][0] + str(e["id"])
        if key in seen:
            continue
        seen.add(key)
        t = e.get("tags", {})
        cat, sub = classify(t)
        if not cat:
            continue
        lat = e.get("lat") or (e.get("center") or {}).get("lat")
        lng = e.get("lon") or (e.get("center") or {}).get("lon")
        if lat is None or not bz.contains(Point(lng, lat)):
            continue
        # --- odtud shodně s tools/build_data.py main() ---
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
        addr = " ".join(x for x in [t.get("addr:street") or t.get("addr:place"),
                                    t.get("addr:housenumber") or t.get("addr:conscriptionnumber")] if x)
        img = t.get("wikimedia_commons") if (t.get("wikimedia_commons") or "").startswith("File:") else None
        if not img and re.search(r"\.(jpe?g|png)$", t.get("image", ""), re.I) and "commons" in t.get("image", ""):
            img = "File:" + urllib.parse.unquote(t["image"].split("/")[-1])
        rec = {"i": key, "n": name, "c": cat, "s": sub, "la": round(lat, 6), "lo": round(lng, 6), "w": w, "t": wc,
               "o": obec(lat, lng, t), "k": cfg["cs"], "z": "de"}
        opt = {
            "a": addr or None,
            "d": t.get("wheelchair:description:cs") or t.get("wheelchair:description:de") or t.get("wheelchair:description") or None,
            "de": t.get("wheelchair:description:en") if not (t.get("wheelchair:description") or t.get("wheelchair:description:de")) else None,
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
            "u": e.get("timestamp") or None,
            "v": e.get("version"),
            "st": t.get("stars") or None,
            "op": t.get("operator") or None,
            "fee": t.get("fee") or None,
            "ek": "yes" if (t.get("centralkey") == "eurokey" or "euro" in (t.get("toilets:wheelchair:key") or "").lower()) else None,
            "cp": t.get("changing_table") or None,
            "_wd": t.get("wikidata") if re.fullmatch(r"Q\d+", t.get("wikidata", "")) else None,
        }
        rec.update({k2: v2 for k2, v2 in opt.items() if v2 is not None})
        out.append(rec)

    # fotky z Wikidata P18 pro místa bez wikimedia_commons
    qids = {r["_wd"] for r in out if "_wd" in r and "img" not in r}
    imgs = wikidata_images(qids) if qids else {}
    for r in out:
        q = r.pop("_wd", None)
        if q and "img" not in r and q in imgs:
            r["img"] = imgs[q]
    out.sort(key=lambda r: (r["o"], r["n"], r["i"]))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"places_{slug}.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # vstupy pro rešerše: jen s webem, bez řetězců (≥4 místa na stejné doméně), max 70
    dom = Counter(domain(r["web"]) for r in out if r.get("web"))
    chains = {d for d, n in dom.items() if n >= 4}
    RES.mkdir(parents=True, exist_ok=True)
    wrank = {"yes": 0, "limited": 1}

    def pick(cats, prefer_w):
        rows = [r for r in out if r["c"] in cats and r.get("web") and domain(r["web"]) not in chains]
        if prefer_w:
            rows.sort(key=lambda r: (wrank.get(r["w"], 2), "img" not in r, r["o"], r["n"]))
        else:
            rows.sort(key=lambda r: (r["w"] is None, -sum(k in r for k in ("a", "oh", "ph", "img")), r["o"], r["n"]))
        return [{k: r[k] for k in ("i", "n", "s", "c", "o", "k", "a", "web", "w", "la", "lo") if r.get(k) is not None}
                for r in rows[:70]]

    files = {}
    for name, cats, pref in (("ubytovani", {"ubytovani"}, True), ("cile", {"pamatky", "kultura", "sport", "priroda"}, True),
                             ("restaurace", {"restaurace"}, False)):
        rows = pick(cats, pref)
        p = RES / f"{slug}_{name}.json"
        p.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
        files[p.name] = len(rows)

    st = {"celkem": len(out), "w": dict(Counter(r["w"] for r in out)),
          "s_wc_infem": sum(1 for r in out if r.get("t")), "wc_mista": sum(1 for r in out if r["c"] == "wc"),
          "parkovani": sum(1 for r in out if r["c"] == "parkovani"), "s_fotkou": sum(1 for r in out if r.get("img")),
          "foto_z_wikidata": len(imgs), "kategorie": dict(Counter(r["c"] for r in out)),
          "obci": len({r["o"] for r in out}), "retezce_domeny": sorted(chains), "resers": files}
    print(json.dumps(st, ensure_ascii=False), flush=True)
    (RAW / f"by45_{slug}_stats.json").write_text(json.dumps(st, ensure_ascii=False, indent=1), encoding="utf-8")
    return st


if __name__ == "__main__":
    args = sys.argv[1:]
    if args == ["all"]:
        for s in BEZIRKE:
            extract(s)
            build(s)
    else:
        {"extract": extract, "build": build}[args[0]](args[1])
