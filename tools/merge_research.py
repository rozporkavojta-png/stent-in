"""Sloučí výsledky webové rešerše (data/research/out/*.json) do data/places.json.

Každý záznam rešerše = co o přístupnosti skutečně uvádí konkrétní web (s URL a datem kontroly).
  * místo s osm_id  -> záznam se přidá do pole "r" existujícího místa (údaje z OSM se nemění)
  * místo bez osm_id -> nové místo s id "rh" + krátký hash (název + souřadnice); pokud do 60 m
    leží existující místo s podobným názvem, záznam se připojí k němu
Validace: bez URL nebo bez souřadnic uvnitř ČR se záznam zahodí.
Idempotentní: na začátku odstraní všechna dřívější pole "r" a všechna místa "rh…" (a "nw": 1).

Spuštění:  python tools/merge_research.py [složka_se_vstupy] [--places soubor] [--stats soubor]
           (výchozí data/research/out, data/places.json, data/stats.json)
Pořadí:    tools/build_data.py -> tools/build_open.py -> tools/build_open2.py -> tools/merge_research.py
Fotky:     doplní pole "img" z data/research/photos.json (jen místům bez fotky z OSM)
"""
import difflib
import glob
import hashlib
import json
import math
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shapely.geometry import Point  # noqa: E402
import build_data as bd  # noqa: E402  (load_gh, locate, load_border – stejné hranice jako u OSM dat)

ROOT = Path(__file__).resolve().parent.parent
PLACES = ROOT / "data" / "places.json"
STATS = ROOT / "data" / "stats.json"
CATS = {"ubytovani", "restaurace", "wc", "pamatky", "kultura", "priroda", "sport", "zdravi", "urady", "doprava", "obchody", "parkovani"}
SUB = {"ubytovani": "Ubytování", "restaurace": "Restaurace", "wc": "Veřejné WC", "pamatky": "Památka", "kultura": "Kultura",
       "priroda": "Příroda", "sport": "Sport", "zdravi": "Zdravotnictví", "urady": "Úřad", "doprava": "Doprava",
       "obchody": "Obchod", "parkovani": "Parkoviště"}
CAT_ALIAS = {"urad": "urady", "pamatka": "pamatky", "obchod": "obchody",
             "parkoviste": "parkovani", "zdravotnictvi": "zdravi", "toalety": "wc"}
ITEM_KEYS = ["vstup", "wc", "pokoj", "koupelna", "parkovani", "vytah", "jine"]
NEW_ID = re.compile(r"^rh[0-9a-f]+$")
STOP = {"hotel", "penzion", "pension", "restaurace", "restaurant", "kavarna", "cafe", "muzeum", "galerie", "zamek", "hrad",
        "apartmany", "kemp", "camp", "a", "u", "v", "na", "the", "spa", "wellness", "resort", "hostel", "bistro", "pivnice", "hospoda"}


def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9 ]+", " ", s).split()


def similar(a, b):
    ta, tb = norm(a), norm(b)
    if not ta or not tb:
        return False
    if " ".join(ta) == " ".join(tb):
        return True
    ka, kb = set(ta) - STOP, set(tb) - STOP
    if ka and kb and (ka <= kb or kb <= ka):
        return True
    return difflib.SequenceMatcher(None, " ".join(ta), " ".join(tb)).ratio() >= 0.75


def dist_m(la1, lo1, la2, lo2):
    dx = (lo2 - lo1) * math.cos(math.radians((la1 + la2) / 2)) * 111320
    dy = (la2 - la1) * 110540
    return math.hypot(dx, dy)


def clean_str(v, maxlen=400):
    if not isinstance(v, str):
        return ""
    v = re.sub(r"\s+", " ", v).strip()
    return v[:maxlen]


