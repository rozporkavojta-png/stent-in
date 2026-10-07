"""Druhá vlna otevřených dat o přístupnosti -> pole x v data/places.json.

Zdroje (data/open/), licence ověřené 2026-10-06:
  praha_wc.geojson     IPR Praha – Veřejné toalety (FSV_CUR_FSV_VEREJNAWC_B), CC BY
                       licence: pole licenseInfo položky portálu
                       https://mp.iprpraha.cz/portal/sharing/rest/content/items/c5ffe5b9940d497f9fbc15725866b587?f=json
  ostrava_mp.geojson   Ostrava – Mapa přístupnosti (SMO_Pristupnost/mapa_pristupnosti, vrstva 8), CC BY-SA 4.0
                       licence: https://mapy.ostrava.cz/opendata-info (užití dat z mapových služeb GISMO
                       za podmínek CC BY-SA 4.0, doložka „datový podklad © Statutární město Ostrava“)

Nepoužito (licence neuvedena, viz data/research/licence_zadosti.md):
  Euroklíč (NRZP ČR), Brno – Parkovací místa ZTP (data.brno.cz, license „none“).

Postup: objekt se spáruje s místem stejné kategorie do 40 m (WC s místem kategorie wc), jinak vznikne
nové místo s id pwc<objectid> / ova<objectid>. Nic se nedopočítává, řádky jsou jen hodnoty ze zdroje.
Ostravská vrstva nemá názvy objektů: nové místo dostane název podle subkategorie zdroje.
Skript je opakovatelný: odstraní místa a záznamy x z dřívějšího běhu tohoto skriptu.

Spuštění: python tools/build_data.py && python tools/build_open.py && python tools/build_open2.py
"""
import json
import re
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_data import load_gh, locate  # noqa: E402
from build_open import CAT3, Grid  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OPEN = ROOT / "data" / "open"
UA = "kudyprojedu-student-project/0.1 (VSTE Ceske Budejovice)"

WC_LAYER = "https://mp.iprpraha.cz/arcgis/rest/services/Hosted/FSV_CUR_FSV_VEREJNAWC_B/FeatureServer/0"
WC_LIC_URL = "https://mp.iprpraha.cz/portal/sharing/rest/content/items/c5ffe5b9940d497f9fbc15725866b587?f=json"
OVA_SVC = "https://mapy.ostrava.cz/arcgisserver/rest/services/SMO_Pristupnost/mapa_pristupnosti/MapServer"
OVA_LAYER = OVA_SVC + "/8"
OVA_LIC_URL = "https://mapy.ostrava.cz/opendata-info"
OVA_APP = "https://mapy.ostrava.cz/mapove-sluzby/mapa-pristupnosti/"

SRC = ("praha_wc", "ostrava")
ID_RE = re.compile(r"^(pwc|ova)\d")


def get_json(url, timeout=120):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_layer(layer, out, license_, page=1000, extra=None):
    """Stáhne vrstvu ArcGIS (geojson, WGS84) se stránkováním, pokud soubor ještě neexistuje."""
    try:
        if len(json.loads(out.read_text(encoding="utf-8")).get("features", [])) > 0:
            return
    except Exception:
        pass
    feats, off = [], 0
    while True:
        d = get_json(layer + "/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&orderByFields=objectid"
                     f"&resultOffset={off}&resultRecordCount={page}")
        got = d.get("features", [])
        feats += got
        if not got or not ((d.get("properties") or {}).get("exceededTransferLimit") or d.get("exceededTransferLimit")):
            break
        off += page
        time.sleep(1)
    meta = {"type": "FeatureCollection", "source": layer, "downloaded": time.strftime("%Y-%m-%d"), "license": license_}
    meta.update(extra or {})
    meta["features"] = feats
    out.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")


