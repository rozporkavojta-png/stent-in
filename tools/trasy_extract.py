"""Vytáhne z extraktů OpenStreetMap (Geofabrik .osm.pbf, licence ODbL) podklady pro sjízdné trasy.

Proudové čtení pyosmium po průchodech (málo paměti):
  1) relace route=hiking|foot|bicycle|nordic_walking (bezbariérové / naučné s wheelchair=*)
  2) cesty: členy relací + samostatné highway=path|footway|track|cycleway s wheelchair=yes,
     toalety a parkoviště ZTP jako plochy
  3) uzly s tagy: lavičky, WC, parkování ZTP, obrubníky (barrier=kerb / kerb=*)
  4) souřadnice potřebných uzlů (IdFilter)
Výstup: data/raw/trasy/<extrakt>.json
Spuštění: python tools/trasy_extract.py data/raw/pbf/czech-republic-261006.osm.pbf [...]
"""
import json
import re
import sys
import time
from pathlib import Path

import osmium
from osmium.filter import IdFilter, KeyFilter

OUT = Path(__file__).resolve().parent.parent / "data" / "raw" / "trasy"
ROUTES = {"hiking", "foot", "bicycle", "nordic_walking", "walking"}
RX_BF = re.compile(r"bezbari|barrierefrei|rollstuhl|rolli|vozíč|vozic|kočár|kocar", re.I)
RX_NS = re.compile(r"naučn|naucn|lehrpfad|erlebnispfad|naučný chodník", re.I)
PATHS = {"path", "footway", "track", "cycleway", "pedestrian", "bridleway"}
WAY_KEYS = ("highway", "surface", "smoothness", "tracktype", "width", "est_width", "wheelchair", "name",
            "incline", "footway", "foot", "bicycle", "step_count", "ramp", "ramp:wheelchair", "kerb", "lit")


def rel_kind(t):
    if t.get("type") not in ("route", "superroute") or t.get("route") not in ROUTES:
        return None
    name = " ".join(t.get(k, "") for k in ("name", "name:cs", "name:de", "description"))
    wc = t.get("wheelchair")
    if wc in ("yes", "limited", "designated") or RX_BF.search(name):
        return "a"
    if (t.get("educational") == "yes" or RX_NS.search(name)) and wc:
        return "b"
    return None


def main(pbf):
    pbf = str(pbf)
    tag = Path(pbf).name.split("-latest")[0].split("-26")[0]
    out = OUT / f"{tag}.json"
    OUT.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    # --- 1) relace
    rels, child = {}, set()
    for o in osmium.FileProcessor(pbf, osmium.osm.RELATION).with_filter(KeyFilter("route")):
        t = dict(o.tags)
        k = rel_kind(t)
        if not k:
            continue
        mem = [(m.type, m.ref, m.role) for m in o.members]
        rels[o.id] = {"k": k, "tags": t, "members": mem}
        child.update(m[1] for m in mem if m[0] == "r")
    # podrelace superroutes (jedna úroveň)
    child -= set(rels)
    if child:
        for o in osmium.FileProcessor(pbf, osmium.osm.RELATION).with_filter(IdFilter(child)):
            rels.setdefault(o.id, {"k": "child", "tags": dict(o.tags),
                                   "members": [(m.type, m.ref, m.role) for m in o.members]})
    member_ways = {m[1] for r in rels.values() for m in r["members"] if m[0] == "w"}
    print(f"[{tag}] relace: {len(rels)} (členských cest {len(member_ways)}) {time.time()-t0:.0f}s", flush=True)

    # --- 2) cesty
    ways, pois_w = {}, []
    for o in osmium.FileProcessor(pbf, osmium.osm.WAY).with_filter(KeyFilter("highway", "amenity")):
        t = o.tags
        hw = t.get("highway")
        am = t.get("amenity")
        if o.id in member_ways or (hw in PATHS and t.get("wheelchair") == "yes"):
            ways[o.id] = {"t": {k: t[k] for k in WAY_KEYS if k in t}, "n": [n.ref for n in o.nodes]}
        elif am == "toilets" or (am == "parking" and (t.get("capacity:disabled", "no") not in ("no", "0")
                                                    or t.get("parking_space") == "disabled")):
            pois_w.append({"id": o.id, "amenity": am, "wheelchair": t.get("wheelchair"),
                           "cap_dis": t.get("capacity:disabled"), "name": t.get("name"),
                           "n": [n.ref for n in o.nodes][:6]})
    need = {n for w in ways.values() for n in w["n"]} | {n for p in pois_w for n in p["n"]}
    print(f"[{tag}] cest: {len(ways)}, ploch POI: {len(pois_w)}, uzlů k dohledání {len(need)} "
          f"{time.time()-t0:.0f}s", flush=True)

    # --- 3) uzly s tagy
    bench, toilets, parking, kerbs, places = [], [], [], {}, []
    for o in osmium.FileProcessor(pbf, osmium.osm.NODE).with_filter(KeyFilter("amenity", "barrier", "kerb", "place")):
        t = o.tags
        am = t.get("amenity")
        la, lo = round(o.location.lat, 6), round(o.location.lon, 6)
        if t.get("place") in ("city", "town", "village", "suburb") and "name" in t:
            places.append((la, lo, t["name"], t["place"]))
        if am == "bench":
            bench.append((la, lo))
        elif am == "toilets":
            toilets.append((la, lo, t.get("wheelchair"), t.get("name")))
        elif (am == "parking" and t.get("capacity:disabled", "no") not in ("no", "0")) or \
                (am == "parking_space" and t.get("parking_space") == "disabled"):
            parking.append((la, lo, t.get("capacity:disabled") or "1"))
        if o.id in need and (t.get("barrier") == "kerb" or "kerb" in t):
            kerbs[o.id] = t.get("kerb") or "neuvedeno"
    print(f"[{tag}] lavičky {len(bench)}, WC {len(toilets)}, park. ZTP {len(parking)}, obrubníky na trasách "
          f"{len(kerbs)} {time.time()-t0:.0f}s", flush=True)

    # --- 4) souřadnice uzlů
    loc = {}
    for o in osmium.FileProcessor(pbf, osmium.osm.NODE).with_filter(IdFilter(need)):
        loc[o.id] = (round(o.location.lat, 7), round(o.location.lon, 7))
    print(f"[{tag}] souřadnic {len(loc)} {time.time()-t0:.0f}s", flush=True)

    for p in pois_w:
        pts = [loc[n] for n in p.pop("n") if n in loc]
        if not pts:
            continue
        la = sum(x[0] for x in pts) / len(pts)
        lo = sum(x[1] for x in pts) / len(pts)
        if p["amenity"] == "toilets":
            toilets.append((round(la, 6), round(lo, 6), p["wheelchair"], p["name"]))
        else:
            parking.append((round(la, 6), round(lo, 6), p["cap_dis"] or "1"))

    data = {"source": f"OpenStreetMap (© přispěvatelé OSM, ODbL) – extrakt Geofabrik {Path(pbf).name}",
            "rels": {str(k): v for k, v in rels.items()},
            "ways": {str(k): v for k, v in ways.items()},
            "loc": {str(k): v for k, v in loc.items()},
            "kerbs": {str(k): v for k, v in kerbs.items()},
            "bench": bench, "places": places, "toilets": toilets, "parking": parking}
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"[{tag}] uloženo {out} ({out.stat().st_size/1e6:.1f} MB) {time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    for f in sys.argv[1:]:
        main(f)
