"""Stáhne z OpenStreetMap (Overpass API) skutečná místa v ČR s údaji o přístupnosti.

Dotazy se dělí na pruhy podle zeměpisné délky, aby je přetížený server zvládl.
Výsledky: data/raw/<název>_<pruh>.json. Už stažené soubory přeskočí.
Spuštění: python tools/fetch_osm.py [název ...]
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
UA = "kudyprojedu-student-project/0.1 (VSTE Ceske Budejovice)"
SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter",
           "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
STRIPS = [(12.0, 13.2), (13.2, 14.4), (14.4, 15.6), (15.6, 16.8), (16.8, 18.0), (18.0, 18.9)]

QUERIES = {
    "food_cp": 'nwr["wheelchair"]["amenity"~"^(cafe|ice_cream|pub|bar|fast_food|biergarten)$"];',
    "other": 'nwr["wheelchair"]["historic"];nwr["wheelchair"]["leisure"~"^(park|sports_centre|swimming_pool|stadium|nature_reserve|garden|water_park|ice_rink)$"];'
             'nwr["wheelchair"]["railway"="station"];nwr["wheelchair"]["office"="government"];',
    "shop": 'nwr["wheelchair"]["shop"~"^(supermarket|mall|department_store|bakery|chemist|optician|medical_supply)$"]["name"];',
    "tourism": 'nwr["wheelchair"]["tourism"];',
    "public": 'nwr["wheelchair"]["amenity"~"^(toilets|pharmacy|townhall|library|theatre|cinema|arts_centre|community_centre|hospital|clinic|doctors|dentist|post_office|bank|police|courthouse|marketplace|bus_station|university|college)$"];',
    "restaurant": 'nwr["wheelchair"]["amenity"="restaurant"];',
    "toilets": 'nwr["amenity"="toilets"]["toilets:wheelchair"];nwr["toilets:wheelchair"="yes"]["name"];',
    "parking": 'nwr["amenity"="parking"]["capacity:disabled"];nwr["amenity"="parking_space"]["parking_space"="disabled"];',
    "places": 'node["place"~"^(city|town|village)$"];',
    "boundary": None,
}


def run(query, timeout=180, tries=6):
    body = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for attempt in range(tries):
        server = SERVERS[attempt % len(SERVERS)]
        try:
            req = urllib.request.Request(server, data=body, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout + 30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # 429/504 – počkat a zkusit jiný server
            last = e
            print(f"   pokus {attempt + 1} na {server.split('/')[2]}: {e}", flush=True)
            time.sleep(15 + attempt * 10)
    raise RuntimeError(f"Dotaz selhal: {last}")


def fetch(name):
    if name == "boundary":
        out = RAW / "cz_boundary.json"
        if out.exists():
            return
        data = run('[out:json][timeout:180];relation(51684);out geom;')
        out.write_text(json.dumps(data), encoding="utf-8")
        print("hranice ČR uložena", flush=True)
        return
    if name == "kraje":
        out = RAW / "kraje.json"
        if out.exists():
            return
        data = run('[out:json][timeout:240];area["ISO3166-1"="CZ"][admin_level=2]->.a;'
                   'relation["boundary"="administrative"]["admin_level"="6"](area.a);out geom;', timeout=240)
        out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(f"kraje: {len(data.get('elements', []))}", flush=True)
        return
    for i, (w, e) in enumerate(STRIPS, start=1):
        out = RAW / f"{name}_s{i}.json"
        if out.exists():
            continue
        q = f"[out:json][timeout:180][bbox:48.5,{w},51.1,{e}];({QUERIES[name]});out center tags meta;"
        try:
            data = run(q, tries=3)
        except RuntimeError:
            # přetížený server: pruh se rozdělí na čtyři menší dlaždice a výsledky se spojí
            print(f"{name} pruh {i}: dělím na menší části", flush=True)
            elems, mid = {}, (w + e) / 2
            for (s_, n_) in ((48.5, 49.8), (49.8, 51.1)):
                for (w_, e_) in ((w, mid), (mid, e)):
                    qq = f"[out:json][timeout:180][bbox:{s_},{w_},{n_},{e_}];({QUERIES[name]});out center tags meta;"
                    for el in run(qq).get("elements", []):
                        elems[(el["type"], el["id"])] = el
                    time.sleep(10)
            data = {"elements": list(elems.values())}
        out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(f"{name} pruh {i}: {len(data.get('elements', []))} objektů", flush=True)
        time.sleep(5)


if __name__ == "__main__":
    for n in (sys.argv[1:] or list(QUERIES)):
        fetch(n)
