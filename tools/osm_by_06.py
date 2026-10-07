"""Místa s údaji o přístupnosti z OpenStreetMap pro vládní obvody Horní Bavorsko a Švábsko.

Zdroj: extrakty Geofabrik (https://download.geofabrik.de/europe/germany/bayern/<obvod>-latest.osm.pbf),
data © přispěvatelé OpenStreetMap, licence ODbL 1.0. Fotky: Wikidata (P18) a tag wikimedia_commons.

Postup šetrný k paměti – po obvodech:
  1. stáhne .pbf do data/raw/ (pokud tam ještě není),
  2. průchod A (jen relace): vybrané relace + hranice obcí (admin_level=8) → seznam potřebných cest,
  3. průchod B (uzly + cesty, polohy v souborovém indexu sparse_file_array): výběr míst stejnými
     kritérii jako tools/fetch_osm.py, středy ploch z obrysu, geometrie hranic obcí, sídla (place=*),
  4. převod na schéma data/places.json (stejná pravidla jako tools/build_data.py) + "z":"de",
  5. fotky z Wikidata (P18, dávky po 50, pauza 1 s), smaže .pbf a index.

  python tools/osm_by_06.py [horni-bavorsko] [svabsko]
  python tools/osm_by_06.py fix-obce [slug…]   – jen doplní obce kreisfreie Städte do hotového výstupu

Výstup: data/by/places_<slug>.json, data/research/inputs_by/<slug>_{ubytovani,cile,restaurace}.json
"""
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

import osmium
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import polygonize, unary_union
from shapely.prepared import prep
from shapely.strtree import STRtree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_data import classify, cm  # noqa: E402  (stejné kategorie a převod rozměrů jako ČR)

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "by"
RES = ROOT / "data" / "research" / "inputs_by"
UA = "kudyprojedu-student-project/0.1 (VSTE Ceske Budejovice)"

OBVODY = {
    "horni-bavorsko": {"geo": "oberbayern", "rel": 2145274, "k": "Horní Bavorsko"},
    "svabsko": {"geo": "schwaben", "rel": 17657, "k": "Švábsko"},
}

# stejné filtry jako QUERIES v tools/fetch_osm.py
FOOD = {"cafe", "ice_cream", "pub", "bar", "fast_food", "biergarten", "restaurant"}
LEISURE = {"park", "sports_centre", "swimming_pool", "stadium", "nature_reserve", "garden", "water_park", "ice_rink"}
SHOP = {"supermarket", "mall", "department_store", "bakery", "chemist", "optician", "medical_supply"}
PUBLIC = {"toilets", "pharmacy", "townhall", "library", "theatre", "cinema", "arts_centre", "community_centre", "hospital",
          "clinic", "doctors", "dentist", "post_office", "bank", "police", "courthouse", "marketplace", "bus_station",
          "university", "college"}
SETTL = {"city", "town", "village", "hamlet"}


def wanted(t):
    am = t.get("amenity")
    if "wheelchair" in t:
        if am in FOOD or am in PUBLIC or "historic" in t or "tourism" in t:
            return True
        if t.get("leisure") in LEISURE or t.get("railway") == "station" or t.get("office") == "government":
            return True
        if t.get("shop") in SHOP and "name" in t:
            return True
    if am == "toilets" and "toilets:wheelchair" in t:
        return True
    if t.get("toilets:wheelchair") == "yes" and "name" in t:
        return True
    if am == "parking" and "capacity:disabled" in t:
        return True
    if am == "parking_space" and t.get("parking_space") == "disabled":
        return True
    return False


def tags(o):
    return {tg.k: tg.v for tg in o.tags}


def meta(o):
    ts = o.timestamp
    return {"timestamp": ts.strftime("%Y-%m-%d") if ts and ts.year > 1970 else None, "version": o.version or None}


def way_center(coords):
    if len(coords) >= 4 and coords[0] == coords[-1]:
        pg = Polygon(coords)
        if pg.is_valid and pg.area > 0:
            c = pg.centroid
            return c.y, c.x
    if len(coords) >= 2:
        c = LineString(coords).centroid
        return c.y, c.x
    if coords:
        return coords[0][1], coords[0][0]
    return None


def bezirk_poly(rel_id):
    for rel in json.loads((RAW / "by_bezirke.json").read_text(encoding="utf-8"))["elements"]:
        if rel["id"] == rel_id:
            lines = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]]) for m in rel["members"]
                     if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry")]
            return unary_union(list(polygonize(unary_union(lines))))
    raise SystemExit(f"obvod {rel_id} není v by_bezirke.json")


