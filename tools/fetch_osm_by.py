"""Stáhne z OpenStreetMap (Overpass API) data pro Bavorsko (Německo).

  python tools/fetch_osm_by.py boundary   – hranice Bavorska (relation 2145268)
  python tools/fetch_osm_by.py bezirke    – 7 vládních obvodů (admin_level=5)
  python tools/fetch_osm_by.py gemeinden  – obce (admin_level=8), po obvodech
  python tools/fetch_osm_by.py places     – místa (stejné dotazy jako ČR, tools/fetch_osm.py) po dlaždicích 0,5°
  python tools/fetch_osm_by.py settl      – sídla (place=city/town/village) pro záložní určení obce

Výstup: data/raw/by_*.json (data/raw je v .gitignore). Už stažené soubory přeskočí.
Data © přispěvatelé OpenStreetMap, licence ODbL 1.0.
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_osm import QUERIES, run  # noqa: E402  (stejné filtry a servery jako ČR)

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
BY_REL = 2145268
S, N, W, E = 47.0, 50.75, 8.75, 14.0  # obal Bavorska (s rezervou)
STEP = 0.5
BEZIRKE = ("Oberbayern", "Niederbayern", "Oberpfalz", "Oberfranken", "Mittelfranken", "Unterfranken", "Schwaben")

PLACE_Q = "".join(q for k, q in QUERIES.items() if q and k != "places")


def save(name, data):
    (RAW / name).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def boundary():
    out = RAW / "by_boundary.json"
    if not out.exists():
        save(out.name, run(f"[out:json][timeout:180];relation({BY_REL});out geom;"))
        print("hranice Bavorska uložena", flush=True)


def bezirke():
    out = RAW / "by_bezirke.json"
    if not out.exists():
        data = run(f"[out:json][timeout:300];rel({BY_REL});map_to_area->.a;"
                   'relation["boundary"="administrative"]["admin_level"="5"](area.a);out geom;', timeout=300)
        save(out.name, data)
        print("obvody:", [e["tags"].get("name") for e in data["elements"]], flush=True)


def gemeinden():
    bz = json.loads((RAW / "by_bezirke.json").read_text(encoding="utf-8"))["elements"]
    for rel in bz:
        if rel["tags"].get("name") not in BEZIRKE:
            continue
        out = RAW / f"by_gemeinden_{rel['id']}.json"
        if out.exists():
            continue
        q = (f"[out:json][timeout:600];rel({rel['id']});map_to_area->.a;"
             'relation["boundary"="administrative"]["admin_level"="8"](area.a);out tags geom;')
        data = run(q, timeout=600)
        save(out.name, data)
        print(f"obce {rel['tags'].get('name')}: {len(data['elements'])}", flush=True)
        time.sleep(10)


def tiles():
    lat = S
    while lat < N - 1e-9:
        lon = W
        while lon < E - 1e-9:
            yield round(lat, 2), round(lon, 2), round(min(lat + STEP, N), 2), round(min(lon + STEP, E), 2)
            lon += STEP
        lat += STEP


def by_poly():
    from shapely.geometry import LineString
    from shapely.ops import polygonize, unary_union
    rel = json.loads((RAW / "by_boundary.json").read_text(encoding="utf-8"))["elements"][0]
    lines = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]]) for m in rel["members"]
             if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry")]
    return unary_union(list(polygonize(unary_union(lines))))


def fetch_tiles(prefix, body):
    from shapely.geometry import box
    poly = by_poly().buffer(0.01)
    for s, w, n, e in tiles():
        if not poly.intersects(box(w, s, e, n)):
            continue
        out = RAW / f"by_{prefix}_{s:.1f}_{w:.1f}.json"
        if out.exists():
            continue
        q = f"[out:json][timeout:240][bbox:{s},{w},{n},{e}];({body});out center tags meta;"
        try:
            data = run(q, timeout=240, tries=4)
        except RuntimeError:
            print(f"{out.name}: dělím na čtvrtiny", flush=True)
            elems, ms, mw = {}, (s + n) / 2, (w + e) / 2
            for (s_, n_) in ((s, ms), (ms, n)):
                for (w_, e_) in ((w, mw), (mw, e)):
                    qq = f"[out:json][timeout:240][bbox:{s_},{w_},{n_},{e_}];({body});out center tags meta;"
                    for el in run(qq, timeout=240).get("elements", []):
                        elems[(el["type"], el["id"])] = el
                    time.sleep(8)
            data = {"elements": list(elems.values())}
        save(out.name, data)
        print(f"{out.name}: {len(data.get('elements', []))}", flush=True)
        time.sleep(6)


if __name__ == "__main__":
    for a in sys.argv[1:]:
        {"boundary": boundary, "bezirke": bezirke, "gemeinden": gemeinden,
         "places": lambda: fetch_tiles("osm", PLACE_Q),
         "settl": lambda: fetch_tiles("settl", 'node["place"~"^(city|town|village)$"];')}[a]()
