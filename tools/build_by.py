"""Sloučí data pro Bavorsko a rozdělí všechna data webu (ČR + Bavorsko) po krajích / vládních obvodech.

Vstupy (Bavorsko):
  data/by/places_<slug>.json      – místa z OpenStreetMap (tools/osm_by_06.py, osm_by_123.py, osm_by_45.py)
  data/by/open_*.json             – otevřená data měst a země (by_open_mnichov.py, build_open_franky.py, by_open_zemske.py)
  data/research/out_by/*.json     – rešerše webů provozovatelů a turistických portálů
  data/by/zdroje_*.json           – popis zdrojů otevřených dat (licence, doložka)
  data/research/photos.json       – fotky z Wikimedia Commons ({"<id>": "File:…"})
Vstup (Česko): data/places.json z české pipeline
  build_data.py -> build_open.py -> build_open2.py -> merge_research.py   (tu tento skript nemění, jen ji doplní)

Postup:
  1) otevřená data: záznam se stejným id jako místo z OSM (např. nádraží DB spárovaná podle RIL100) se připojí přímo;
     jinak se hledá místo z OSM do 40 m s podobným názvem -> pole "x" se připojí k němu, "w"/"t" se doplní jen když chybí;
     bez shody vznikne nové místo (s vlastním id ze zdroje)
  2) rešerše: stejná logika jako tools/merge_research.py (pole "r", nová místa "rh…" s "nw":1, sloučení do 60 m)
  3) všem českým místům se doplní "z":"cz" (zapíše se zpět do data/places.json), bavorským "z":"de"
  4) výstup: data/regions/<zeme>-<slug>.json (pole míst), data/regions/index.json, data/by/zdroje.json
     a do data/stats.json se přidají klíče by_zeme a by_region (stávající klíče pro ČR zůstanou)
Soubor regionu nad LIMIT bajtů se rozdělí na části <id>-1.json, <id>-2.json… (v indexu je pak "soubor" seznam).

Idempotentní: vstupní soubory nemění (kromě doplnění "z" v data/places.json), výstupy přepisuje celé.
Spuštění:  python tools/build_by.py
"""
import glob
import hashlib
import json
import math
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

from shapely.geometry import LineString, Point
from shapely.ops import polygonize, unary_union
from shapely.prepared import prep

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_data as bd  # noqa: E402
import merge_research as mr  # noqa: E402  (to_record, similar pro rešerši – stejná pravidla jako v ČR)

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
BYD = DATA / "by"
RAW = DATA / "raw"
OUTREG = DATA / "regions"
LIMIT = 8_000_000

OBVODY = {  # OSM relace vládních obvodů (data/raw/by_bezirke.json) -> název na webu, slug
    17593: ("Dolní Bavorsko", "dolni-bavorsko"), 17585: ("Dolní Franky", "dolni-franky"),
    2145274: ("Horní Bavorsko", "horni-bavorsko"), 17596: ("Horní Falc", "horni-falc"),
    17592: ("Horní Franky", "horni-franky"), 17614: ("Střední Franky", "stredni-franky"),
    17657: ("Švábsko", "svabsko"),
}
CAT_ALIAS = dict(mr.CAT_ALIAS, hotel="ubytovani", penzion="ubytovani", hostel="ubytovani", kemp="ubytovani",
                 apartmany="ubytovani", motel="ubytovani")

# podobnost názvů pro párování otevřených dat (jako build_open.py, + běžná německá slova)
STOP = set("""a i u v ve na do z ze s se o k sv the and of der die das und am im an zum zur bei vom von st
hotel gasthof gasthaus restaurant cafe museum kirche rathaus bahnhof haltestelle parkplatz toilette toiletten wc
offentliche oeffentliche barrierefreie barrierefreies behindertenparkplatz stadt markt gemeinde""".split())


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+", " ", s).split()


def similar_open(a, b):
    ta, tb = norm(a), norm(b)
    if not ta or not tb:
        return False
    if SequenceMatcher(None, " ".join(ta), " ".join(tb)).ratio() >= 0.7:
        return True
    sa = {t for t in ta if len(t) >= 3 and t not in STOP}
    sb = {t for t in tb if len(t) >= 3 and t not in STOP}
    return bool(sa & sb)