def download(geo):
    pbf = RAW / f"{geo}-latest.osm.pbf"
    if not pbf.exists() or pbf.stat().st_size < 1_000_000:
        url = f"https://download.geofabrik.de/europe/germany/bayern/{geo}-latest.osm.pbf"
        print("stahuji", url, flush=True)
        tmp = pbf.with_suffix(".part")
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "wb") as f:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
        tmp.replace(pbf)
    return pbf


def read_osm(pbf):
    """Vrací (elements, gemeinden [(name, polygon)], settlements [(name, lat, lon)])."""
    t0 = time.time()
    rels, gem_rels, need_ways = {}, {}, set()
    for o in osmium.FileProcessor(str(pbf), osmium.osm.RELATION):
        t = tags(o)
        is_gem = t.get("boundary") == "administrative" and t.get("admin_level") == "8" and t.get("name")
        is_poi = wanted(t)
        if not (is_gem or is_poi):
            continue
        mem = [(m.ref, m.role) for m in o.members if m.type == "w"]
        if is_gem:
            gem_rels[o.id] = (t["name"], [r for r, role in mem if role in ("outer", "")])
            need_ways.update(gem_rels[o.id][1])
        if is_poi:
            rels[o.id] = {"tags": t, "ways": mem, **meta(o)}
            need_ways.update(r for r, _ in mem)
    print(f"  průchod A: {len(rels)} relací, {len(gem_rels)} obcí, {len(need_ways)} cest ({time.time() - t0:.0f} s)", flush=True)

    idx = RAW / f"{pbf.stem}.nodeidx"
    elements, way_geom, settl = {}, {}, []
    fp = osmium.FileProcessor(str(pbf), osmium.osm.NODE | osmium.osm.WAY).with_locations(f"sparse_file_array,{idx}")
    for o in fp:
        if o.is_node():
            if not len(o.tags):
                continue
            t = tags(o)
            if t.get("place") in SETTL and t.get("name"):
                settl.append((t["name"], o.location.lat, o.location.lon))
            if wanted(t) and o.location.valid():
                elements["n" + str(o.id)] = {"tags": t, "lat": o.location.lat, "lon": o.location.lon, **meta(o)}
        else:
            need = o.id in need_ways
            if not need and not len(o.tags):
                continue
            t = tags(o) if len(o.tags) else {}
            poi = bool(t) and wanted(t)
            if not (need or poi):
                continue
            try:
                coords = [(n.lon, n.lat) for n in o.nodes if n.location.valid()]
            except osmium.InvalidLocationError:
                coords = []
            if need:
                way_geom[o.id] = coords
            if poi:
                c = way_center(coords)
                if c:
                    elements["w" + str(o.id)] = {"tags": t, "lat": c[0], "lon": c[1], **meta(o)}
    fp = o = None  # uvolní soubor indexu (smaže se v run())
    print(f"  průchod B: {len(elements)} uzlů/cest, {len(settl)} sídel ({time.time() - t0:.0f} s)", flush=True)

    def rel_shape(ways):
        lines = [LineString(way_geom[w]) for w in ways if len(way_geom.get(w) or []) >= 2]
        if not lines:
            return None
        polys = list(polygonize(unary_union(lines)))
        return unary_union(polys) if polys else None

    for rid, r in rels.items():
        outer = [w for w, role in r["ways"] if role in ("outer", "")] or [w for w, _ in r["ways"]]
        shp = rel_shape(outer)
        if shp is not None and not shp.is_empty:
            c = shp.centroid
            lat, lon = c.y, c.x
        else:
            pts = [p for w, _ in r["ways"] for p in (way_geom.get(w) or [])]
            if not pts:
                continue
            lon, lat = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
        elements["r" + str(rid)] = {"tags": r["tags"], "lat": lat, "lon": lon, "timestamp": r["timestamp"], "version": r["version"]}

    gemeinden = []
    for name, ways in gem_rels.values():
        shp = rel_shape(ways)
        if shp is not None and not shp.is_empty:
            gemeinden.append((name, shp))
    print(f"  relace hotové: {len(elements)} prvků, {len(gemeinden)} obcí s hranicí ({time.time() - t0:.0f} s)", flush=True)
    return elements, gemeinden, settl