def to_record(pl, date):
    items = {k: clean_str((pl.get("accessibility") or {}).get(k)) for k in ITEM_KEYS}
    items = {k: v for k, v in items.items() if v}
    meas = []
    for m in pl.get("measurements") or []:
        if not isinstance(m, dict):
            continue
        co, val = clean_str(m.get("co"), 120), m.get("hodnota")
        if not co or not isinstance(val, (int, float)) or isinstance(val, bool):
            continue
        meas.append({"co": co, "hodnota": val, "jednotka": clean_str(m.get("jednotka"), 12) or ""})
    claim = pl.get("wheelchair_claim") if pl.get("wheelchair_claim") in ("yes", "limited", "no", "unknown") else "unknown"
    quote = clean_str(pl.get("evidence_quote"), 200)
    if len(quote.split()) > 15:
        quote = " ".join(quote.split()[:15]) + "…"
    rec = {"url": clean_str(pl.get("source_url"), 500), "date": date, "source_type": clean_str(pl.get("source_type"), 60) or None,
           "claim": claim, "items": items, "measurements": meas, "quote": quote or None}
    return {k: v for k, v in rec.items() if v not in (None, [], {})}


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    import argparse
    ap = argparse.ArgumentParser(description="Sloučí rešerši webů do data/places.json")
    ap.add_argument("src", nargs="?", default=str(ROOT / "data" / "research" / "out"))
    ap.add_argument("--places", default=str(PLACES), help="vstup i výstup (výchozí data/places.json)")
    ap.add_argument("--stats", default=str(STATS))
    args = ap.parse_args()
    src_dir, PL, STF = Path(args.src), Path(args.places), Path(args.stats)
    places = json.loads(PL.read_text(encoding="utf-8"))

    # 1) idempotence: pryč s výsledky předchozího běhu
    before = len(places)
    places = [p for p in places if not (p.get("nw") or NEW_ID.match(p["i"]))]
    removed_new = before - len(places)
    for p in places:
        p.pop("r", None)
    by_id = {p["i"]: p for p in places}

    border = bd.load_border()
    KRAJE = bd.load_gh("kraje_gh.json", strip=True)
    OBCE = bd.load_gh("obce_gh.json")

    grid = defaultdict(list)  # buňka ~ 0,01° -> místa (pro hledání do 60 m)

    def cell(la, lo):
        return (int(la * 100), int(lo * 100))

    for p in places:
        grid[cell(p["la"], p["lo"])].append(p)

    def nearby_same(name, la, lo):
        ca, cb = cell(la, lo)
        best = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for q in grid.get((ca + dx, cb + dy), []):
                    d = dist_m(la, lo, q["la"], q["lo"])
                    if d <= 60 and similar(name, q["n"]) and (best is None or d < best[0]):
                        best = (d, q)
        return best[1] if best else None

    st = Counter()
    files = sorted(glob.glob(str(src_dir / "*.json")))
    for f in files:
        try:
            data = json.loads(Path(f).read_text(encoding="utf-8"))
        except Exception as e:
            print(f"! {Path(f).name}: nejde načíst ({e})")
            st["bad_file"] += 1
            continue
        if not isinstance(data, dict):
            print(f"! {Path(f).name}: nemá očekávaný tvar (objekt s klíčem places)")
            st["bad_file"] += 1
            continue
        st["files"] += 1
        date = clean_str(data.get("checked_date"), 10) or None
        for pl in data.get("places") or []:
            if not isinstance(pl, dict):
                continue
            st["in"] += 1
            rec = to_record(pl, date)
            if not re.match(r"^https?://", rec.get("url", "")):
                st["drop_no_url"] += 1
                continue
            if not (rec.get("items") or rec.get("measurements") or rec.get("claim") in ("yes", "limited", "no")):
                st["drop_empty"] += 1
                continue
            osm_id = clean_str(pl.get("osm_id"), 40)
            if osm_id.lower() in ("null", "none", "-"):
                osm_id = ""
            target = by_id.get(osm_id) if osm_id else None
            if osm_id and target is None:
                st["osm_id_unknown"] += 1  # zkusíme ho dál jako nové místo, pokud má souřadnice
            if target is None:
                try:
                    la, lo = float(pl.get("lat")), float(pl.get("lng"))
                except (TypeError, ValueError):
                    st["drop_no_coords"] += 1
                    continue
                if not (48.4 < la < 51.2 and 11.9 < lo < 19.0) or not border.contains(Point(lo, la)):
                    st["drop_outside_cz"] += 1
                    continue
                name = clean_str(pl.get("name"), 160)
                if not name:
                    st["drop_no_name"] += 1
                    continue
                target = nearby_same(name, la, lo)
                if target is not None:
                    st["merged_dedup"] += 1
                else:
                    cat = CAT_ALIAS.get(pl.get("category"), pl.get("category"))
                    cat = cat if cat in CATS else None
                    if not cat:
                        st["drop_bad_category"] += 1
                        continue
                    la, lo = round(la, 6), round(lo, 6)
                    pid = "rh" + hashlib.sha1(f"{name}|{la:.5f}|{lo:.5f}".encode("utf-8")).hexdigest()[:10]
                    claim = rec.get("claim")
                    target = {"i": pid, "n": name, "c": cat, "s": SUB[cat], "la": la, "lo": lo,
                              "w": claim if claim in ("yes", "limited", "no") else None, "t": None,
                              "o": bd.locate(OBCE, la, lo) or clean_str(pl.get("obec"), 80),
                              "k": bd.locate(KRAJE, la, lo), "nw": 1}
                    addr = clean_str(pl.get("address"), 160)
                    if addr:
                        target["a"] = addr
                    target["web"] = rec["url"]
                    places.append(target)
                    by_id[pid] = target
                    grid[cell(la, lo)].append(target)
                    st["new_places"] += 1
            else:
                st["matched_osm"] += 1
            lst = target.setdefault("r", [])
            if any(x["url"] == rec["url"] and x.get("items") == rec.get("items") for x in lst):
                st["dup_record"] += 1
                continue
            lst.append(rec)
            st["records"] += 1
        st["not_found"] += len(data.get("not_found") or [])

    # 2) fotky z Wikimedia Commons (data/research/photos.json: {"<id>": "File:<název>"});
    #    OSM tag wikimedia_commons/image z build_data.py má přednost, jinak se doplní z rešerše
    photos_path = ROOT / "data" / "research" / "photos.json"
    photos = json.loads(photos_path.read_text(encoding="utf-8")) if photos_path.exists() else {}
    for pid, f_ in photos.items():
        p = by_id.get(pid)
        if p is None:
            st["photo_unknown_id"] += 1
        elif isinstance(f_, str) and f_.startswith("File:") and not p.get("img"):
            p["img"] = f_
            st["photo_added"] += 1

    places.sort(key=lambda r: (r.get("k") or "", r.get("o") or "", r["n"]))
    PL.write_text(json.dumps(places, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    with_r = [p for p in places if p.get("r")]
    stats = json.loads(STF.read_text(encoding="utf-8")) if STF.exists() else {}
    stats["total"] = len(places)
    # přepočet souhrnů stejně jako v build_data.py / build_open.py (nová místa z rešerše se do nich promítnou)
    cats, by_city = Counter(), defaultdict(Counter)
    for r in places:
        cats[r["c"]] += 1
        cats["w_" + str(r.get("w"))] += 1
        if r.get("t"):
            cats["t_" + r["t"]] += 1
        by_city[r.get("o") or ""][r.get("w") or "unk"] += 1
    stats["cats"] = dict(cats)
    stats["cities"] = sorted(({"o": o, "n": sum(c.values()), **c} for o, c in by_city.items() if o), key=lambda x: -x["n"])[:400]
    stats["kraje"] = dict(Counter(r.get("k") or "" for r in places))
    stats["measured"] = sum(1 for r in places if r.get("x"))
    src = stats.setdefault("sources", {})
    src["research"] = len(with_r)
    src["research_records"] = sum(len(p["r"]) for p in with_r)
    src["research_new"] = sum(1 for p in places if p.get("nw"))
    src["research_measured"] = sum(1 for p in with_r if any(x.get("measurements") for x in p["r"]))
    src["photos"] = sum(1 for p in places if p.get("img"))
    STF.write_text(json.dumps(stats, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"Soubory: {st['files']} (nečitelné {st['bad_file']}), vstupních míst {st['in']}, odstraněno starých nových míst {removed_new}")
    print(f"Záznamy přidané: {st['records']} | k OSM místu: {st['matched_osm']} | sloučeno do 60 m: {st['merged_dedup']} | nová místa: {st['new_places']}")
    print(f"Zahozeno: bez URL {st['drop_no_url']}, bez údajů {st['drop_empty']}, bez souřadnic {st['drop_no_coords']}, mimo ČR {st['drop_outside_cz']}, "
          f"bez názvu {st['drop_no_name']}, špatná kategorie {st['drop_bad_category']}, duplicitní záznam {st['dup_record']}, neznámé osm_id {st['osm_id_unknown']}")
    print(f"Místa s informací od provozovatele: {len(with_r)} (z toho s rozměry {src['research_measured']}); not_found celkem {st['not_found']}; míst celkem {len(places)}")
    print(f"Fotky: doplněno z photos.json {st['photo_added']}, neznámé id {st['photo_unknown_id']}, míst s fotkou celkem {src['photos']}")


if __name__ == "__main__":
    main()
