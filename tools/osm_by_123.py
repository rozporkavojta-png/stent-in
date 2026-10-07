"""Místa s údaji o přístupnosti z OpenStreetMap pro tři bavorské vládní obvody:
Dolní Bavorsko (Niederbayern), Horní Falc (Oberpfalz), Horní Franky (Oberfranken).

Zdroj: extrakty Geofabrik (https://download.geofabrik.de/europe/germany/bayern/), data
© přispěvatelé OpenStreetMap, licence ODbL 1.0. Soubor .pbf se zpracuje proudově přes
pyosmium (polohy uzlů v dočasném indexu na disku), takže stačí málo paměti.

Výběr objektů = stejná kritéria jako tools/fetch_osm.py (dotazy QUERIES), převod do
schématu webu = stejný jako tools/build_data.py (classify, cm, mapování tagů) + "z":"de".
Obec (o) = obec (Gemeinde, admin_level=8) podle polohy (hranice z Overpass
data/raw/by_gemeinden_<rel>.json), jinak nejbližší uzel place=city|town|village|hamlet.
Fotky: tag wikimedia_commons / image (Commons), jinak Wikidata P18 (dávky po 50, pauza 1 s).

Spuštění:  python tools/osm_by_123.py dolni-bavorsko [horni-falc horni-franky] [--keep]
  (stáhne .pbf do data/raw/, zpracuje a smaže; --keep ho ponechá)
Výstup:   data/by/places_<slug>.json
          data/research/inputs_by/<slug>_ubytovani.json, <slug>_cile.json, <slug>_restaurace.json
"""
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

import osmium
from shapely.geometry import LineString, Point, Polygon, MultiPoint
from shapely.ops import polygonize, unary_union
from shapely.prepared import prep
from shapely.strtree import STRtree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_data import classify, cm  # noqa: E402  (stejné kategorie a převody jako ČR)

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
UA = "kudyprojedu-student-project/0.1 (VSTE Ceske Budejovice)"

BEZIRKE = {
    "dolni-bavorsko": {"de": "Niederbayern", "cs": "Dolní Bavorsko", "rel": 17593, "gf": "niederbayern"},
    "horni-falc": {"de": "Oberpfalz", "cs": "Horní Falc", "rel": 17596, "gf": "oberpfalz"},
    "horni-franky": {"de": "Oberfranken", "cs": "Horní Franky", "rel": 17592, "gf": "oberfranken"},
}

# ---- výběr: přesně podmínky dotazů z tools/fetch_osm.py ----
FOOD_CP = {"cafe", "ice_cream", "pub", "bar", "fast_food", "biergarten"}
LEISURE = {"park", "sports_centre", "swimming_pool", "stadium", "nature_reserve", "garden", "water_park", "ice_rink"}
SHOP = {"supermarket", "mall", "department_store", "bakery", "chemist", "optician", "medical_supply"}
PUBLIC = {"toilets", "pharmacy", "townhall", "library", "theatre", "cinema", "arts_centre", "community_centre", "hospital",
          "clinic", "doctors", "dentist", "post_office", "bank", "police", "courthouse", "marketplace", "bus_station",
          "university", "college"}


def wanted(t):
    am = t.get("amenity")
    if "wheelchair" in t:
        if am in FOOD_CP or am in PUBLIC or am == "restaurant":
            return True
        if "historic" in t or "tourism" in t:
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


def rel_polygon(rel):
    lines = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]]) for m in rel.get("members", [])
             if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry") and len(m["geometry"]) > 1]
    return unary_union(list(polygonize(unary_union(lines))))


def bezirk_polygon(rel_id):
    for rel in json.loads((RAW / "by_bezirke.json").read_text(encoding="utf-8"))["elements"]:
        if rel["id"] == rel_id:
            return rel_polygon(rel)
    raise SystemExit(f"obvod {rel_id} chybí v by_bezirke.json")


def load_gemeinden(rel_id):
    p = RAW / f"by_gemeinden_{rel_id}.json"
    if not p.exists():
        print("  hranice obcí chybí – obec jen z nejbližšího sídla", flush=True)
        return None
    names, geoms = [], []
    els = json.loads(p.read_text(encoding="utf-8"))["elements"]
    if not any(rel.get("members") for rel in els):
        print("  hranice obcí v souboru bez geometrie – použiji hranice z .pbf", flush=True)
        return None
    for rel in els:
        t = rel.get("tags", {})
        if t.get("boundary") != "administrative" or t.get("admin_level") != "8" or not t.get("name"):
            continue
        g = rel_polygon(rel)
        if g.is_empty:
            continue
        names.append(t["name"])
        geoms.append(g)
    print(f"  obce (hranice): {len(names)}", flush=True)
    return names, [prep(g) for g in geoms], STRtree(geoms)


