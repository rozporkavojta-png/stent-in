"""Bezbariérové / sjízdné trasy v Česku – krok 2: geometrie, povrchy, okolí, výškový profil -> data/trasy/trasy_cz.json

  python tools/trasy_cz_build.py

Vstup: data/raw/trasy_cz/<extrakt>.json (tools/trasy_cz_extract.py), data/raw/kraje_gh.json (hranice krajů ČR),
       data/raw/by_bezirke.json (vládní obvody Bavorska – pro trasy začínající za hranicí).
Výšky: OpenTopoData, dataset eudem25m (EU-DEM v1.1, Copernicus Land Monitoring Service, © Evropská unie),
       záložně Open-Meteo Elevation API (Copernicus DEM GLO-90, CC BY 4.0). Cache: data/raw/trasy_cz/elev_cache.json.
Projekce pro délky a vzdálenosti: ETRS89 / UTM 33N (EPSG:25833).
"""
import json
import math
import re
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import LineString, MultiLineString, Point
from shapely.ops import linemerge, polygonize, unary_union
from shapely.strtree import STRtree
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "trasy_cz"
OUT = ROOT / "data" / "trasy"
OUT.mkdir(parents=True, exist_ok=True)
UA = "kudyprojedu.cz student project (accessibility map)"
FWD = Transformer.from_crs("EPSG:4326", "EPSG:25833", always_xy=True)
INV = Transformer.from_crs("EPSG:25833", "EPSG:4326", always_xy=True)
MAX_ROUTES = 300
STEP = 50.0          # rozestup bodů výškového profilu (m)
MAX_SAMPLES = 1500   # strop bodů na trasu (delší trasy -> větší rozestup)
SKIP_ROLES = {"alternative", "excursion", "approach", "connection", "link", "guidepost", "start", "stop", "platform"}

SURF = {"asphalt": "asfalt", "paved": "zpevněný (nespecifikováno)", "concrete": "beton", "concrete:plates": "beton",
        "concrete:lanes": "beton", "paving_stones": "dlažba", "sett": "dlažba (kostky)", "cobblestone": "dlažba (kostky)",
        "unhewn_cobblestone": "dlažba (kostky)", "compacted": "zhutněný štěrk (mlat)", "fine_gravel": "jemný štěrk",
        "gravel": "štěrk", "pebblestone": "štěrk", "rock": "kámen/skála", "ground": "hlína", "dirt": "hlína",
        "earth": "hlína", "mud": "bláto", "grass": "tráva", "grass_paver": "zatravňovací dlažba", "sand": "písek",
        "wood": "dřevo", "metal": "kov", "unpaved": "nezpevněný (nespecifikováno)", "woodchips": "štěpka",
        "tartan": "tartan", "artificial_turf": "umělý trávník", "rubber": "pryž"}


def proj_line(lonlat):
    xs, ys = FWD.transform([p[0] for p in lonlat], [p[1] for p in lonlat])
    return list(zip(xs, ys))


def to_latlng(coords, nd=6):
    lons, lats = INV.transform([c[0] for c in coords], [c[1] for c in coords])
    return [[round(la, nd), round(lo, nd)] for lo, la in zip(lons, lats)]


# --- načtení ----------------------------------------------------------------------------------------
def load():
    rels, mways, ways = {}, {}, {}
    benches, toilets, parking, kerbs, sources = set(), {}, {}, {}, []
    for f in sorted(RAW.glob("*.json")):
        if f.name == "elev_cache.json" or f.name.startswith("_"):
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        sources.append(d["source"])
        for r in d["rels"]:
            rels.setdefault(r["id"], r)
        mways.update({int(k): v for k, v in d["member_ways"].items()})
        for w in d["ways"]:
            ways.setdefault(w["id"], w)
        benches.update(tuple(b) for b in d["benches"])
        for t in d["toilets"]:
            toilets[t[4]] = t
        for p in d["parking"]:
            parking[p[4]] = p
        kerbs.update({int(k): v for k, v in d["kerbs"].items()})
        print(f.name, len(d["rels"]), "relací", len(d["ways"]), "cest", flush=True)
    return rels, mways, ways, list(benches), list(toilets.values()), list(parking.values()), kerbs, sources


def kraje():
    from shapely.geometry import shape
    out = []
    for f in json.loads((ROOT / "data" / "raw" / "kraje_gh.json").read_text(encoding="utf-8"))["features"]:
        out.append((f["name"], "CZ", prep(shape(f["geometry"]))))
    return out


