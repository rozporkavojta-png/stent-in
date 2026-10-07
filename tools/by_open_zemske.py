"""D2c – zemská a celostátní otevřená data o přístupnosti pro Bavorsko -> data/by/open_zemske.json

Prověřeno 2026-10-07. Do výstupu jde jen sada s prokazatelně otevřenou licencí a údaji o přístupnosti míst:

  DB InfraGO – OpenStation (NeTEx, EU PI Stop Offer, „Inventory of Assets“ dle TSI-PRM)
    nabídka:   https://mobilithek.info/offers/879076212433727488  (stažení: https://bahnhof.de/daten/netex)
    licence:   CC0 1.0 – README https://github.com/dbinfrago/openstation-docs („Data in the API … released to
               the public domain (under the CC0 license)“), uloženo v data/raw/by_open/zemske/openstation_readme.md
    surová data: data/raw/by_open/zemske/netex.bin (PublicationTimestamp 2026-10-07T02:29:34Z)
                 -> parse_netex.py -> db_bayern_stations.json (924 stanic, AGS 09…/Province Bayern)

Souřadnice: NeTEx souřadnice obsahuje, ale podle pravidel projektu se berou jen z OSM:
  1) shoda RIL100 (OSM railway:ref), 2) IFOPT/DHID (ref:IFOPT), 3) EVA (uic_ref), 4) přesný název v Bavorsku,
  5) Nominatim (countrycodes=de, 1 dotaz/s, jen výsledek třídy railway/public_transport).
  OSM stanice: data/raw/by_open/zemske/osm_rail_stations.json (Overpass, rel 2145268 Bayern, 2026-10-07).
Obec (o) podle AGS ze zdroje -> název obce z OSM (de:amtlicher_gemeindeschluessel), obvod (k) podle 3. číslice AGS.

Statistiky LfStat (CC BY 4.0) -> data/research/out/tema_bavorsko_zemske.md (funkce stats()).

Spuštění: python tools/by_open_zemske.py
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "by_open" / "zemske"
OUT = ROOT / "data" / "by" / "open_zemske.json"
SRC_OUT = ROOT / "data" / "by" / "zdroje_zemske.json"
MD_OUT = ROOT / "data" / "research" / "out" / "tema_bavorsko_zemske.md"
UA = "kudyprojedu-student-project/0.1"

OS_URL = "https://mobilithek.info/offers/879076212433727488"
OS_DATE = "2026-10-07"
OS_LIC = "CC0-1.0"
OS_ATTR = "DB InfraGO AG – OpenStation (NeTEx), CC0 1.0"

K_BY_AGS = {"1": "Horní Bavorsko", "2": "Dolní Bavorsko", "3": "Horní Falc", "4": "Horní Franky",
            "5": "Střední Franky", "6": "Dolní Franky", "7": "Švábsko"}
W = {"true": "yes", "partial": "limited", "false": "no"}
YN = {"true": "ano", "partial": "částečně", "false": "ne", "unknown": None}
CAT3 = {"yes": "Přístupný", "limited": "Částečně přístupný", "no": "Nepřístupný"}

# ---------------------------------------------------------------- pomocné

_last = [0.0]


def nominatim(q):
    cache_p = RAW / "nominatim_cache.json"
    cache = json.loads(cache_p.read_text(encoding="utf-8")) if cache_p.exists() else {}
    if q in cache:
        return cache[q]
    wait = 1.1 - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": q, "format": "jsonv2", "limit": 5, "countrycodes": "de"})
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
            res = json.loads(r.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        print("nominatim chyba", q, e)
        res = []
    _last[0] = time.time()
    hit = None
    for x in res:
        if x.get("category") in ("railway", "public_transport") and x.get("type") in ("station", "halt", "stop_area", "platform"):
            hit = [float(x["lat"]), float(x["lon"]), x["osm_type"][:1] + str(x["osm_id"]), x.get("display_name")]
            break
    cache[q] = hit
    cache_p.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    return hit


def fnum(x, dec=0):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return f"{v:.{dec}f}".replace(".", ",")


def m2cm(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return round(v * 100) if 0 < v < 10 else None


# ---------------------------------------------------------------- OSM

def osm_index():
    els = json.loads((RAW / "osm_rail_stations.json").read_text(encoding="utf-8"))["elements"]
    idx = {k: defaultdict(list) for k in ("ril", "ifopt", "uic", "name")}
    for e in els:
        t = e.get("tags", {})
        for r in (t.get("railway:ref") or "").split(";"):
            if r.strip():
                idx["ril"][r.strip()].append(e)
        if t.get("ref:IFOPT"):
            idx["ifopt"][t["ref:IFOPT"]].append(e)
        for u in (t.get("uic_ref") or "").split(";"):
            if u.strip():
                idx["uic"][u.strip()].append(e)
        if t.get("name"):
            idx["name"][t["name"]].append(e)
    return idx


def pick(cands, eva):
    if len(cands) > 1:
        same = [e for e in cands if e["tags"].get("uic_ref") == eva]
        if same:
            return same[0]
        rs = [e for e in cands if e["tags"].get("railway") == "station"]
        if rs:
            return rs[0]
    return cands[0]


def coords(e):
    if "lat" in e:
        return e["lat"], e["lon"]
    c = e.get("center") or {}
    return c.get("lat"), c.get("lon")


def locate(s, idx):
    ifopt = ":".join(s["id"].replace("dhid:", "").split(":")[:3])
    for how, key in (("RIL100 (railway:ref)", s.get("ril")), ("IFOPT (ref:IFOPT)", ifopt), ("EVA (uic_ref)", s.get("eva"))):
        k = {"RIL100 (railway:ref)": "ril", "IFOPT (ref:IFOPT)": "ifopt", "EVA (uic_ref)": "uic"}[how]
        if key and idx[k].get(key):
            e = pick(idx[k][key], s.get("eva"))
            la, lo = coords(e)
            return la, lo, e["type"][0] + str(e["id"]), "OSM – shoda " + how
    if len(idx["name"].get(s["name"], [])) == 1:
        e = idx["name"][s["name"]][0]
        la, lo = coords(e)
        return la, lo, e["type"][0] + str(e["id"]), "OSM – shoda názvu"
    base = re.sub(r"\s*\(.*?\)", "", s["name"]).strip()

    def simp(n):
        return re.sub(r"^St\. ", "Sankt ", re.sub(r"\s*\(.*?\)|\s+Hp$", "", n)).strip()
    cand = [e for n, es in idx["name"].items() if simp(n) == simp(base) for e in es]
    if len(cand) == 1:
        la, lo = coords(cand[0])
        return la, lo, cand[0]["type"][0] + str(cand[0]["id"]), "OSM – shoda zjednodušeného názvu (" + cand[0]["tags"]["name"] + ")"
    for q in (f"Bahnhof {base}, {s.get('plz') or ''} {s.get('town') or ''}", f"{base} Bahnhof", f"Bahnhof {base}"):
        hit = nominatim(re.sub(r"\s+", " ", q).strip(" ,"))
        if hit:
            return hit[0], hit[1], hit[2], "Nominatim (OSM) – " + hit[3][:80]
    return None


def gemeinden():
    g = json.loads((RAW / "osm_by_gemeinden_ags.json").read_text(encoding="utf-8"))["elements"]
    out = {}
    for e in g:
        ags = e["tags"].get("de:amtlicher_gemeindeschluessel", "")
        if len(ags) == 8 and e["tags"].get("admin_level") in ("6", "7", "8"):
            out[ags] = e["tags"].get("name")
    return out


# ---------------------------------------------------------------- řádky x

def rows_for(s):
    a = s.get("assess") or {}
    rows = []

    def add(label, val):
        if val not in (None, ""):
            rows.append([label, val])

    add("Kategorie stanice DB (1 = největší, 7 = nejmenší)", s.get("cat"))
    add("Přístup pro vozík (celá stanice)", YN.get(a.get("WheelchairAccess")))
    add("Bezbariérový přístup bez schodů (StepFreeAccess)", YN.get(a.get("StepFreeAccess")))
    add("Taktilní vodicí systém", YN.get(a.get("TactileGuidanceAvailable")))
    plat = [q for q in s["quays"] if "parent" not in q]
    acc = [q for q in plat if q.get("assess")]
    if acc:
        ok = sum(1 for q in acc if q["assess"].get("WheelchairAccess") == "true")
        part = sum(1 for q in acc if q["assess"].get("WheelchairAccess") == "partial")
        add("Nástupiště přístupná pro vozík", f"{ok} z {len(acc)}" + (f" (částečně {part})" if part else ""))
    hs = sorted({m2cm(q.get("PlatformHeight")) for q in s["quays"] if m2cm(q.get("PlatformHeight"))})
    if hs:
        add("Výška nástupní hrany nad kolejí", ", ".join(map(str, hs)) + " cm")
    eq = defaultdict(list)
    for e in s["equip"]:
        eq[e["type"]].append(e)
    lifts = eq.get("LiftEquipment", [])
    if lifts:
        add("Výtahy (počet)", str(len(lifts)))
        dims = Counter(f"{m2cm(e.get('InternalWidth'))} × {m2cm(e.get('Depth'))} cm" for e in lifts
                       if m2cm(e.get("InternalWidth")) and m2cm(e.get("Depth")))
        if dims:
            add("Výtah – kabina (š × hl), nejčastější", "; ".join(f"{d} ({n}×)" for d, n in dims.most_common(3)))
        loads = sorted({int(float(e["MaximumLoad"])) for e in lifts if e.get("MaximumLoad")})
        if loads:
            add("Výtah – nosnost", ", ".join(map(str, loads)) + " kg")
        np_ = sum(1 for e in lifts if e.get("WheelchairPassable") == "false")
        if np_:
            add("Výtahy označené jako nevhodné pro vozík", str(np_))
    ramps = eq.get("RampEquipment", [])
    if ramps:
        lens = [fnum(e.get("Length"), 1) for e in ramps if e.get("Length")]
        add("Rampy (počet)", str(len(ramps)) + (f"; délka {', '.join(lens[:5])} m" if lens else ""))
    if eq.get("EscalatorEquipment"):
        add("Eskalátory (počet)", str(len(eq["EscalatorEquipment"])))
    hub = eq.get("AccessVehicleEquipment", [])
    if hub:
        cap = sorted({int(float(e["BearingCapacity"])) for e in hub if e.get("BearingCapacity")})
        add("Mobilní zvedací plošina k nástupu do vlaku", f"{len(hub)} ks" + (f", nosnost {', '.join(map(str, cap))} kg" if cap else "") + ", obsluhuje personál")
    san = eq.get("SanitaryEquipment", [])
    wcw = [e for e in san if "wheelchairAccessToilet" in (e.get("SanitaryFacilityList") or "")]
    if wcw:
        add("WC pro vozíčkáře", str(len(wcw)))
    elif san:
        add("WC (bez označení pro vozík)", str(len(san)))
    for sv in s["services"]:
        if sv["type"] == "AssistanceService":
            txt = "nutno objednat předem" if sv.get("AssistanceAvailability") == "availableIfBooked" else (sv.get("AssistanceAvailability") or "")
            if sv.get("hours"):
                txt += "; " + ", ".join(h for h in sv["hours"] if h)
            add("Asistence při nástupu (Mobilitätsservice DB)", txt.strip("; "))
            break
    return rows


# ---------------------------------------------------------------- hlavní

def build():
    st = json.loads((RAW / "db_bayern_stations.json").read_text(encoding="utf-8"))
    idx = osm_index()
    gem = gemeinden()
    out, how, miss = [], Counter(), []
    seen = set()
    for s in st:
        loc = locate(s, idx)
        if not loc:
            miss.append(s["name"])
            continue
        la, lo, oid, src = loc
        how[src.split(" – ")[0] + (" " + src.split("shoda ")[1] if "shoda" in src else "")] += 1
        ags = (s.get("ags") or "").replace("ags:", "")
        w = W.get((s.get("assess") or {}).get("WheelchairAccess"))
        wcw = any("wheelchairAccessToilet" in (e.get("SanitaryFacilityList") or "") for e in s["equip"] if e["type"] == "SanitaryEquipment")
        i = oid if oid not in seen else f"{oid}_db{s.get('stada')}"
        seen.add(i)
        rec = {"i": i, "n": s["name"], "c": "doprava", "s": "Nádraží", "la": round(float(la), 6), "lo": round(float(lo), 6),
               "w": w, "t": "yes" if wcw else None, "o": gem.get(ags) or s.get("town") or "", "k": K_BY_AGS.get(ags[2:3], "")}
        if s.get("street"):
            rec["a"] = s["street"]
        if s.get("url"):
            rec["web"] = s["url"]
        rec["u"] = OS_DATE
        rec["z"] = "de"
        rec["x"] = [{"src": "db_openstation", "name": s["name"], "label": "DB InfraGO – OpenStation (bezbariérovost stanic)",
                     "url": OS_URL, "date": OS_DATE, "license": OS_LIC, "attribution": OS_ATTR, "cat": CAT3.get(w),
                     "coords": src, "ids": {"eva": s.get("eva"), "ril100": s.get("ril"), "stada": s.get("stada"), "dhid": s["id"]},
                     "rows": rows_for(s)}]
        out.append(rec)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("stanic:", len(st), "zapsáno:", len(out), "bez souřadnic:", miss)
    print(how)
    print(Counter(r["w"] for r in out), Counter(r["k"] for r in out))
    return out, miss


# ---------------------------------------------------------------- statistiky LfStat (JSON-stat z GENESIS-Online Bayern)

LF = RAW / "lfstat"


def jstat(ds):
    ids, size = ds["id"], ds["size"]
    pos = {k: ds["dimension"][k]["category"]["index"] for k in ids}

    def get(**sel):
        off, mul = 0, 1
        for k, n in reversed(list(zip(ids, size))):
            code = sel.get(k)
            j = pos[k][code] if code is not None else 0
            off += j * mul
            mul *= n
        return ds["value"][off]
    return get


def labels(t):
    s = json.loads((LF / f"s{t}.json").read_text(encoding="utf-8"))
    return {k: v["label"]["de"] for k, v in s["variableValues"].items()}, s["table"]


def ds_by(t, dim):
    for ds in json.loads((LF / f"d{t}.json").read_text(encoding="utf-8"))["data"]:
        if dim in ds["id"]:
            return ds
    return None


def fmt(n):
    return f"{int(round(n)):,}".replace(",", " ")


GEN = "https://genesis-5-prod-extern.bayern.de/datenbank/online/table/"
REG = ["091", "092", "093", "094", "095", "096", "097"]
REG_CZ = dict(zip(REG, ["Horní Bavorsko", "Dolní Bavorsko", "Horní Falc", "Horní Franky", "Střední Franky", "Dolní Franky", "Švábsko"]))


def pct(a, b, dec=1):
    return f"{a / b * 100:.{dec}f}".replace(".", ",") + " %"


def stats(places):
    Y, YP = "2025-12-31", "2023-12-31"
    lab, tab = labels("22711-001r")
    by = jstat(ds_by("22711-001r", "DLAND"))
    rb = jstat(ds_by("22711-001r", "REGBEZ"))
    kr = jstat(ds_by("22711-001r", "KREISE"))
    plab, _ = labels("12411-003r")
    prb = jstat(ds_by("12411-003r", "REGBEZ"))
    pkr = jstat(ds_by("12411-003r", "KREISE"))
    pby = jstat(ds_by("12411-003r", "DLAND"))
    tot = by(STAG=Y, AGR111="%TOTAL%")
    pop = pby(STAG=Y, GES="%TOTAL%")
    L = []
    a = L.append
    st = json.loads((RAW / "db_bayern_stations.json").read_text(encoding="utf-8"))
    wc = Counter(r["w"] for r in places)
    n = len(places)

    a("# Bavorsko – zemská a celostátní otevřená data (úkol D2c)\n")
    a("Stav k 2026-10-07. Prověřeny: Deutsche Bahn (OpenStation, StaDa, FaSta), MVV, VGN, Bayerisches Landesamt für Statistik (LfStat),")
    a("BayernAtlas / LDBV, katalogy open.bydata.de a Mobilithek. Navazuje na `tema_bavorsko.md`, `tema_bavorsko_franky.md`; nic z nich neopakuje.")
    a("Vytvořeno skriptem `tools/by_open_zemske.py` (surová data v `data/raw/by_open/zemske/`).\n")
    a("## Shrnutí\n")
    a(f"- **DB InfraGO OpenStation (CC0)** popisuje bezbariérovost **{len(st)} nádraží a zastávek DB v Bavorsku** [1][2]. Všechna jsou v `data/by/open_zemske.json`"
      " se souřadnicemi z OSM. U každého je stav přístupu pro vozík, nástupiště, výška hrany, výtahy s rozměry kabiny, rampy, plošiny a asistence.")
    a(f"- Podle DB je pro vozík přístupných **{wc['yes']} z {n}** stanic ({pct(wc['yes'], n)}), částečně {wc['limited']}, nepřístupných {wc['no']},"
      f" neznámo {wc[None]} [1].")
    a(f"- **LfStat:** k 31. 12. 2025 žilo v Bavorsku **{fmt(tot)} osob s těžkým zdravotním postižením** (Schwerbehinderte, GdB ≥ 50),"
      f" tj. **{pct(tot, pop)}** obyvatel ({fmt(pop)}) [3][4]. Z toho {fmt(by(STAG=Y, AGR111='ALT065UM'))} ({pct(by(STAG=Y, AGR111='ALT065UM'), tot)}) je ve věku 65+.")
    a("- **MVV a VGN** mají otevřené jízdní řády GTFS (CC BY), ale **bez údajů o bezbariérovosti** (chybí `wheelchair_boarding`) [6][7].")
    a("- **BayernAtlas / LDBV nemá otevřenou vrstvu přístupnosti**: katalog geoportal.bayern.de pro „barrierefrei“ nevrátil žádný záznam [9].\n")

    # ---- DB
    a("## 1. Nádraží DB v Bavorsku (OpenStation, CC0)\n")
    a(f"Zdroj: NeTEx export OpenStation, vydaný 2026-10-07 02:29 UTC [1]. Výběr: Province = Bayern nebo AGS začínající 09. Souřadnice: OSM"
      f" (shoda podle RIL100, IFOPT, EVA nebo názvu), 1 stanice přes Nominatim.\n")
    a("| Vládní obvod | Stanic | Přístupné | Částečně | Nepřístupné | Neznámo | Podíl přístupných |")
    a("|---|---:|---:|---:|---:|---:|---:|")
    for k in REG_CZ.values():
        rs = [r for r in places if r["k"] == k]
        c = Counter(r["w"] for r in rs)
        a(f"| {k} | {len(rs)} | {c['yes']} | {c['limited']} | {c['no']} | {c[None]} | {pct(c['yes'], len(rs))} |")
    a(f"| **Bavorsko** | **{n}** | **{wc['yes']}** | **{wc['limited']}** | **{wc['no']}** | **{wc[None]}** | **{pct(wc['yes'], n)}** |\n")
    lifts = [e for s in st for e in s["equip"] if e["type"] == "LiftEquipment"]
    pl = [q for s in st for q in s["quays"] if "parent" not in q]
    plw = Counter((q.get("assess") or {}).get("WheelchairAccess") for q in pl)
    hc = Counter(m2cm(q.get("PlatformHeight")) for q in pl)
    a(f"- Výtahy: **{len(lifts)}** v {sum(1 for s in st if any(e['type'] == 'LiftEquipment' for e in s['equip']))} stanicích; u většiny je šířka a hloubka kabiny a nosnost.")
    a(f"- Nástupiště: {len(pl)}, z toho přístupných pro vozík **{plw['true']}** ({pct(plw['true'], len(pl))}), nepřístupných {plw['false']}, neznámo {plw['unknown']}.")
    a("- Výška nástupní hrany: " + ", ".join(f"{h} cm: {c}" for h, c in hc.most_common(6) if h) + f"; bez údaje {hc[None]}."
      "")
    a(f"- Mobilní zvedací plošina (Hublift) je na {sum(1 for s in st if any(e['type'] == 'AccessVehicleEquipment' for e in s['equip']))} stanicích,"
      f" asistenční služba DB (nutno objednat) na {sum(1 for s in st if s['services'])}, WC pro vozíčkáře eviduje DB na"
      f" {sum(1 for s in st if any('wheelchairAccessToilet' in (e.get('SanitaryFacilityList') or '') for e in s['equip']))}.")
    a("- Údaje o WC jsou podle DB „nově publikované“; část vybavení může chybět, pokud prostor není označen jako veřejný [2].\n")

    # ---- LfStat
    a("## 2. Osoby s těžkým zdravotním postižením (LfStat, CC BY 4.0)\n")
    a(f"Tabulky GENESIS-Online Bayern 22711-001r, 22711-003z, 22711-004z a 12411-003r (obyvatelé) [3][4]. Stav k 31. 12. 2025, poslední změna tabulky"
      f" {tab['lastChange'][:10]}. Od roku 2021 LfStat čísla zaokrouhluje na 5 (odchylka max. 2), součty proto nemusí přesně sedět [3].\n")
    a("### 2.1 Vývoj v Bavorsku\n")
    a("| Stichtag | Osob s těžkým postižením |")
    a("|---|---:|")
    for y in ["2015-12-31", "2017-12-31", "2019-12-31", "2021-12-31", "2023-12-31", "2025-12-31"]:
        a(f"| {y[8:10]}. 12. {y[:4]} | {fmt(by(STAG=y, AGR111='%TOTAL%'))} |")
    a(f"\nMezi 2023 a 2025 přibylo {fmt(tot - by(STAG=YP, AGR111='%TOTAL%'))} osob.\n")
    a("### 2.2 Podle věku (2025)\n")
    a("| Věk | Osob | Podíl |")
    a("|---|---:|---:|")
    for code in ["ALT000B06", "ALT006B15", "ALT015B18", "ALT018B25", "ALT025B35", "ALT035B45", "ALT045B55", "ALT055B60", "ALT060B62", "ALT062B65", "ALT065UM"]:
        v = by(STAG=Y, AGR111=code)
        a(f"| {lab[code]} | {fmt(v)} | {pct(v, tot)} |")
    a("\n### 2.3 Podle vládních obvodů (2025)\n")
    a("| Vládní obvod | Osob s těžkým postižením | Obyvatel 31. 12. 2025 | Podíl na obyvatelích | Nádraží DB přístupná pro vozík |")
    a("|---|---:|---:|---:|---:|")
    for r in REG:
        v, p = rb(REGBEZ=r, STAG=Y, AGR111="%TOTAL%"), prb(REGBEZ=r, STAG=Y, GES="%TOTAL%")
        rs = [x for x in places if x["k"] == REG_CZ[r]]
        a(f"| {REG_CZ[r]} ({lab[r]}) | {fmt(v)} | {fmt(p)} | {pct(v, p)} | {sum(1 for x in rs if x['w'] == 'yes')} z {len(rs)} |")
    a(f"| **Bavorsko** | **{fmt(tot)}** | **{fmt(pop)}** | **{pct(tot, pop)}** | **{wc['yes']} z {n}** |\n")
    kreise = [k for k in json.loads((LF / "s22711-001r.json").read_text(encoding="utf-8"))["variables"]["KREISE"]["variableValues"]]
    rows = []
    for k in kreise:
        v, p = kr(KREISE=k, STAG=Y, AGR111="%TOTAL%"), pkr(KREISE=k, STAG=Y, GES="%TOTAL%")
        if v and p:
            rows.append((k, lab.get(k, k), v, p))
    a("### 2.4 Okresy a městské okresy (Kreise) – 10 s nejvíce osobami (2025)\n")
    a("| Kreis | Osob | Podíl na obyvatelích |")
    a("|---|---:|---:|")
    for k, nm, v, p in sorted(rows, key=lambda x: -x[2])[:10]:
        a(f"| {nm} | {fmt(v)} | {pct(v, p)} |")
    a("\n### 2.5 Kreise s nejvyšším a nejnižším podílem (2025)\n")
    a("| Kreis | Osob | Podíl |")
    a("|---|---:|---:|")
    srt = sorted(rows, key=lambda x: -x[2] / x[3])
    for k, nm, v, p in srt[:5] + srt[-5:]:
        a(f"| {nm} | {fmt(v)} | {pct(v, p)} |")
    a(f"\nCelá tabulka všech {len(rows)} Kreise je v `data/raw/by_open/zemske/lfstat/` (JSON-stat z GENESIS).\n")
    # GdB, druh
    lab3, _ = labels("22711-003z")
    g3 = jstat(json.loads((LF / "d22711-003z.json").read_text(encoding="utf-8"))["data"][0])
    a("### 2.6 Stupeň postižení (GdB, 2025)\n")
    a("| GdB | Osob | Podíl |")
    a("|---|---:|---:|")
    for c in ["BEHINDGRAD-050", "BEHINDGRAD-060", "BEHINDGRAD-070", "BEHINDGRAD-080", "BEHINDGRAD-090", "BEHINDGRAD-100"]:
        v = g3(STAG=Y, BHNGR1=c, ALT021="%TOTAL%")
        a(f"| {lab3[c].replace('Grad der Behinderung ', '')} | {fmt(v)} | {pct(v, tot)} |")
    lab4, _ = labels("22711-004z")
    g4 = jstat(json.loads((LF / "d22711-004z.json").read_text(encoding="utf-8"))["data"][0])
    t4 = g4(STAG=Y, BHNAT1="%TOTAL%")
    a("\n### 2.7 Druh nejtěžšího postižení (2025)\n")
    a("| Druh (originál LfStat) | Osob | Podíl |")
    a("|---|---:|---:|")
    for c in sorted([c for c in lab4 if c.startswith("BEHINDART")], key=lambda c: -g4(STAG=Y, BHNAT1=c)):
        v = g4(STAG=Y, BHNAT1=c)
        a(f"| {lab4[c]} | {fmt(v)} | {pct(v, t4)} |")
    mob = sum(g4(STAG=Y, BHNAT1=c) for c in ("BEHINDART-A", "BEHINDART-B", "BEHINDART-C"))
    a(f"\nPohybového aparátu (ztráta či omezení končetin, páteř a trup) se týká {fmt(mob)} osob ({pct(mob, t4)}). Kolik z nich používá vozík,"
      " statistika neuvádí. Ochrnutí je sloučeno s duševními postiženími a závislostmi do jedné skupiny (H).\n")

    # ---- přehled sad
    a("## 3. Prověřené sady a licence\n")
    a("| Sada | Licence | Údaje o přístupnosti | Výsledek |")
    a("|---|---|---|---|")
    a("| DB InfraGO OpenStation NeTEx [1][2] | CC0 1.0 | ano: stanice, nástupiště, výtahy, rampy, plošiny, WC, asistence | **převzato** (924 stanic) |")
    a("| DB OpenStation SIRI FM – stav výtahů v reálném čase [2] | CC0 1.0 | ano (živý stav výtahů a eskalátorů) | nestaženo, vhodné pro budoucí živou funkci webu |")
    a("| DB API Marketplace – StaDa, FaSta [10] | API s registrací (klíč) | stanice, výtahy | nepřebíráno: obsah pokrývá OpenStation (CC0) bez registrace |")
    a("| MVV GTFS + seznam zastávek (CSV) [6] | CC BY („cc-by“, uvést MVV a datum) | ne (stops.txt bez `wheelchair_boarding`, trips.txt bez `wheelchair_accessible`) | nic k převzetí |")
    a("| VGN GTFS [7] | CC BY 3.0 DE (uvést „VGN – Verkehrsverbund Großraum Nürnberg GmbH“) | ne (stejně jako MVV) | nic k převzetí |")
    a("| Mobilithek: Ausstattungsmerkmale Barrierefreiheit (DELFI, VDV-462), TU Chemnitz [8] | „Free use“ Mobilithek; data jsou převod z OSM (ODbL) | ano, ale jde o data OSM (projekt OpenStop) | nepřebíráno zvlášť: integrátor je má přímo z OSM |")
    a("| LfStat GENESIS-Online Bayern [3][4] | CC BY 4.0 | statistiky | použito pro kap. 2 |")
    a("| BayernAtlas / LDBV, GDI-BY (geoportal.bayern.de) [9] | – | vrstva přístupnosti neexistuje (CSW: 0 záznamů „barrierefrei“) | – |")
    a("| open.bydata.de, hledání „barrierefrei“ [11] | – | 5 sad, všechny městské (Mnichov, Würzburg), řeší D2a/D2b | – |\n")
    a("## Zdroje\n")
    a("1. DB InfraGO: OpenStation NeTEx, Mobilithek https://mobilithek.info/offers/879076212433727488 (stažení https://bahnhof.de/daten/netex), vydáno 2026-10-07, CC0 1.0.")
    a("2. DB InfraGO: openstation-docs, README a NeTEx.md, https://github.com/dbinfrago/openstation-docs (licence: „released to the public domain (under the CC0 license)“).")
    a(f"3. Bayerisches Landesamt für Statistik, GENESIS-Online Bayern, tabulka 22711-001r, {GEN}22711-001r ; 22711-003z, {GEN}22711-003z ; 22711-004z, {GEN}22711-004z (staženo 2026-10-07).")
    a(f"4. Tamtéž, tabulka 12411-003r (obyvatelé k 31. 12. 2025), {GEN}12411-003r . Podmínky užití GENESIS-Online Bayern: CC BY 4.0, uvést „Datenquelle: Bayerisches Landesamt für Statistik“.")
    a("5. LfStat, statistika 22711 „Statistik der schwerbehinderten Menschen“, https://www.statistikdaten.bayern.de/genesis/online?operation=statistic&code=22711")
    a("6. MVV, OpenData pro vývojáře, https://www.mvv-muenchen.de/service-hilfe/mvv-content-fuer-entwickler (GTFS a Haltestellen-CSV, „Creative Commons Attribution License (cc-by)“).")
    a("7. VGN, Open Data GTFS, https://www.vgn.de/web-entwickler/open-data/ a https://www.vgn.de/opendata/ (CC BY 3.0 DE).")
    a("8. Mobilithek, „Ausstattungsmerkmale bzgl. Barrierefreiheit (gemäß DELFI e.V.) von Haltestellen in Deutschland gemäß VDV-462“, vydavatel TU Chemnitz (projekt OPENER next), https://mobilithek.info")
    a("9. Geoportal Bayern, katalog CSW https://geoportal.bayern.de/csw/gdi (dotaz AnyText like '%barrierefrei%', 2026-10-07: 0 záznamů).")
    a("10. DB API Marketplace, https://developers.deutschebahn.com/db-api-marketplace/apis/product/fasta a …/stada ; rozcestník https://data.deutschebahn.com/opendata")
    a("11. Open Data Bayern, https://open.bydata.de (API hledání „barrierefrei“, 2026-10-07).")
    MD_OUT.parent.mkdir(parents=True, exist_ok=True)
    MD_OUT.write_text("\n".join(L) + "\n", encoding="utf-8")


def sources(places):
    src = [
        {"nazev": "DB InfraGO AG – OpenStation (NeTEx, EU PI Stop Offer / Inventory of Assets TSI-PRM): nádraží a zastávky DB v Bavorsku s údaji o bezbariérovosti",
         "url": OS_URL,
         "licence": "CC0 1.0 (public domain), https://creativecommons.org/publicdomain/zero/1.0/ ; ověřeno v README https://github.com/dbinfrago/openstation-docs (sekce License)",
         "dolozka": "Datenquelle: DB InfraGO AG, OpenStation (https://mobilithek.info/offers/879076212433727488), CC0 1.0. Uvedení zdroje není povinné, uvádíme je. "
                    "Souřadnice: © přispěvatelé OpenStreetMap, ODbL. Data upravena: výběr Bavorska, převod do češtiny.",
         "pocet": len(places)},
        {"nazev": "Bayerisches Landesamt für Statistik – GENESIS-Online Bayern, tabulky 22711-001r, 22711-003z, 22711-004z (Schwerbehinderte) a 12411-003r (Bevölkerung)",
         "url": "https://genesis-5-prod-extern.bayern.de/datenbank/online/statistic/22711",
         "licence": "CC BY 4.0 (podmínky užití GENESIS-Online Bayern, sekce Nutzungsrechte / Copyright)",
         "dolozka": "Datenquelle: Bayerisches Landesamt für Statistik – www.statistik.bayern.de (CC BY 4.0). Použito jen pro statistiky v tema_bavorsko_zemske.md.",
         "pocet": 0},
        {"nazev": "OpenStreetMap – souřadnice nádraží (railway=station/halt v Bavorsku) a názvy obcí podle AGS",
         "url": "https://www.openstreetmap.org/copyright",
         "licence": "ODbL 1.0",
         "dolozka": "© přispěvatelé OpenStreetMap, ODbL 1.0.",
         "pocet": 0},
    ]
    SRC_OUT.write_text(json.dumps(src, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    pl, _ = build()
    sources(pl)
    stats(pl)