class Grid:
    """Prostorový index (buňky ~0,001° ≈ 70–110 m, hledá se v okolí 3×3 buněk)."""

    def __init__(self):
        self.cells = defaultdict(list)

    @staticmethod
    def key(la, lo):
        return (int(math.floor(la * 1000)), int(math.floor(lo * 1000)))

    def add(self, p):
        self.cells[self.key(p["la"], p["lo"])].append(p)

    def near(self, la, lo, r):
        a, b = self.key(la, lo)
        for i in (-1, 0, 1):
            for j in (-1, 0, 1):
                for p in self.cells.get((a + i, b + j), ()):
                    d = mr.dist_m(la, lo, p["la"], p["lo"])
                    if d <= r:
                        yield d, p


def rel_poly(rel):
    lines = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]]) for m in rel["members"]
             if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry")]
    return unary_union(list(polygonize(unary_union(lines))))


def load_by_geo():
    border = rel_poly(json.loads((RAW / "by_boundary.json").read_text(encoding="utf-8"))["elements"][0])
    obv = []
    for rel in json.loads((RAW / "by_bezirke.json").read_text(encoding="utf-8"))["elements"]:
        if rel["id"] in OBVODY:
            obv.append((OBVODY[rel["id"]][0], prep(rel_poly(rel))))
    return prep(border.buffer(0.002)), obv


def locate_obvod(obv, la, lo):
    pt = Point(lo, la)
    for name, g in obv:
        if g.contains(pt):
            return name
    return ""