def bezirke():
    out = []
    for rel in json.loads((ROOT / "data" / "raw" / "by_bezirke.json").read_text(encoding="utf-8"))["elements"]:
        if rel["id"] == 441582:      # okres Prachatice – není bavorský obvod
            continue
        lines = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]]) for m in rel["members"]
                 if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry")]
        poly = unary_union(list(polygonize(unary_union(lines))))
        out.append((rel["tags"].get("name:cs") or rel["tags"]["name"], "DE", prep(poly)))
    return out


# --- geometrie -------------------------------------------------------------------------------------
def chain_members(seq):
    """seq = [(node_ids, xy_coords)] v pořadí relace -> souvislé části (seznam seznamů xy)."""
    parts, cur, cur_end = [], None, None
    for i, (nodes, xy) in enumerate(seq):
        if cur is None:
            # natočit první cestu podle další
            if i + 1 < len(seq):
                nn = seq[i + 1][0]
                if nodes[0] in (nn[0], nn[-1]) and nodes[-1] not in (nn[0], nn[-1]):
                    nodes, xy = nodes[::-1], xy[::-1]
            cur, cur_end = list(xy), nodes[-1]
            continue
        if nodes[0] == cur_end:
            cur += xy[1:]; cur_end = nodes[-1]
        elif nodes[-1] == cur_end:
            cur += xy[::-1][1:]; cur_end = nodes[0]
        else:
            parts.append(cur)
            cur, cur_end = list(xy), nodes[-1]
    if cur:
        parts.append(cur)
    return parts


def order_parts(parts):
    """Seřadí části greedy podle nejbližšího konce (mezery se do délky nepočítají)."""
    parts = [list(p) for p in parts if len(p) >= 2]
    if len(parts) <= 1:
        return parts
    parts.sort(key=lambda p: -LineString(p).length)
    allpts = [q for p in parts for q in (p[0], p[-1])]
    cx = sum(q[0] for q in allpts) / len(allpts); cy = sum(q[1] for q in allpts) / len(allpts)
    # start: konec nejvzdálenější od těžiště
    best = max(range(len(parts)), key=lambda i: max(math.dist(parts[i][0], (cx, cy)), math.dist(parts[i][-1], (cx, cy))))
    p = parts.pop(best)
    if math.dist(p[-1], (cx, cy)) > math.dist(p[0], (cx, cy)):
        p = p[::-1]
    out = [p]
    while parts:
        end = out[-1][-1]
        j = min(range(len(parts)), key=lambda i: min(math.dist(end, parts[i][0]), math.dist(end, parts[i][-1])))
        q = parts.pop(j)
        if math.dist(end, q[-1]) < math.dist(end, q[0]):
            q = q[::-1]
        out.append(q)
    return out


def best_parts(seq):
    a = chain_members(seq)
    u = unary_union([LineString(xy) for _, xy in seq])
    m = u if u.geom_type == "LineString" else linemerge(u)
    b = [list(g.coords) for g in (m.geoms if hasattr(m, "geoms") else [m])]
    return order_parts(a if len(a) <= len(b) else b)


def simplify(parts, maxpts=300):
    tol = 2.0
    while True:
        s = [list(LineString(p).simplify(tol).coords) for p in parts]
        if sum(len(p) for p in s) <= maxpts or tol > 5000:
            return s
        tol *= 1.6