def centroid(coords):
    if not coords:
        return None
    if len(coords) >= 4 and coords[0] == coords[-1]:
        poly = Polygon(coords)
        if poly.is_valid and poly.area > 0:
            c = poly.centroid
            return c.y, c.x
    c = MultiPoint(coords).centroid if len(coords) > 1 else Point(coords[0])
    return c.y, c.x


class Pass1(osmium.SimpleHandler):
    """Uzly, cesty a relace splňující výběr + sídla pro záložní obec."""

    def __init__(self):
        super().__init__()
        self.els = {}      # klíč -> dict(tags, lat, lon, ts, v)
        self.rels = {}     # klíč -> (dict, [ids cest outer], [ids cest ostatních])
        self.settl = []    # (name, place, lat, lon)
        self.gem = []      # obce admin_level=8 z .pbf: (name, [ids cest outer])

    def node(self, n):
        t = n.tags
        if not t:
            return
        pl = t.get("place")
        if pl in ("city", "town", "village", "hamlet") and t.get("name") and n.location.valid():
            self.settl.append((t["name"], pl, n.location.lat, n.location.lon))
        if not wanted(t):
            return
        if not n.location.valid():
            return
        self.els["n" + str(n.id)] = {"tags": dict(t), "lat": n.location.lat, "lon": n.location.lon,
                                     "ts": n.timestamp.strftime("%Y-%m-%d") if n.timestamp else None, "v": n.version}

    def way(self, w):
        t = w.tags
        if not t or not wanted(t):
            return
        coords = []
        for nd in w.nodes:
            if nd.location.valid():
                coords.append((nd.location.lon, nd.location.lat))
        c = centroid(coords)
        if not c:
            return
        self.els["w" + str(w.id)] = {"tags": dict(t), "lat": c[0], "lon": c[1],
                                     "ts": w.timestamp.strftime("%Y-%m-%d") if w.timestamp else None, "v": w.version}

    def relation(self, r):
        t = r.tags
        if t and t.get("boundary") == "administrative" and t.get("admin_level") == "8" and t.get("name"):
            self.gem.append((t["name"], [m.ref for m in r.members if m.type == "w" and m.role in ("outer", "")]))
        if not t or not wanted(t):
            return
        outer, other = [], []
        for m in r.members:
            if m.type == "w":
                (outer if m.role in ("outer", "") else other).append(m.ref)
        self.rels["r" + str(r.id)] = ({"tags": dict(t), "ts": r.timestamp.strftime("%Y-%m-%d") if r.timestamp else None,
                                       "v": r.version}, outer, other)


class Pass2(osmium.SimpleHandler):
    """Souřadnice členských cest relací (pro střed relace)."""

    def __init__(self, ids):
        super().__init__()
        self.ids = ids
        self.geom = {}

    def way(self, w):
        if w.id in self.ids:
            self.geom[w.id] = [(nd.location.lon, nd.location.lat) for nd in w.nodes if nd.location.valid()]


def rel_center(outer, other, geom):
    lines = [LineString(geom[i]) for i in outer if len(geom.get(i, [])) > 1]
    if lines:
        polys = list(polygonize(unary_union(lines)))
        if polys:
            c = unary_union(polys).centroid
            return c.y, c.x
    pts = [p for i in outer + other for p in geom.get(i, [])]
    return centroid(pts) if pts else None


def wikidata_p18(qids):
    """Wikidata wbgetentities, dávky po 50, pauza 1 s → {Q: 'File:…'}."""
    out = {}
    qids = sorted(q for q in qids if re.fullmatch(r"Q\d+", q))
    for i in range(0, len(qids), 50):
        chunk = qids[i:i + 50]
        url = ("https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids="
               + urllib.parse.quote("|".join(chunk)))
        for attempt in range(6):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = json.loads(r.read().decode("utf-8"))
                break
            except Exception as e:
                ra = getattr(e, "headers", None) and e.headers.get("Retry-After")
                wait = int(ra) if (ra or "").isdigit() else 15 * (attempt + 1)
                print(f"  wikidata chyba: {e} (čekám {wait} s)", flush=True)
                time.sleep(wait)
        else:
            continue
        for q, ent in data.get("entities", {}).items():
            for cl in ent.get("claims", {}).get("P18", []):
                v = cl.get("mainsnak", {}).get("datavalue", {}).get("value")
                if isinstance(v, str) and v:
                    out[q] = "File:" + v
                    break
        time.sleep(1)
    return out