def kreisfreie_staedte(slug, rel_id):
    """Kreisfreie Städte (München, Augsburg, Ingolstadt, Rosenheim, Kempten…) mají v OSM jen admin_level=6,
    ne admin_level=8 – jejich hranice se stáhnou z Overpass (out geom) a uloží do data/raw/."""
    f = RAW / f"by06_{slug}_kfs.json"
    if not f.exists():
        q = (f"[out:json][timeout:180];rel({rel_id});map_to_area->.a;"
             "rel[boundary=administrative][admin_level=6](area.a);out geom;")
        req = urllib.request.Request("https://overpass-api.de/api/interpreter",
                                     data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": UA})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=300) as r:
                    f.write_bytes(r.read())
                break
            except Exception as ex:  # Overpass bývá přetížený (429/504)
                print("  overpass:", ex, flush=True)
                time.sleep(30 * (attempt + 1))
        else:
            raise RuntimeError("Overpass nedostupný")
        time.sleep(1)
    out = []
    for rel in json.loads(f.read_text(encoding="utf-8"))["elements"]:
        nm = (rel.get("tags") or {}).get("name", "")
        if not nm or nm.startswith("Landkreis"):
            continue
        lines = [LineString([(q["lon"], q["lat"]) for q in m["geometry"]]) for m in rel.get("members", [])
                 if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry")]
        polys = list(polygonize(unary_union(lines))) if lines else []
        if polys:
            out.append((nm, unary_union(polys)))
    print("  kreisfreie Städte:", ", ".join(n for n, _ in out), flush=True)
    return out


def convert(elements, gemeinden, settl, poly, kname):
    border = prep(poly)
    g_geoms = [g for _, g in gemeinden]
    g_tree = STRtree(g_geoms) if g_geoms else None
    s_tree = STRtree([Point(s[2], s[1]) for s in settl]) if settl else None

    def obec(lat, lng, t):
        pt = Point(lng, lat)
        if g_tree is not None:
            for i in g_tree.query(pt):
                if g_geoms[i].contains(pt):
                    return gemeinden[i][0]
        if t.get("addr:city"):
            return t["addr:city"]
        if s_tree is not None:
            return settl[s_tree.nearest(pt)][0]
        return ""

    out = []
    for key, e in elements.items():
        t = e["tags"]
        cat, sub = classify(t)
        if not cat:
            continue
        lat, lng = e["lat"], e["lon"]
        if not border.contains(Point(lng, lat)):
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
        addr = " ".join(x for x in [t.get("addr:street") or t.get("addr:place"), t.get("addr:housenumber")] if x)
        img = t.get("wikimedia_commons") if (t.get("wikimedia_commons") or "").startswith("File:") else None
        if not img and re.search(r"\.(jpe?g|png)$", t.get("image", ""), re.I) and "commons" in t.get("image", ""):
            img = "File:" + urllib.parse.unquote(t["image"].split("/")[-1])
        rec = {"i": key, "n": name, "c": cat, "s": sub, "la": round(lat, 6), "lo": round(lng, 6), "w": w, "t": wc,
               "o": obec(lat, lng, t), "k": kname, "z": "de"}
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
            "u": e.get("timestamp"),
            "v": e.get("version"),
            "st": t.get("stars") or None,
            "op": t.get("operator") or None,
            "fee": t.get("fee") or None,
            "ek": "yes" if (t.get("centralkey") == "eurokey" or "euro" in (t.get("toilets:wheelchair:key") or "").lower()) else None,
            "cp": t.get("changing_table") or None,
        }
        rec.update({k2: v2 for k2, v2 in opt.items() if v2 is not None})
        if not img and re.fullmatch(r"Q\d+", t.get("wikidata", "")):
            rec["_wd"] = t["wikidata"]
        out.append(rec)
    return out


def wikidata_photos(places):
    todo = sorted({p["_wd"] for p in places if "_wd" in p})
    found = {}
    for i in range(0, len(todo), 50):
        ids = "|".join(todo[i:i + 50])
        url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(
            {"action": "wbgetentities", "ids": ids, "props": "claims", "format": "json"})
        for attempt in range(6):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = json.loads(r.read().decode("utf-8"))
                break
            except Exception as ex:
                ra = getattr(ex, "headers", None) and ex.headers.get("Retry-After")
                wait = int(ra) if (ra or "").isdigit() else 10 * (attempt + 1)
                print(f"   wikidata: {ex} – čekám {wait} s", flush=True)
                time.sleep(wait)
        else:
            print(f"   wikidata: dávka {i // 50 + 1} vynechána", flush=True)
            continue
        for qid, ent in (data.get("entities") or {}).items():
            for cl in (ent.get("claims") or {}).get("P18", []):
                v = ((cl.get("mainsnak") or {}).get("datavalue") or {}).get("value")
                if isinstance(v, str):
                    found[qid] = "File:" + v
                    break
        time.sleep(1)
    for p in places:
        q = p.pop("_wd", None)
        if q and q in found:
            p["img"] = found[q]
    print(f"  wikidata: {len(todo)} položek, {len(found)} s fotkou", flush=True)


def domain(u):
    try:
        net = urllib.parse.urlparse(u if "://" in u else "http://" + u).netloc.lower()
    except ValueError:
        return ""
    return net[4:] if net.startswith("www.") else net


def research(places, slug):
    RES.mkdir(parents=True, exist_ok=True)
    dom = Counter(domain(p["web"]) for p in places if p.get("web"))
    chain = {d for d, n in dom.items() if n >= 4}
    groups = {"ubytovani": ({"ubytovani"}, True), "cile": ({"pamatky", "kultura", "sport", "priroda"}, True),
              "restaurace": ({"restaurace"}, False)}
    counts = {}
    for name, (cats, prefer) in groups.items():
        cand = [p for p in places if p["c"] in cats and p.get("web") and domain(p["web"]) not in chain]
        # pořadí: (u ubytování a cílů) nejdřív wheelchair=yes/limited, pak rovnoměrně napříč obcemi
        rank = (lambda p: 0 if p["w"] in ("yes", "limited") else 1) if prefer else (lambda p: 0)
        tiers = defaultdict(lambda: defaultdict(list))
        for p in sorted(cand, key=lambda p: (p["n"], p["i"])):
            tiers[rank(p)][p["o"]].append(p)
        pick = []
        for r in sorted(tiers):
            by_o = tiers[r]
            while by_o and len(pick) < 70:
                for o in sorted(list(by_o), key=lambda o: (-len(by_o[o]), o)):
                    pick.append(by_o[o].pop(0))
                    if not by_o[o]:
                        del by_o[o]
                    if len(pick) >= 70:
                        break
        keys = ("i", "n", "s", "c", "o", "k", "a", "web", "w", "t", "la", "lo")
        rows = [{k: p[k] for k in keys if p.get(k) is not None} for p in pick]
        (RES / f"{slug}_{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
        counts[name] = len(rows)
    return counts


def run(slug):
    cfg = OBVODY[slug]
    print(f"== {cfg['k']} ({slug})", flush=True)
    poly = bezirk_poly(cfg["rel"])
    pbf = download(cfg["geo"])
    elements, gemeinden, settl = read_osm(pbf)
    gemeinden += kreisfreie_staedte(slug, cfg["rel"])
    places = convert(elements, gemeinden, settl, poly, cfg["k"])
    del elements
    wikidata_photos(places)
    stats = finish(places, slug)
    pbf.unlink()
    (RAW / f"{pbf.stem}.nodeidx").unlink(missing_ok=True)
    return stats


def finish(places, slug):
    places.sort(key=lambda r: (r["o"], r["n"], r["i"]))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"places_{slug}.json").write_text(json.dumps(places, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    res = research(places, slug)
    w = Counter(p["w"] for p in places)
    stats = {"celkem": len(places), "w_yes": w["yes"], "w_limited": w["limited"], "w_no": w["no"],
             "s_wc": sum(1 for p in places if p.get("t") in ("yes", "limited")),
             "parkovani": sum(1 for p in places if p["c"] == "parkovani"),
             "s_fotkou": sum(1 for p in places if p.get("img")), "kategorie": dict(Counter(p["c"] for p in places)),
             "obci": len({p["o"] for p in places}), "bez_obce": sum(1 for p in places if not p["o"]), "research": res}
    print(json.dumps(stats, ensure_ascii=False), flush=True)
    return stats


def fix_obce(slug):
    """Dodatečná oprava hotového výstupu: místa uvnitř kreisfreie Stadt dostanou obec podle její hranice
    (dřív spadla na nejbližší sídlo). Pak znovu vstupy pro rešerše a statistiky."""
    cfg = OBVODY[slug]
    f = OUT / f"places_{slug}.json"
    places = json.loads(f.read_text(encoding="utf-8"))
    kfs = kreisfreie_staedte(slug, cfg["rel"])
    geoms = [g for _, g in kfs]
    tree = STRtree(geoms)
    n = 0
    for p in places:
        pt = Point(p["lo"], p["la"])
        for i in tree.query(pt):
            if geoms[i].contains(pt):
                if p["o"] != kfs[i][0]:
                    p["o"] = kfs[i][0]
                    n += 1
                break
    print(f"  {slug}: opraveno {n} obcí", flush=True)
    return finish(places, slug)


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["fix-obce"]:
        for s in (args[1:] or list(OBVODY)):
            fix_obce(s)
    else:
        for s in (args or list(OBVODY)):
            run(s)