def sample(parts):
    total = sum(LineString(p).length for p in parts)
    step = max(STEP, total / MAX_SAMPLES)
    out = []  # (part_index, dist_in_part, x, y)
    for pi, p in enumerate(parts):
        ls = LineString(p)
        L = ls.length
        ds = [i * step for i in range(int(L // step) + 1)]
        if L - ds[-1] > 0.5:
            if L - ds[-1] < 20 and len(ds) > 1:
                ds[-1] = L
            else:
                ds.append(L)
        for d in ds:
            q = ls.interpolate(d)
            out.append((pi, d, q.x, q.y))
    return out, step


# --- výšky -----------------------------------------------------------------------------------------
CACHE_F = RAW / "elev_cache.json"
CACHE = json.loads(CACHE_F.read_text(encoding="utf-8")) if CACHE_F.exists() else {}
USED = Counter()
_last = [0.0]


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def elevations(latlngs):
    keys = [f"{la:.5f},{lo:.5f}" for la, lo in latlngs]
    miss = sorted({k for k in keys if k not in CACHE})
    for i in range(0, len(miss), 100):
        chunk = miss[i:i + 100]
        for attempt in range(4):
            wait = 1.1 - (time.time() - _last[0])
            if wait > 0:
                time.sleep(wait)
            _last[0] = time.time()
            try:
                if USED["opentopodata_fail"] < 3:
                    d = _get("https://api.opentopodata.org/v1/eudem25m?locations=" + "|".join(chunk))
                    if d.get("status") != "OK":
                        raise RuntimeError(d)
                    for k, r in zip(chunk, d["results"]):
                        if r["elevation"] is not None:
                            CACHE[k] = [round(r["elevation"], 1), "e"]
                    USED["eudem25m"] += 1
                else:
                    la = ",".join(k.split(",")[0] for k in chunk); lo = ",".join(k.split(",")[1] for k in chunk)
                    d = _get(f"https://api.open-meteo.com/v1/elevation?latitude={la}&longitude={lo}")
                    for k, e in zip(chunk, d["elevation"]):
                        CACHE[k] = [round(e, 1), "m"]
                    USED["open-meteo"] += 1
                break
            except Exception as e:  # noqa: BLE001
                print("  výšky chyba:", str(e)[:150], flush=True)
                if "429" in str(e) or "limit" in str(e).lower():
                    USED["opentopodata_fail"] += 1
                time.sleep(5 * (attempt + 1))
        if USED["eudem25m"] % 20 == 0:
            CACHE_F.write_text(json.dumps(CACHE), encoding="utf-8")
    return [CACHE.get(k) for k in keys]


def profile_stats(samples, elev):
    """samples (part, d, x, y), elev [[h, src]] -> profil a sklony na úsecích >= 20 m (uvnitř částí)."""
    prof, segs = [], []
    cum, prev = 0.0, None
    for (pi, d, _, _), e in zip(samples, elev):
        if prev is not None and prev[0] == pi:
            cum += d - prev[1]
            if e is not None and prev[2] is not None and d - prev[1] >= 20:
                segs.append((d - prev[1], e[0] - prev[2]))
        prof.append([round(cum), None if e is None else e[0]])
        prev = (pi, d, None if e is None else e[0])
    up = sum(dz for _, dz in segs if dz > 0); down = -sum(dz for _, dz in segs if dz < 0)
    grades = [(L, abs(dz) / L * 100) for L, dz in segs]
    tot = sum(L for L, _ in grades)

    def runs(th):
        n, length, inrun = 0, 0.0, False
        for L, g in grades:
            if g > th:
                length += L
                if not inrun:
                    n += 1
                inrun = True
            else:
                inrun = False
        return n, round(length)
    n6, l6 = runs(6); n8, l8 = runs(8)
    return {"prevyseni_nahoru": round(up), "prevyseni_dolu": round(down),
            "max_sklon": round(max((g for _, g in grades), default=0), 1),
            "prum_sklon": round(sum(L * g for L, g in grades) / tot, 1) if tot else None,
            "useky_nad_6": n6, "useky_nad_6_m": l6, "useky_nad_8": n8, "useky_nad_8_m": l8,
            "vyska_min": round(min((e[0] for e in elev if e), default=0)), "vyska_max": round(max((e[0] for e in elev if e), default=0))}, prof


def thin(prof, n=200):
    if len(prof) <= n:
        return prof
    idx = sorted({round(i * (len(prof) - 1) / (n - 1)) for i in range(n)})
    return [prof[i] for i in idx]


# --- atributy ---------------------------------------------------------------------------------------
def width_m(v):
    if not v:
        return None
    m = re.match(r"^\s*([0-9]+(?:[.,][0-9]+)?)\s*(m|cm)?\s*$", v)
    if not m:
        return None
    x = float(m.group(1).replace(",", "."))
    return x / 100 if m.group(2) == "cm" else x


def shares(items):
    tot = sum(L for L, _ in items) or 1
    c = Counter()
    for L, v in items:
        c[v] += L
    return {k: round(v / tot * 100, 1) for k, v in c.most_common()}


def attrs(wlist):
    """wlist = [(length_m, tags, node_ids)]"""
    surf = shares([(L, SURF.get(t.get("surface"), t.get("surface") or "neuvedeno")) for L, t, _ in wlist])
    smooth = shares([(L, t.get("smoothness", "neuvedeno")) for L, t, _ in wlist])
    track = shares([(L, t["tracktype"]) for L, t, _ in wlist if t.get("highway") == "track" and t.get("tracktype")])
    ws = sorted((width_m(t.get("width")), L) for L, t, _ in wlist if width_m(t.get("width")))
    tot = sum(L for L, _, _ in wlist) or 1
    sirka = None
    if ws:
        half, acc = sum(L for _, L in ws) / 2, 0
        for w, L in ws:
            acc += L
            if acc >= half:
                sirka = round(w, 2); break
    steps = [L for L, t, _ in wlist if t.get("highway") == "steps"]
    return {"povrchy": surf, "hladkost": smooth, "tracktype": track or None, "sirka_m": sirka,
            "sirka_min_m": round(ws[0][0], 2) if ws else None,
            "sirka_pokryti_pct": round(sum(L for _, L in ws) / tot * 100, 1) if ws else 0,
            "schody": len(steps), "schody_m": round(sum(steps)),
            "cesty_wheelchair": shares([(L, t.get("wheelchair", "neuvedeno")) for L, t, _ in wlist])}


def main():
    rels, mways, ways, benches, toilets, parking, kerbs, sources = load()
    bz = kraje() + bezirke()
    bench_xy = proj_line(benches) if benches else []
    bench_tree = STRtree([Point(p) for p in bench_xy])
    t_xy = proj_line([(t[0], t[1]) for t in toilets]); t_tree = STRtree([Point(p) for p in t_xy])
    p_xy = proj_line([(p[0], p[1]) for p in parking]); p_tree = STRtree([Point(p) for p in p_xy])
    mw_xy = {}

    def wxy(w):
        k = id(w)
        if k not in mw_xy:
            mw_xy[k] = proj_line(w["g"])
        return mw_xy[k]

    cands = []
    # (a)+(b) relace
    for rid, r in rels.items():
        t = r["tags"]
        seq, wl, seen, missing = [], [], set(), 0
        for typ, ref, role in r["m"]:
            if typ != "w" or role in SKIP_ROLES:
                continue
            w = mways.get(ref)
            if not w:
                missing += 1; continue
            if ref in seen:
                continue
            seen.add(ref)
            xy = wxy(w)
            seq.append((w["n"], xy)); wl.append((LineString(xy).length, w["t"], w["n"]))
        if not seq:
            continue
        cands.append({"kind": r["kind"], "osm": f"r{rid}", "tags": t, "seq": seq, "wl": wl, "missing": missing,
                      "dup_ways": len([m for m in r["m"] if m[0] == "w"]) - len({m[1] for m in r["m"] if m[0] == "w"}),
                      "nested": sum(1 for m in r["m"] if m[0] == "r")})
    print(len(cands), "relací s geometrií", flush=True)

    # (c) souvislé úseky cest wheelchair=yes
    in_rel = {ref for r in rels.values() for typ, ref, _ in r["m"] if typ == "w"}
    parent = {}

    def find(a):
        while parent.setdefault(a, a) != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for wid, w in ways.items():
        for n in w["n"]:
            parent[find(n)] = find(w["n"][0])
    comp = defaultdict(list)
    for wid, w in ways.items():
        comp[find(w["n"][0])].append(w)
    nchain = 0
    for ws in comp.values():
        wl = [(LineString(wxy(w)).length, w["t"], w["n"]) for w in ws]
        L = sum(x[0] for x in wl)
        if L <= 1000:
            continue
        covered = sum(x[0] for x, w in zip(wl, ws) if w["id"] in in_rel)
        if covered / L > 0.8:
            continue
        names = Counter()
        for (l, tg, _) in wl:
            if tg.get("name"):
                names[tg["name"]] += l
        ws_sorted = sorted(ws, key=lambda w: w["id"])
        cands.append({"kind": "c", "osm": f"w{ws_sorted[0]['id']}", "tags": {"name": names.most_common(1)[0][0]} if names else {},
                      "seq": [(w["n"], wxy(w)) for w in ws], "wl": wl, "missing": 0, "dup_ways": 0, "nested": 0,
                      "way_ids": [w["id"] for w in ws_sorted]})
        nchain += 1
    print(nchain, "souvislých úseků cest wheelchair=yes > 1 km", flush=True)

    # předběžné atributy + výběr
    for c in cands:
        c["parts"] = best_parts(c["seq"])
        c["len"] = sum(LineString(p).length for p in c["parts"])
        s0 = INV.transform(*c["parts"][0][0])
        c["start"] = (s0[1], s0[0])
        hit = next(((cs, z) for cs, z, pg in bz if pg.contains(Point(s0[0], s0[1]))), (None, None))
        c["kraj"], c["zeme"] = hit
        wc = c["tags"].get("wheelchair") or ("yes" if c["kind"] == "c" else None)
        c["wc"] = wc
        rank = {"yes": 4, "designated": 4, "limited": 3}.get(wc, 1 if wc is None else 0)
        c["score"] = (rank, 1 if c["kind"] != "c" else 0, 1 if c["tags"].get("name") else 0,
                      -c["missing"], min(c["len"], 30000))
    total = len(cands)
    outside = [c for c in cands if not c["kraj"]]
    cands = [c for c in cands if c["kraj"] and c["len"] >= 200]
    cands.sort(key=lambda c: c["score"], reverse=True)
    stats = {"kandidatu_celkem": total, "mimo_cr_a_bavorsko_vyrazeno": len(outside),
             "relace_a": sum(1 for c in cands if c["kind"] == "a"), "relace_b": sum(1 for c in cands if c["kind"] == "b"),
             "useky_c": sum(1 for c in cands if c["kind"] == "c")}
    sel = cands[:MAX_ROUTES]
    print("vybráno", len(sel), "z", len(cands), stats, flush=True)

    res = []
    for i, c in enumerate(sel):
        t = c["tags"]; parts = c["parts"]
        mline = MultiLineString(parts)
        a = attrs(c["wl"])
        # lavičky do 30 m
        lav = sum(1 for j in bench_tree.query(mline.buffer(30)) if mline.distance(bench_tree.geometries[j]) <= 30)
        sp = Point(parts[0][0])
        wc_list = sorted([{"vzdalenost_m": round(sp.distance(t_tree.geometries[j])), "wheelchair": toilets[j][2],
                           "toilets_wheelchair": toilets[j][3], "osm": toilets[j][4]}
                          for j in t_tree.query(sp.buffer(300)) if sp.distance(t_tree.geometries[j]) <= 300],
                         key=lambda x: x["vzdalenost_m"])
        pk_list = sorted([{"vzdalenost_m": round(sp.distance(p_tree.geometries[j])), "typ": parking[j][2],
                           "capacity_disabled": parking[j][3], "osm": parking[j][4]}
                          for j in p_tree.query(sp.buffer(300)) if sp.distance(p_tree.geometries[j]) <= 300],
                         key=lambda x: x["vzdalenost_m"])
        kb = Counter(kerbs[n] for _, _, nodes in c["wl"] for n in set(nodes) if n in kerbs)
        # typ trasy
        gap = math.dist(parts[0][0], parts[-1][-1])
        if (len(parts) == 1 and gap < 100) or (t.get("roundtrip") == "yes" and gap < 300 and c["dup_ways"] == 0):
            typ = "okruh"
        elif len(parts) == 1 and gap < 1000 and re.search(r"okruh|rundweg|rundgang", t.get("name", ""), re.I):
            typ = "okruh"   # podle názvu; začátek a konec relace jsou < 1 km od sebe
        elif t.get("roundtrip") == "yes" or c["dup_ways"] > 0:
            typ = "tam a zpět"
        else:
            typ = "A→B"
        # výšky
        smp, step = sample(parts)
        ll = to_latlng([(s[2], s[3]) for s in smp], 5)
        elev = elevations([tuple(p) for p in ll])
        st, prof = profile_stats(smp, elev)
        srcs = Counter(e[1] for e in elev if e)
        dem = ("EU-DEM v1.1 25 m (Copernicus Land Monitoring Service, © Evropská unie) přes OpenTopoData API https://www.opentopodata.org/datasets/eudem/"
               if srcs.get("e", 0) >= srcs.get("m", 0) else
               "Copernicus DEM GLO-90 přes Open-Meteo Elevation API https://open-meteo.com/en/docs/elevation-api (CC BY 4.0)")
        end = to_latlng([parts[-1][-1]])[0]
        osm_type = "relation" if c["osm"][0] == "r" else "way"
        name = t.get("name:cs") or t.get("name") or t.get("name:de")
        if not name:
            name = f"Cesta s wheelchair=yes ({c['kraj']}, {c['len'] / 1000:.1f} km)"
        zdroje = [f"https://www.openstreetmap.org/{osm_type}/{c['osm'][1:]}",
                  "© přispěvatelé OpenStreetMap, ODbL 1.0 (https://www.openstreetmap.org/copyright), extrakt Geofabrik czech-republic-261006 (stav OSM 2026-10-06), staženo 2026-10-07",
                  dem]
        if c["kind"] == "c" and len(c["way_ids"]) > 1:
            zdroje.append(f"spojeno z {len(c['way_ids'])} cest OSM: " + ",".join(f"w{x}" for x in c["way_ids"][:50])
                          + (" …" if len(c["way_ids"]) > 50 else ""))
        res.append({
            "id": f"osm-{c['osm']}", "nazev": name, "nazev_de": t.get("name:de"),
            "zeme": c["zeme"], "kraj": c["kraj"], "typ": typ,
            "vyber": {"a": "relace s wheelchair=yes|limited / názvem bezbariérová", "b": "naučná stezka s wheelchair=*",
                      "c": "souvislý úsek cest highway=path|footway|track|cycleway s wheelchair=yes"}[c["kind"]],
            "route": t.get("route"), "delka_km": round(c["len"] / 1000, 2), "souvisla": len(parts) == 1,
            "casti": len(parts), **{k: st[k] for k in ("prevyseni_nahoru", "prevyseni_dolu", "max_sklon", "prum_sklon",
                                                       "useky_nad_6", "useky_nad_6_m", "useky_nad_8", "useky_nad_8_m",
                                                       "vyska_min", "vyska_max")},
            "sklon_poznamka": ("max. sklon nad 20 % je pravděpodobně artefakt DEM s rozlišením 25 m (cesta vede strmým terénem,"
                               " model zachytí svah vedle cesty); ověřit v terénu" if st["max_sklon"] > 20 else None),
            "povrchy": a["povrchy"], "hladkost": a["hladkost"], "tracktype": a["tracktype"],
            "sirka_m": a["sirka_m"], "sirka_min_m": a["sirka_min_m"], "sirka_pokryti_pct": a["sirka_pokryti_pct"],
            "schody": a["schody"], "schody_m": a["schody_m"], "obrubniky": dict(kb) or None,
            "lavicky": lav, "wc_u_startu": wc_list or None, "parkovani_ztp_u_startu": pk_list or None,
            "wheelchair": t.get("wheelchair") if c["kind"] != "c" else "yes",
            "wheelchair_useky": a["cesty_wheelchair"],
            "wheelchair_description": t.get("wheelchair:description:cs") or t.get("wheelchair:description") or t.get("wheelchair:description:de"),
            "popis": t.get("description:cs") or t.get("description") or t.get("description:de"),
            "web": t.get("website") or t.get("url") or t.get("contact:website"),
            "operator": t.get("operator"), "network": t.get("network"), "educational": t.get("educational"),
            "start": [round(c["start"][0], 6), round(c["start"][1], 6)], "cil": end,
            "geometrie": [to_latlng(p, 5) for p in simplify(parts)],
            "profil": thin(prof), "profil_krok_m": round(step),
            "chybejici_cleny": c["missing"] or None,
            "zdroje": zdroje})
        if i % 10 == 0:
            print(i, name, round(c["len"]), "m", USED, flush=True)
    CACHE_F.write_text(json.dumps(CACHE), encoding="utf-8")
    (OUT / "trasy_cz.json").write_text(json.dumps(res, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    meta = {"vytvoreno": time.strftime("%Y-%m-%d"), "pocet": len(res), **stats,
            "pocty_wheelchair": dict(Counter(r["wheelchair"] for r in res)),
            "pocty_kraj": dict(Counter(r["kraj"] for r in res)), "pocty_typ": dict(Counter(r["typ"] for r in res)),
            "dotazy_vysky": dict(USED),
            "geometrie_format": "pole částí; každá část je pole [lat, lng]",
            "profil_format": "[vzdálenost_m od startu (mezery mezi částmi se nepočítají), výška_m]",
            "sklony": f"z DEM, body po {STEP:.0f} m (u tras delších než {STEP * MAX_SAMPLES / 1000:.0f} km řidší), úseky >= 20 m; useky_nad_X = počet souvislých úseků se sklonem nad X %, *_m jejich délka",
            "zdroje_vstupu": sources}
    (OUT / "trasy_cz_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=1)[:2000])


if __name__ == "__main__":
    main()