def fetch_all():
    lay = get_json(WC_LAYER + "?f=json", 30)
    wc_dom = {f["name"]: {str(c["code"]): c["name"] for c in f["domain"]["codedValues"]}
              for f in lay["fields"] if f.get("domain")}
    item = get_json(WC_LIC_URL, 30)
    fetch_layer(WC_LAYER, OPEN / "praha_wc.geojson", item.get("licenseInfo") or "CC BY", page=2000,
                extra={"license_source": WC_LIC_URL, "attribution": "IPR Praha", "domains": wc_dom,
                       "item_modified": time.strftime("%Y-%m-%d", time.gmtime((item.get("modified") or 0) / 1000))})
    lay = get_json(OVA_LAYER + "?f=json", 30)
    dom = {f["name"]: {str(c["code"]): c["name"] for c in f["domain"]["codedValues"]}
           for f in lay["fields"] if f.get("domain")}
    ren = (lay.get("drawingInfo") or {}).get("renderer") or {}
    l9 = get_json(OVA_SVC + "/9?f=json", 30)
    acc = {str(u["value"]): u["label"] for u in l9["drawingInfo"]["renderer"].get("uniqueValueInfos", [])}
    fetch_layer(OVA_LAYER, OPEN / "ostrava_mp.geojson", "CC BY-SA 4.0", page=1000,
                extra={"license_source": OVA_LIC_URL, "attribution": "datový podklad © Statutární město Ostrava",
                       "domains": dom, "accessibility_labels": acc, "renderer_field": ren.get("field1")})


# ---------------------------------------------------------------- Praha – veřejné WC

def wc_items():
    data = json.loads((OPEN / "praha_wc.geojson").read_text(encoding="utf-8"))
    dom = data.get("domains", {})
    date = data.get("item_modified")
    voz = {1: "yes", 0: "no", 2: "no"}
    for f in data["features"]:
        if not f.get("geometry"):
            continue
        p = f["properties"]
        lo, la = f["geometry"]["coordinates"][:2]
        v = p.get("vozickari")
        rows = []
        if v is not None:
            rows.append(["Bezbariérovost (údaj IPR)", dom.get("vozickari", {}).get(str(v), str(v))])
        if p.get("typ") is not None:
            rows.append(["Umístění", dom.get("typ", {}).get(str(p["typ"]), str(p["typ"]))])
        if p.get("umisteni_podrob"):
            rows.append(["Upřesněné umístění", dom.get("umisteni_podrob", {}).get(str(p["umisteni_podrob"]), str(p["umisteni_podrob"]))])
        if p.get("adresa"):
            rows.append(["Adresa", p["adresa"]])
        oid = p.get("objectid")
        w = voz.get(v)
        name = (p.get("lokalita") or "").strip() or "Veřejné WC"
        yield {
            "src": "praha_wc", "id": "pwc" + str(oid), "n": name, "la": la, "lo": lo, "c": "wc", "s": "Veřejné WC",
            "w": w, "t": w, "a": p.get("adresa") or None, "structured": 0,
            "x": {"src": "praha_wc", "name": name, "label": "IPR Praha – veřejné toalety", "url": f"{WC_LAYER}/{oid}?f=pjson",
                  "date": date, "license": "CC BY", "attribution": "IPR Praha", "cat": CAT3.get(w), "rows": rows},
        }


# ---------------------------------------------------------------- Ostrava – mapa přístupnosti

OVA_ACC = {1: "yes", 2: "limited", 3: "no"}
OVA_CAT = {10: "kultura", 20: "urady", 30: "urady", 40: "urady", 50: "zdravi", 60: "sport", 70: "restaurace",
           80: "urady", 90: "wc", 100: "urady", 110: "ubytovani", 120: "urady", 130: "doprava", 140: "doprava", 150: "priroda"}
OVA_SUB = {11: "kultura", 12: "pamatky", 13: "kultura", 31: "urady", 32: "obchody", 33: "kultura", 51: "zdravi", 52: "zdravi"}


def ova_items():
    data = json.loads((OPEN / "ostrava_mp.geojson").read_text(encoding="utf-8"))
    dom = data.get("domains", {})
    accl = data.get("accessibility_labels", {})
    for f in data["features"]:
        if not f.get("geometry"):
            continue
        p = f["properties"]
        lo, la = f["geometry"]["coordinates"][:2]
        a, cat, sub = p.get("accessibility"), p.get("cat"), p.get("subcat")
        w = OVA_ACC.get(a)
        sub_txt = dom.get("subcat", {}).get(str(sub)) or dom.get("cat", {}).get(str(cat)) or "Objekt"
        sub_txt = re.sub(r"\s*\([^)]*\)\s*$", "", sub_txt).strip()
        if cat == 140:
            sub_txt = "Zastávka MHD – " + sub_txt.lower()
        rows = []
        if a is not None:
            rows.append(["Kategorie přístupnosti", accl.get(str(a), str(a))])
        if cat is not None:
            rows.append(["Kategorie objektu", dom.get("cat", {}).get(str(cat), str(cat))])
        if sub is not None and sub != cat:
            rows.append(["Subkategorie", dom.get("subcat", {}).get(str(sub), str(sub))])
        c = OVA_SUB.get(sub) or OVA_CAT.get(cat, "urady")
        oid = p.get("objectid")
        yield {
            "src": "ostrava", "id": "ova" + str(oid), "n": sub_txt, "la": la, "lo": lo, "c": c, "s": sub_txt,
            "w": w, "t": w if c == "wc" else None, "structured": 0, "noname": True,
            "x": {"src": "ostrava", "name": None, "label": "Ostrava – Mapa přístupnosti", "url": OVA_APP,
                  "date": None, "license": "CC BY-SA 4.0", "attribution": "datový podklad © Statutární město Ostrava",
                  "cat": CAT3.get(w), "rows": rows},
        }