def to_record(key, e, sub_cat, o, k):
    """Převod podle tools/build_data.py main(); vrací None, když místo nesplní podmínky."""
    t = e["tags"]
    cat, sub = sub_cat
    lat, lng = e["lat"], e["lon"]
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
            return None
        name = sub
    cap_dis = t.get("capacity:disabled")
    if cat == "parkovani":
        if sub == "Parkovací místo ZTP":
            cap_dis = cap_dis or "1"
        if not cap_dis or not cap_dis.isdigit() or cap_dis == "0":
            if not (cap_dis and cap_dis in ("yes",)):
                return None
    if w is None and wc is None and cat != "parkovani":
        return None
    addr = " ".join(x for x in [t.get("addr:street") or t.get("addr:place"),
                                t.get("addr:housenumber") or t.get("addr:conscriptionnumber")] if x)
    img = t.get("wikimedia_commons") if (t.get("wikimedia_commons") or "").startswith("File:") else None
    if not img and re.search(r"\.(jpe?g|png)$", t.get("image", ""), re.I) and "commons" in t.get("image", ""):
        img = "File:" + urllib.parse.unquote(t["image"].split("/")[-1])
    rec = {"i": key, "n": name, "c": cat, "s": sub, "la": round(lat, 6), "lo": round(lng, 6),
           "w": w, "t": wc, "o": o, "k": k}
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
        "u": e.get("ts"),
        "v": e.get("v"),
        "st": t.get("stars") or None,
        "op": t.get("operator") or None,
        "fee": t.get("fee") or None,
        "ek": "yes" if (t.get("centralkey") == "eurokey" or "euro" in (t.get("toilets:wheelchair:key") or "").lower()) else None,
        "cp": t.get("changing_table") or None,
    }
    rec.update({k2: v2 for k2, v2 in opt.items() if v2 is not None})
    rec["z"] = "de"
    return rec


SOCIAL = ("facebook.com", "instagram.com", "linktr.ee", "google.com", "goo.gl", "tripadvisor", "booking.com")


def domain(url):
    u = url.strip()
    if not re.match(r"^https?://", u, re.I):
        u = "http://" + u
    host = (urllib.parse.urlsplit(u).hostname or "").lower()
    host = re.sub(r"^(www\d?|m)\.", "", host)
    if any(s in host for s in SOCIAL):
        return host + urllib.parse.urlsplit(u).path.rstrip("/").lower()  # stránka na sociální síti ≠ řetězec
    return host


def research_inputs(slug, recs):
    dom = Counter(domain(r["web"]) for r in recs if r.get("web"))
    chain = {d for d, n in dom.items() if n >= 4}
    groups = {"ubytovani": ("ubytovani",), "cile": ("pamatky", "kultura", "sport", "priroda"), "restaurace": ("restaurace",)}
    rank = {"yes": 0, "limited": 1}
    outdir = ROOT / "data" / "research" / "inputs_by"
    outdir.mkdir(parents=True, exist_ok=True)
    res = {}
    for g, cats in groups.items():
        sel = [r for r in recs if r["c"] in cats and r.get("web") and domain(r["web"]) not in chain]
        sel.sort(key=lambda r: (rank.get(r["w"], 2), r["o"], r["n"]))
        sel = sel[:70]
        sel.sort(key=lambda r: (r["o"], r["n"]))
        rows = []
        for r in sel:
            row = {"i": r["i"], "n": r["n"], "c": r["c"], "s": r["s"], "o": r["o"], "k": r["k"]}
            if r.get("a"):
                row["a"] = r["a"]
            row.update({"web": r["web"], "w": r["w"], "la": r["la"], "lo": r["lo"], "z": "de"})
            rows.append(row)
        p = outdir / f"{slug}_{g}.json"
        p.write_text(json.dumps(rows, ensure_ascii=False, indent=0), encoding="utf-8")
        res[g] = (len(rows), sum(1 for r in rows if r["w"] in ("yes", "limited")))
    return res, sorted(chain)


