"""Bezbariérové / sjízdné trasy v Česku z OpenStreetMap – krok 1: proudová extrakce z Geofabrik .pbf.

  python tools/trasy_cz_extract.py data/raw/pbf/czech-republic-261006.osm.pbf

Overpass (overpass-api.de, overpass.private.coffee, maps.mail.ru) 2026-10-07 neodpovídal (HTML chyba / prázdná odpověď),
proto extrakt Geofabrik https://download.geofabrik.de/europe/czech-republic-261006.osm.pbf (stav OSM k 2026-10-06)
+ pyosmium proudově (index uzlů na disku, sparse_file_array). Výstupní formát je stejný jako u tools/trasy_by_extract.py.

Výběr:
 (a) relace route=hiking|foot|bicycle|nordic_walking s wheelchair=yes|limited|designated
     nebo name ~ bezbariér/barrierefrei/barrierearm/Rollstuhl/vozíčk
 (b) relace route=hiking s educational=yes nebo name ~ naučná stezka/Lehrpfad a s jakýmkoli wheelchair=*
 (c) cesty highway=path|footway|track|cycleway s wheelchair=yes (bez footway=sidewalk|crossing) – spojují se v kroku 2
 + okolí: amenity=bench, amenity=toilets, parkování ZTP (parking_space=disabled, amenity=parking s capacity:disabled>0),
   obrubníky (barrier=kerb / kerb=*) jako uzly.

Zdroj: © přispěvatelé OpenStreetMap, ODbL 1.0
Výstup: data/raw/trasy_cz/<extrakt>.json
"""
import gc
import json
import re
import sys
import time
from pathlib import Path

import osmium

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "trasy_cz"
RAW.mkdir(parents=True, exist_ok=True)

ROUTES = {"hiking", "foot", "bicycle", "nordic_walking"}
NAME_RE = re.compile(r"bezbari|barrierefrei|barrierearm|rollstuhl|vozíčk|vozick", re.I)
EDU_RE = re.compile(r"lehrpfad|naučn|naucn", re.I)
PATHS = {"path", "footway", "track", "cycleway"}
WAY_KEYS = ("highway", "surface", "smoothness", "tracktype", "width", "wheelchair", "incline", "name", "footway",
            "bicycle", "foot", "access", "sac_scale", "trail_visibility")


def route_wanted(t):
    if t.get("type") not in ("route", None) or t.get("route") not in ROUTES:
        return None
    nm = " ".join(t.get(k, "") for k in ("name", "name:cs", "name:de"))
    wc = t.get("wheelchair")
    if wc in ("yes", "limited", "designated") or NAME_RE.search(nm):
        return "a"
    if t.get("route") == "hiking" and (t.get("educational") == "yes" or EDU_RE.search(nm)) and wc:
        return "b"
    return None


def disabled_parking(t):
    if t.get("amenity") == "parking_space" and t.get("parking_space") == "disabled":
        return "parking_space"
    if t.get("amenity") == "parking":
        c = t.get("capacity:disabled", "")
        if c == "yes" or (c.isdigit() and int(c) > 0):
            return "parking"
    return None