# ---------------------------------------------------------------- hlavní běh

def main():
    fetch_all()
    places_path = ROOT / "data" / "places.json"
    places = json.loads(places_path.read_text(encoding="utf-8"))
    places = [p for p in places if not ID_RE.match(p["i"])]
    for p in places:
        if p.get("x"):
            p["x"] = [x for x in p["x"] if x.get("src") not in SRC]
            if not p["x"]:
                p.pop("x")

    KRAJE = load_gh("kraje_gh.json", strip=True)
    OBCE = load_gh("obce_gh.json")
    grid = Grid(places)
    added, matched = Counter(), Counter()

    for gen in (wc_items, ova_items):
        for it in gen():
            target, best = None, None
            for d, p in grid.near(it["la"], it["lo"], 40):
                if p["c"] == it["c"] and not ID_RE.match(p["i"]) and (best is None or d < best):
                    target, best = p, d
            if target is None:
                target = {"i": it["id"], "n": it["n"], "c": it["c"], "s": it["s"], "la": round(it["la"], 6), "lo": round(it["lo"], 6),
                          "w": it.get("w"), "t": it.get("t"), "o": locate(OBCE, it["la"], it["lo"]), "k": locate(KRAJE, it["la"], it["lo"])}
                if it.get("a"):
                    target["a"] = it["a"]
                if it["x"].get("date"):
                    target["u"] = it["x"]["date"]
                places.append(target)
                grid.add(target)
                added[it["src"]] += 1
            else:
                matched[it["src"]] += 1
                if not target.get("w") and it.get("w"):
                    target["w"] = it["w"]
                if target["c"] == "wc" and not target.get("t") and it.get("t"):
                    target["t"] = it["t"]
                if it.get("a") and not target.get("a"):
                    target["a"] = it["a"]
            if it.get("noname"):
                it["x"]["name"] = target["n"]
            target.setdefault("x", []).append(it["x"])

    places.sort(key=lambda r: (r["k"] or "", r["o"] or "", r["n"] or ""))
    places_path.write_text(json.dumps(places, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    stats_path = ROOT / "data" / "stats.json"
    stats = json.loads(stats_path.read_text(encoding="utf-8"))
    cats, by_city = Counter(), {}
    for r in places:
        by_city.setdefault(r["o"], Counter())[r.get("w") or "unk"] += 1
        cats[r["c"]] += 1
        cats["w_" + str(r.get("w"))] += 1
        if r.get("t"):
            cats["t_" + r["t"]] += 1
    src_counts = Counter(x["src"] for r in places for x in r.get("x", []))
    stats["total"] = len(places)
    stats["cats"] = dict(cats)
    stats["cities"] = sorted(({"o": o, "n": sum(c.values()), **c} for o, c in by_city.items() if o), key=lambda x: -x["n"])[:400]
    stats["kraje"] = dict(Counter(r["k"] for r in places))
    stats.setdefault("sources", {}).update({k: src_counts.get(k, 0) for k in SRC})
    stats["measured"] = sum(1 for r in places if r.get("x"))
    stats.setdefault("open_data", {}).update({
        "praha_wc": {"name": "IPR Praha – veřejné toalety", "attribution": "IPR Praha", "license": "CC BY",
                     "url": WC_LAYER, "license_url": WC_LIC_URL, "added": added["praha_wc"], "matched": matched["praha_wc"]},
        "ostrava": {"name": "Ostrava – Mapa přístupnosti", "attribution": "datový podklad © Statutární město Ostrava",
                    "license": "CC BY-SA 4.0", "url": OVA_APP, "license_url": OVA_LIC_URL,
                    "added": added["ostrava"], "matched": matched["ostrava"]},
    })
    stats_path.write_text(json.dumps(stats, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"celkem míst: {len(places)}, s údaji ze zdrojů: {stats['measured']}")
    print("nová místa:", dict(added), "spárováno:", dict(matched))


if __name__ == "__main__":
    main()