def process(slug, keep=False):
    info = BEZIRKE[slug]
    pbf = RAW / f"{info['gf']}-latest.osm.pbf"
    if not pbf.exists():
        url = f"https://download.geofabrik.de/europe/germany/bayern/{info['gf']}-latest.osm.pbf"
        print(f"stahuji {url}", flush=True)
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=600) as r, open(pbf, "wb") as f:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
    idx = RAW / f"{info['gf']}.nodecache"
    print(f"{info['de']}: průchod 1 ({pbf.stat().st_size // 1_000_000} MB)", flush=True)
    h1 = Pass1()
    h1.apply_file(str(pbf), locations=True, idx=f"sparse_file_array,{idx}")
    need = {i for _, o, x in h1.rels.values() for i in o + x} | {i for _, o in h1.gem for i in o}
    print(f"  uzly+cesty: {len(h1.els)}, relace: {len(h1.rels)}, sídla: {len(h1.settl)}; průchod 2 ({len(need)} cest)", flush=True)
    h2 = Pass2(need)
    h2.apply_file(str(pbf), locations=True, idx=f"sparse_file_array,{idx}")
    for key, (e, outer, other) in h1.rels.items():
        c = rel_center(outer, other, h2.geom)
        if c:
            e["lat"], e["lon"] = c
            h1.els[key] = e
    pbf_gem = []
    for name, outer in h1.gem:
        lines = [LineString(h2.geom[i]) for i in outer if len(h2.geom.get(i, [])) > 1]
        if lines:
            g = unary_union(list(polygonize(unary_union(lines))))
            if not g.is_empty:
                pbf_gem.append((name, g))
    del h2
    try:
        idx.unlink()
    except OSError:
        pass

    bz = prep(bezirk_polygon(info["rel"]))
    gem = load_gemeinden(info["rel"])
    if gem is None and pbf_gem:
        geoms = [g for _, g in pbf_gem]
        gem = ([n for n, _ in pbf_gem], [prep(g) for g in geoms], STRtree(geoms))
        print(f"  obce (hranice z .pbf): {len(geoms)}", flush=True)
    settl = h1.settl
    stree = STRtree([Point(s[3], s[2]) for s in settl]) if settl else None

    def obec(lat, lng):
        pt = Point(lng, lat)
        if gem:
            names, preps, tree = gem
            for i in tree.query(pt):
                if preps[i].contains(pt):
                    return names[i]
        if stree is not None:
            return settl[stree.nearest(pt)][0]
        return ""

    recs = []
    for key, e in h1.els.items():
        sc = classify(e["tags"])
        if not sc[0] or e.get("lat") is None:
            continue
        if not bz.contains(Point(e["lon"], e["lat"])):
            continue
        r = to_record(key, e, sc, obec(e["lat"], e["lon"]), info["cs"])
        if r:
            r["_wd"] = e["tags"].get("wikidata")
            recs.append(r)

    # fotky z Wikidata (P18) jen tam, kde nejsou z Commons tagů
    qids = {r["_wd"] for r in recs if r.get("_wd") and not r.get("img")}
    p18 = wikidata_p18(qids) if qids else {}
    for r in recs:
        q = r.pop("_wd", None)
        if not r.get("img") and q in p18:
            r["img"] = p18[q]
    # stejné pořadí klíčů jako places.json: img za oh
    order = ["i", "n", "c", "s", "la", "lo", "w", "t", "o", "k", "a", "d", "de", "sc", "rp", "dw", "pk", "pw", "web",
             "ph", "oh", "img", "cd", "u", "v", "st", "op", "fee", "ek", "cp", "z"]
    recs = [{k2: r[k2] for k2 in order if k2 in r} for r in recs]
    recs.sort(key=lambda r: (r["o"], r["n"], r["i"]))

    outdir = ROOT / "data" / "by"
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / f"places_{slug}.json").write_text(json.dumps(recs, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    res, chain = research_inputs(slug, recs)

    w = Counter(r["w"] for r in recs)
    st = {"celkem": len(recs), "yes": w["yes"], "limited": w["limited"], "no": w["no"], "bez_w": w[None],
          "wc": sum(1 for r in recs if r["c"] == "wc"), "t_yes": sum(1 for r in recs if r["t"] == "yes"),
          "parkovani": sum(1 for r in recs if r["c"] == "parkovani"), "foto": sum(1 for r in recs if r.get("img")),
          "foto_wikidata": len(p18), "kategorie": dict(Counter(r["c"] for r in recs)), "research": res,
          "retezce": chain[:30]}
    print(json.dumps({slug: st}, ensure_ascii=False), flush=True)
    del h1
    import gc
    gc.collect()
    try:
        idx.unlink(missing_ok=True)  # dočasný index uzlů (při prvním pokusu může být ještě zamčený)
    except OSError:
        pass
    if not keep:
        pbf.unlink()
    return st


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    for s in args or list(BEZIRKE):
        process(s, keep="--keep" in sys.argv)