def load_json(path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


# ---------------------------------------------------------------- Bavorsko

def build_bavaria(st):
    places, by_id = [], {}
    for f in sorted(glob.glob(str(BYD / "places_*.json"))):
        for p in load_json(f, []):
            if p["i"] in by_id:
                st["by_osm_dup_id"] += 1
                continue
            p["z"] = "de"
            places.append(p)
            by_id[p["i"]] = p
    st["by_osm"] = len(places)
    grid = Grid()
    for p in places:
        grid.add(p)

    # 1) otevřená data
    for f in sorted(glob.glob(str(BYD / "open_*.json"))):
        for it in load_json(f, []):
            xs = it.get("x") or []
            target = by_id.get(it["i"])
            if target is not None:
                st["open_same_id"] += 1
            else:
                best = None
                for d, p in grid.near(it["la"], it["lo"], 40):
                    if (p["c"] == "parkovani") != (it["c"] == "parkovani"):
                        continue
                    if similar_open(it.get("n"), p.get("n")) and (best is None or d < best[0]):
                        best = (d, p)
                target = best[1] if best else None
                if target is not None:
                    st["open_matched_40m"] += 1
            if target is None:
                new = dict(it)
                new["z"] = "de"
                places.append(new)
                by_id[new["i"]] = new
                grid.add(new)
                st["open_new"] += 1
                continue
            for k in ("w", "t"):
                if not target.get(k) and it.get(k):
                    target[k] = it[k]
            for k in ("a", "web", "ph", "pk"):
                if it.get(k) and not target.get(k):
                    target[k] = it[k]
            target.setdefault("x", []).extend(xs)

    # 2) rešerše webů (stejně jako merge_research.py)
    border, obv = load_by_geo()
    rgrid = defaultdict(list)

    def cell(la, lo):
        return (int(la * 100), int(lo * 100))

    for p in places:
        rgrid[cell(p["la"], p["lo"])].append(p)

    def nearby_same(name, la, lo):
        ca, cb = cell(la, lo)
        best = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for q in rgrid.get((ca + dx, cb + dy), []):
                    d = mr.dist_m(la, lo, q["la"], q["lo"])
                    if d <= 60 and mr.similar(name, q["n"]) and (best is None or d < best[0]):
                        best = (d, q)
        return best[1] if best else None

    research_sources = []
    for f in sorted(glob.glob(str(DATA / "research" / "out_by" / "*.json"))):
        data = load_json(f)
        if not isinstance(data, dict):
            st["res_bad_file"] += 1
            continue
        st["res_files"] += 1
        for s in data.get("sources") or []:
            if isinstance(s, dict):
                research_sources.append(dict(s, soubor=Path(f).name))
        date = mr.clean_str(data.get("checked_date"), 10) or None
        st["res_not_found"] += len(data.get("not_found") or [])
        for pl in data.get("places") or []:
            if not isinstance(pl, dict):
                continue
            st["res_in"] += 1
            rec = mr.to_record(pl, date)
            if not re.match(r"^https?://", rec.get("url", "")):
                st["res_drop_no_url"] += 1
                continue
            if not (rec.get("items") or rec.get("measurements") or rec.get("claim") in ("yes", "limited", "no")):
                st["res_drop_empty"] += 1
                continue
            osm_id = mr.clean_str(pl.get("osm_id"), 60)
            if osm_id.lower() in ("null", "none", "-"):
                osm_id = ""
            target = by_id.get(osm_id) if osm_id else None
            if osm_id and target is None:
                st["res_osm_id_unknown"] += 1
            if target is None:
                try:
                    la, lo = float(pl.get("lat")), float(pl.get("lng"))
                except (TypeError, ValueError):
                    st["res_drop_no_coords"] += 1
                    continue
                if not (47.2 < la < 50.6 and 8.9 < lo < 13.9) or not border.contains(Point(lo, la)):
                    st["res_drop_outside_by"] += 1
                    continue
                name = mr.clean_str(pl.get("name"), 160)
                if not name:
                    st["res_drop_no_name"] += 1
                    continue
                target = nearby_same(name, la, lo)
                if target is not None:
                    st["res_merged_dedup"] += 1
                else:
                    raw_cat = (pl.get("category") or "").strip().lower()
                    cat = CAT_ALIAS.get(raw_cat, raw_cat)
                    if cat not in mr.CATS:
                        st["res_drop_bad_category"] += 1
                        continue
                    la, lo = round(la, 6), round(lo, 6)
                    pid = "rh" + hashlib.sha1(f"{name}|{la:.5f}|{lo:.5f}".encode("utf-8")).hexdigest()[:10]
                    claim = rec.get("claim")
                    target = {"i": pid, "n": name, "c": cat, "s": mr.SUB[cat], "la": la, "lo": lo,
                              "w": claim if claim in ("yes", "limited", "no") else None, "t": None,
                              "o": mr.clean_str(pl.get("obec"), 80), "k": locate_obvod(obv, la, lo), "z": "de", "nw": 1}
                    addr = mr.clean_str(pl.get("address"), 160)
                    if addr:
                        target["a"] = addr
                    target["web"] = rec["url"]
                    places.append(target)
                    by_id[pid] = target
                    rgrid[cell(la, lo)].append(target)
                    st["res_new_places"] += 1
            else:
                st["res_matched_id"] += 1
            lst = target.setdefault("r", [])
            if any(x["url"] == rec["url"] and x.get("items") == rec.get("items") for x in lst):
                st["res_dup_record"] += 1
                continue
            lst.append(rec)
            st["res_records"] += 1
    return places, by_id, border, obv, research_sources


# ---------------------------------------------------------------- hlavní běh

def summary(pl):
    c = Counter()
    for p in pl:
        c["total"] += 1
        c["w_" + str(p.get("w"))] += 1
        if p.get("x"):
            c["x"] += 1
        if p.get("r"):
            c["r"] += 1
            c["r_records"] += len(p["r"])
        if p.get("nw"):
            c["r_new"] += 1
        if p.get("img"):
            c["img"] += 1
    out = {k: c[k] for k in ("total", "w_yes", "w_limited", "w_no", "w_None", "x", "r", "r_records", "r_new", "img")}
    out["cats"] = dict(Counter(p["c"] for p in pl).most_common())
    return out


def write_region(rid, pl):
    pl.sort(key=lambda r: (r.get("o") or "", r["n"]))
    blobs = [json.dumps(p, ensure_ascii=False, separators=(",", ":")) for p in pl]
    size = sum(len(b.encode("utf-8")) + 1 for b in blobs) + 2
    for old in glob.glob(str(OUTREG / f"{rid}.json")) + glob.glob(str(OUTREG / f"{rid}-[0-9]*.json")):
        Path(old).unlink()
    if size <= LIMIT:
        parts = [blobs]
    else:
        n = math.ceil(size / (LIMIT * 0.9))
        per = math.ceil(len(blobs) / n)
        parts = [blobs[i:i + per] for i in range(0, len(blobs), per)]
    names = []
    for i, part in enumerate(parts, 1):
        fn = f"{rid}.json" if len(parts) == 1 else f"{rid}-{i}.json"
        (OUTREG / fn).write_text("[" + ",".join(part) + "]", encoding="utf-8")
        names.append("data/regions/" + fn)
    return names[0] if len(names) == 1 else names


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    st = Counter()

    # --- Bavorsko
    by_places, by_id, by_border, obv, research_sources = build_bavaria(st)

    # fotky (Wikimedia Commons) – jen místům bez fotky
    photos = load_json(DATA / "research" / "photos.json", {}) or {}
    for pid, f_ in photos.items():
        p = by_id.get(pid)
        if p is not None and isinstance(f_, str) and f_.startswith("File:") and not p.get("img"):
            p["img"] = f_
            st["by_photo_added"] += 1

    # --- Česko: doplnit "z" a zapsat zpět
    cz = json.loads((DATA / "places.json").read_text(encoding="utf-8"))
    for p in cz:
        p["z"] = "cz"
    (DATA / "places.json").write_text(json.dumps(cz, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # místa z české pipeline, která leží v Bavorsku a jsou i v bavorských datech (stejné id) -> jen jednou, bavorská verze;
    # údaje navíc z české verze (r, x, img) se k ní připojí
    cz_regions = []
    for p in cz:
        q = by_id.get(p["i"])
        if q is not None:
            st["cz_id_in_by"] += 1
            for k in ("r", "x"):
                if p.get(k):
                    have = {json.dumps(v, sort_keys=True, ensure_ascii=False) for v in q.get(k, [])}
                    for v in p[k]:
                        if json.dumps(v, sort_keys=True, ensure_ascii=False) not in have:
                            q.setdefault(k, []).append(v)
            if p.get("img") and not q.get("img"):
                q["img"] = p["img"]
            continue
        cz_regions.append(p)

    # místa bez kraje (příhraniční, z tolerance 0,002° kolem hranice ČR v build_data.py) -> nejbližší kraj
    KRAJE = bd.load_gh("kraje_gh.json", strip=True)
    cz_border = bd.load_border()
    border_list = []
    for p in cz_regions:
        if not p.get("k"):
            pt = Point(p["lo"], p["la"])
            names, geoms, _ = KRAJE
            j = min(range(len(geoms)), key=lambda i: geoms[i].distance(pt))
            # záznam v places.json se nemění, kraj se doplní jen do souboru regionu
            border_list.append((p["i"], p["n"], names[j], round(geoms[j].distance(pt) * 111000)))
            p["_k"] = names[j]

    # --- regiony
    OUTREG.mkdir(parents=True, exist_ok=True)
    groups = defaultdict(list)
    names_by_id = {}
    for p in cz_regions:
        k = p.get("k") or p.pop("_k")
        rid = "cz-" + slugify(k)
        names_by_id[rid] = (k, "cz")
        if not p.get("k"):
            p = dict(p, k=k)
        groups[rid].append(p)
    for p in by_places:
        k = p.get("k") or locate_obvod(obv, p["la"], p["lo"])
        if not k:
            st["by_no_region"] += 1
            continue
        rid = "de-" + slugify(k)
        names_by_id[rid] = (k, "de")
        groups[rid].append(p)

    index, by_region = [], {}
    for rid in sorted(groups, key=lambda r: (r[:2] != "cz", r)):
        pl = groups[rid]
        soubor = write_region(rid, pl)
        nazev, zeme = names_by_id[rid]
        bbox = [round(min(p["lo"] for p in pl), 5), round(min(p["la"] for p in pl), 5),
                round(max(p["lo"] for p in pl), 5), round(max(p["la"] for p in pl), 5)]
        index.append({"id": rid, "nazev": nazev, "zeme": zeme, "bbox": bbox, "pocet": len(pl), "soubor": soubor})
        by_region[rid] = dict(summary(pl), nazev=nazev, zeme=zeme)
    (OUTREG / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")

    # --- zdroje Bavorska
    zdroje = [{"nazev": "OpenStreetMap – výřezy pro vládní obvody Bavorska (Geofabrik)",
               "url": "https://download.geofabrik.de/europe/germany/bayern.html",
               "licence": "ODbL 1.0, https://opendatacommons.org/licenses/odbl/",
               "dolozka": "© přispěvatelé OpenStreetMap (openstreetmap.org/copyright), ODbL",
               "pocet": st["by_osm"]}]
    seen = {zdroje[0]["url"]}
    for f in sorted(glob.glob(str(BYD / "zdroje_*.json"))):
        for z in load_json(f, []):
            if z.get("url") in seen:
                continue
            seen.add(z.get("url"))
            zdroje.append(dict(z, soubor=Path(f).name))
    (BYD / "zdroje.json").write_text(json.dumps({"otevrena_data": zdroje, "reserse": research_sources},
                                                ensure_ascii=False, indent=1), encoding="utf-8")

    # --- statistiky
    stats_path = DATA / "stats.json"
    stats = load_json(stats_path, {}) or {}
    all_cz = [p for g, pl in groups.items() if g.startswith("cz-") for p in pl]
    all_de = [p for g, pl in groups.items() if g.startswith("de-") for p in pl]
    stats["by_zeme"] = {"cz": summary(all_cz), "de": summary(all_de)}
    stats["by_region"] = by_region
    stats["by_built"] = {"open_same_id": st["open_same_id"], "open_matched_40m": st["open_matched_40m"],
                         "open_new": st["open_new"], "research_records": st["res_records"],
                         "research_new": st["res_new_places"], "research_not_found": st["res_not_found"]}
    stats_path.write_text(json.dumps(stats, ensure_ascii=False, indent=1), encoding="utf-8")

    # --- kontroly
    ids = Counter(p["i"] for pl in groups.values() for p in pl)
    dups = [i for i, n in ids.items() if n > 1]
    out_cz = [p["i"] for p in all_cz if not cz_border.contains(Point(p["lo"], p["la"]))]
    out_by = [p["i"] for p in all_de if not by_border.contains(Point(p["lo"], p["la"]))]
    wrong_obv = Counter()
    for p in all_de:
        o = locate_obvod(obv, p["la"], p["lo"])
        if o and o != p["k"]:
            wrong_obv[f"{p['k']} -> {o}"] += 1

    print(f"Bavorsko OSM: {st['by_osm']} (duplicitní id mezi soubory {st['by_osm_dup_id']})")
    print(f"Otevřená data: stejné id {st['open_same_id']}, spárováno do 40 m {st['open_matched_40m']}, nová místa {st['open_new']}")
    print(f"Rešerše BY: soubory {st['res_files']}, vstup {st['res_in']}, záznamy {st['res_records']}, k id {st['res_matched_id']}, "
          f"sloučeno do 60 m {st['res_merged_dedup']}, nová místa {st['res_new_places']}, neznámé osm_id {st['res_osm_id_unknown']}")
    print(f"  zahozeno: bez URL {st['res_drop_no_url']}, bez údajů {st['res_drop_empty']}, bez souřadnic {st['res_drop_no_coords']}, "
          f"mimo Bavorsko {st['res_drop_outside_by']}, bez názvu {st['res_drop_no_name']}, kategorie {st['res_drop_bad_category']}, "
          f"duplicitní záznam {st['res_dup_record']}; not_found {st['res_not_found']}")
    print(f"Fotky BY z photos.json: {st['by_photo_added']}; ČR místa se stejným id v BY: {st['cz_id_in_by']}; BY bez obvodu: {st['by_no_region']}")
    print(f"Příhraniční místa ČR bez kraje (přiřazen nejbližší kraj): {len(border_list)}")
    for b in border_list:
        print("   ", b)
    print(f"Kontrola: duplicitní id {len(dups)} {dups[:10]}, ČR mimo hranici(+0,002°) {len(out_cz)}, BY mimo hranici(+0,002°) {len(out_by)} {out_by[:10]}")
    print(f"  BY: k neodpovídá polygonu obvodu: {sum(wrong_obv.values())} {dict(wrong_obv)}")
    for e in index:
        print(f"  {e['id']:28s} {e['pocet']:6d}  {e['soubor']}")
    print("ČR:", json.dumps(stats["by_zeme"]["cz"], ensure_ascii=False))
    print("DE:", json.dumps(stats["by_zeme"]["de"], ensure_ascii=False))


if __name__ == "__main__":
    main()