def extract(pbf):
    pbf = Path(pbf)
    name = pbf.name.replace(".osm.pbf", "")
    out = RAW / f"{name}.json"
    idx = RAW / f"{name}.nodeidx"
    t0 = time.time()

    def pts(o):
        return [(round(n.location.lon, 7), round(n.location.lat, 7)) for n in o.nodes if n.location.valid()]

    def centre(p):
        if not p:
            return None
        return (round(sum(x for x, _ in p) / len(p), 7), round(sum(y for _, y in p) / len(p), 7))

    benches, toilets, parking, kerbs, ways, rels = [], [], [], {}, [], []
    fp = (osmium.FileProcessor(str(pbf))
          .with_locations(f"sparse_file_array,{idx}")
          .with_filter(osmium.filter.EmptyTagFilter())
          .with_filter(osmium.filter.KeyFilter("route", "highway", "amenity", "barrier", "kerb")))
    n = 0
    for o in fp:
        n += 1
        if n % 2_000_000 == 0:
            print(f"  {n} objektů, {time.time() - t0:.0f} s", flush=True)
        t = o.tags
        a = t.get("amenity")
        if o.is_node():
            if a or t.get("barrier") == "kerb" or "kerb" in t:
                td = dict(t)
                loc = (round(o.location.lon, 7), round(o.location.lat, 7))
                if a == "bench":
                    benches.append(loc)
                elif a == "toilets":
                    toilets.append([*loc, td.get("wheelchair"), td.get("toilets:wheelchair"), f"n{o.id}"])
                elif disabled_parking(td):
                    parking.append([*loc, disabled_parking(td), td.get("capacity:disabled"), f"n{o.id}"])
                if td.get("barrier") == "kerb" or "kerb" in td:
                    kerbs[o.id] = td.get("kerb", "neuvedeno")
        elif o.is_way():
            if a in ("toilets", "parking", "parking_space", "bench"):
                td = dict(t)
                c = centre(pts(o))
                if c:
                    if a == "bench":
                        benches.append(c)
                    elif a == "toilets":
                        toilets.append([*c, td.get("wheelchair"), td.get("toilets:wheelchair"), f"w{o.id}"])
                    elif disabled_parking(td):
                        parking.append([*c, disabled_parking(td), td.get("capacity:disabled"), f"w{o.id}"])
            hw = t.get("highway")
            if hw in PATHS and t.get("wheelchair") == "yes" and t.get("footway") not in ("sidewalk", "crossing") \
                    and t.get("area") != "yes":
                p = pts(o)
                if len(p) >= 2:
                    ways.append({"id": o.id, "n": [x.ref for x in o.nodes], "g": p,
                                 "t": {k: t.get(k) for k in WAY_KEYS if k in t}})
        elif o.is_relation():
            kind = route_wanted(t)
            if kind:
                rels.append({"id": o.id, "kind": kind, "tags": dict(t),
                             "m": [[m.type, m.ref, m.role] for m in o.members]})
    print(f"{name} průchod 1: {len(rels)} relací, {len(ways)} cest wheelchair=yes, {len(benches)} laviček, "
          f"{len(toilets)} WC, {len(parking)} ZTP parkování, {len(kerbs)} obrubníků, {time.time() - t0:.0f} s", flush=True)

    need = {m[1] for r in rels for m in r["m"] if m[0] == "w"}
    geom = {}
    if need:
        fp = (osmium.FileProcessor(str(pbf))
              .with_locations(f"sparse_file_array,{idx}")
              .with_filter(osmium.filter.EntityFilter(osmium.osm.WAY))
              .with_filter(osmium.filter.IdFilter(need)))
        for o in fp:
            p = pts(o)
            if len(p) >= 2:
                t = o.tags
                geom[o.id] = {"n": [x.ref for x in o.nodes], "g": p, "t": {k: t.get(k) for k in WAY_KEYS if k in t}}
    print(f"{name} průchod 2: {len(geom)} z {len(need)} členských cest, {time.time() - t0:.0f} s", flush=True)
    fp = None
    gc.collect()
    try:
        idx.unlink()
    except OSError:
        pass
    used = {x for w in ways for x in w["n"]} | {x for w in geom.values() for x in w["n"]}
    kerbs = {str(k): v for k, v in kerbs.items() if k in used}
    out.write_text(json.dumps({"source": f"Geofabrik {pbf.name} (https://download.geofabrik.de/europe/{pbf.name}), "
                                         f"staženo 2026-10-07",
                               "rels": rels, "member_ways": {str(k): v for k, v in geom.items()}, "ways": ways,
                               "benches": benches, "toilets": toilets, "parking": parking, "kerbs": kerbs},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("uloženo", out, f"{out.stat().st_size / 1e6:.1f} MB", flush=True)


if __name__ == "__main__":
    for f in sys.argv[1:]:
        extract(f)
