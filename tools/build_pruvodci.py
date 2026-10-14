"""Hotoví průvodci (pruvodci.html) -> data/pruvodci.json

  python tools/build_pruvodci.py

Průvodce se skládá JEN ze skutečných míst a tras v datech webu:
  data/regions/<kraj>.json   (místa: OSM, výzkum webů provozovatelů v poli r, otevřená data v poli x, fotky v poli img)
  data/trasy/trasy_*.json    (bezbariérové trasy z OpenStreetMap a výškového modelu)
Ručně je zadané jen to, co je v seznamu GUIDES níže: výběr míst podle id, rozdělení do dnů a krátké texty
(název, pro koho, poznámka). Všechno ostatní (stav přístupnosti, co víme a co ne, zdroje, WC, parkování ZTP,
nádraží, fotky, vzdálenosti) se počítá z dat. Když místo v datech chybí, skript skončí chybou, nic si nedomýšlí.
Ceny jsou jen NÁVRH pro ostrou verzi; v prototypu se nic neprodává.
"""
import json
import math
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REG = ROOT / "data" / "regions"
TRASY = [ROOT / "data" / "trasy" / "trasy_cz.json", ROOT / "data" / "trasy" / "trasy_by.json"]
OUT = ROOT / "data" / "pruvodci.json"

# Návrh ceny jednorázového nákupu podle délky (EUR). Jen návrh pro ostrou verzi.
PRICE = {1: 3.90, 2: 5.90, 3: 7.90}

# ---------------------------------------------------------------------------------------------
# Ručně zadaný výběr. Texty: [čeština, němčina, angličtina]. Místa jen podle id z dat.
# ---------------------------------------------------------------------------------------------
GUIDES = [
    {
        "id": "cesky-krumlov",
        "region": "cz-jihocesky", "area": ["Jižní Čechy", "Südböhmen", "South Bohemia"], "country": "cz",
        "title": ["Český Krumlov za jeden den", "Český Krumlov an einem Tag", "Český Krumlov in one day"],
        "who": ["Pro vozík s doprovodem, chodítko a kočárek. Historické centrum má dlažbu z kostek a svahy, proto počítejte s pomocí.",
                "Für Rollstuhl mit Begleitung, Rollator und Kinderwagen. Die Altstadt hat Kopfsteinpflaster und Steigungen, planen Sie Hilfe ein.",
                "For wheelchair users with a companion, walkers and prams. The old town has cobbles and slopes, so plan for some help."],
        "intro": ["Brána do starého města, otáčivé hlediště, dvě muzea a restaurace s bezbariérovým WC. U každé zastávky ukazujeme, co o přístupnosti víme a odkud.",
                  "Tor zur Altstadt, Drehbühne, zwei Museen und ein Restaurant mit barrierefreiem WC. Bei jedem Halt zeigen wir, was wir zur Barrierefreiheit wissen und woher.",
                  "A gate to the old town, the revolving theatre, two museums and a restaurant with an accessible toilet. For each stop we show what we know about access and where it comes from."],
        "days": [["w60575277", "n12286446445", "n10970681483", "n13970697135", "rh7003f346cc"]],
        "stay": ["w60575287", "w38507343", "w38506743"],
        "stations": ["n4294224867", "n836915172"],
        "wc": ["n12864639122", "n6961707170"],
        "routes": [],
    },
    {
        "id": "budejovice-hluboka",
        "region": "cz-jihocesky", "area": ["Jižní Čechy", "Südböhmen", "South Bohemia"], "country": "cz",
        "title": ["České Budějovice a Hluboká", "České Budějovice und Hluboká", "České Budějovice and Hluboká"],
        "who": ["Pro lidi na vozíku i s doprovodem, seniory a rodiny. Většina zastávek má údaje přímo od provozovatele.",
                "Für Menschen im Rollstuhl, auch mit Begleitung, Senioren und Familien. Die meisten Halte haben Angaben direkt vom Betreiber.",
                "For wheelchair users with or without a companion, older people and families. Most stops have information straight from the operator."],
        "intro": ["První den muzea a galerie v Budějovicích, druhý den zámek, zoo a park v Hluboké. Mezi městy vede asfaltová cesta označená jako sjízdná na vozíku.",
                  "Am ersten Tag Museen und Galerie in Budweis, am zweiten Schloss, Zoo und Park in Hluboká. Zwischen den Orten führt ein asphaltierter Weg, der als rollstuhlgerecht markiert ist.",
                  "Day one: museums and a gallery in České Budějovice. Day two: the chateau, zoo and park in Hluboká. An asphalt path marked as wheelchair accessible runs between the towns."],
        "days": [["rhf14a63cca3", "n7630141308", "n629540015", "rhc6f01de051"],
                 ["rhe1b8d1b310", "rhab56b66a0e", "rh13f710c135"]],
        "stay": ["n634582415", "w49943792", "rh4f427fb4dc"],
        "stations": ["n32522686"],
        "wc": ["n4431775137"],
        "routes": ["osm-w37883716"],
    },
    {
        "id": "trebonsko",
        "region": "cz-jihocesky", "area": ["Jižní Čechy", "Südböhmen", "South Bohemia"], "country": "cz",
        "title": ["Třeboň a lázně", "Třeboň und das Kurbad", "Třeboň and the spa"],
        "who": ["Pro lidi na vozíku, seniory a lázeňské hosty. Zámek je přístupný jen částečně.",
                "Für Menschen im Rollstuhl, Senioren und Kurgäste. Das Schloss ist nur teilweise zugänglich.",
                "For wheelchair users, older people and spa guests. The chateau is only partly accessible."],
        "intro": ["Zámek, muzeum v Domě Štěpánka Netolického a vyhlídka s panoramatickým výtahem v lázních Aurora. Ubytování s údaji od provozovatelů je přímo ve městě i v okolí.",
                  "Schloss, Museum im Haus des Štěpánek Netolický und Aussicht mit Panoramaaufzug im Kurhaus Aurora. Unterkünfte mit Angaben der Betreiber gibt es in der Stadt und in der Umgebung.",
                  "The chateau, the museum in the House of Štěpánek Netolický and a viewpoint with a panoramic lift at the Aurora spa. Accommodation with operator information is in town and nearby."],
        "days": [["rhfeb4c79924", "rh61d77e3107", "n2404901736", "rh6cf5c2b4f4"]],
        "stay": ["rh097bcbc5e5", "rhc8b659a482", "rh8259fdd453", "rhbcd4aa2c22"],
        "stations": [],
        "wc": ["n689882408", "n7797468564"],
        "routes": [],
    },
    {
        "id": "sumava",
        "region": "cz-jihocesky", "area": ["Šumava", "Böhmerwald", "Šumava"], "country": "cz",
        "title": ["Šumava: slatě, zvířata a Lipno", "Böhmerwald: Moore, Tiere und Lipno", "Šumava: peat bogs, animals and Lipno"],
        "who": ["Pro lidi na vozíku s doprovodem a rodiny. Povalové chodníky na slatích jsou podle zdrojů sjízdné jen zčásti.",
                "Für Menschen im Rollstuhl mit Begleitung und Familien. Die Bohlenwege in den Mooren sind laut Quellen nur teilweise befahrbar.",
                "For wheelchair users with a companion and families. According to the sources, the boardwalks on the bogs are only partly passable."],
        "intro": ["První den návštěvnická centra národního parku a slatě u Kvildy a Svinné Lady. Druhý den Lipno se stezkou korunami stromů. Údaje pocházejí hlavně z webů provozovatelů.",
                  "Am ersten Tag die Besucherzentren des Nationalparks und die Moore bei Kvilda und Svinná Lada. Am zweiten Tag Lipno mit dem Baumwipfelpfad. Die Angaben stammen vor allem von den Websites der Betreiber.",
                  "Day one: national park visitor centres and the bogs near Kvilda and Svinná Lada. Day two: Lipno with the treetop walk. The information comes mainly from operators' websites."],
        "days": [["n8943829918", "rhebbb13f3a2", "n473594118", "rhd817b6e2de", "w363765523"],
                 ["n1839615001", "w1064413872", "rh9f09252cd5"]],
        "stay": ["w962660766"],
        "stations": [],
        "wc": ["n287072458", "n5669650416", "n4421016901"],
        "routes": [],
    },
    {
        "id": "bavorsky-les",
        "region": "de-dolni-bavorsko", "area": ["Bavorský les", "Bayerischer Wald", "Bavarian Forest"], "country": "de",
        "title": ["Bavorský les na tři dny", "Bayerischer Wald in drei Tagen", "The Bavarian Forest in three days"],
        "who": ["Pro lidi na vozíku i s doprovodem, seniory a rodiny. Do Bayerisch Eisenstein se dá dojet vlakem ze Železné Rudy.",
                "Für Menschen im Rollstuhl, auch mit Begleitung, Senioren und Familien. Nach Bayerisch Eisenstein kommt man mit dem Zug aus Železná Ruda.",
                "For wheelchair users with or without a companion, older people and families. You can reach Bayerisch Eisenstein by train from Železná Ruda."],
        "intro": ["Stezka korunami stromů a zvířata u Lusenu, lesní muzea ve Zwieselu a Sankt Oswaldu, okruh Libelle a jezero Großer Arbersee. Nádraží na trase mají měřené údaje z otevřených dat DB.",
                  "Baumwipfelpfad und Tiergehege am Lusen, Waldmuseen in Zwiesel und Sankt Oswald, der Rundweg Libelle und der Große Arbersee. Die Bahnhöfe haben gemessene Angaben aus den offenen Daten der DB.",
                  "The treetop walk and animal enclosures at Lusen, forest museums in Zwiesel and Sankt Oswald, the Libelle loop and the Großer Arbersee lake. Stations on the way have measured data from DB open data."],
        "days": [["w228068229", "w33299995", "n4772613521", "n4772615221"],
                 ["w303531839", "w113858298", "n1635641188"],
                 ["n533621689", "rhf3cfe942c7", "n342866263", "w32639764"]],
        "stay": ["n1979970524", "n7214803811"],
        "stations": ["n528650068", "n303492706", "n4688419452"],
        "wc": ["n2383983297", "n12902030007", "n2466964621"],
        "routes": ["osm-r14501463"],
    },
    {
        "id": "pasov",
        "region": "de-dolni-bavorsko", "area": ["Pasov", "Passau", "Passau"], "country": "de",
        "title": ["Pasov za jeden den", "Passau an einem Tag", "Passau in one day"],
        "who": ["Pro vozík s doprovodem a seniory. U většiny zastávek máme jen údaj z OpenStreetMap, rozměry chybí.",
                "Für Rollstuhl mit Begleitung und Senioren. Bei den meisten Halten haben wir nur eine Angabe aus OpenStreetMap, Maße fehlen.",
                "For wheelchair users with a companion and older people. For most stops we only have an OpenStreetMap entry, measurements are missing."],
        "intro": ["Dóm svatého Štěpána, Stará a Nová rezidence a radnice v historickém centru mezi řekami. Hlavní nádraží má měřené údaje z otevřených dat DB. Údaje o vstupech je dobré předem ověřit.",
                  "Dom St. Stephan, Alte und Neue Residenz und das Rathaus in der Altstadt zwischen den Flüssen. Der Hauptbahnhof hat gemessene Angaben aus den offenen Daten der DB. Die Eingänge sollten Sie vorher prüfen.",
                  "St Stephen's Cathedral, the Old and New Residence and the town hall in the old town between the rivers. The main station has measured data from DB open data. Check the entrances in advance."],
        "days": [["w24771505", "w108893147", "w108893153", "w38325155"]],
        "stay": ["n848760859"],
        "stations": ["n14334692"],
        "wc": ["n267275222", "n267275241", "n1226961553"],
        "routes": [],
    },
    {
        "id": "rezno",
        "region": "de-horni-falc", "area": ["Řezno", "Regensburg", "Regensburg"], "country": "de",
        "title": ["Řezno: muzea a staré město", "Regensburg: Museen und Altstadt", "Regensburg: museums and the old town"],
        "who": ["Pro lidi na vozíku, seniory a rodiny. Kamenný most a staré město mají dlažbu, muzea mají údaje od provozovatelů.",
                "Für Menschen im Rollstuhl, Senioren und Familien. Steinerne Brücke und Altstadt haben Pflaster, die Museen haben Angaben der Betreiber.",
                "For wheelchair users, older people and families. The Stone Bridge and old town are paved with setts, the museums have operator information."],
        "intro": ["První den Muzeum bavorských dějin, návštěvnické centrum světového dědictví, Kamenný most a dóm. Druhý den galerie, přírodovědné muzeum a okruh v parku Aubachpark.",
                  "Am ersten Tag das Museum der Bayerischen Geschichte, das Besucherzentrum Welterbe, die Steinerne Brücke und der Dom. Am zweiten Tag Galerie, Naturkundemuseum und der Rundweg im Aubachpark.",
                  "Day one: the Museum of Bavarian History, the World Heritage visitor centre, the Stone Bridge and the cathedral. Day two: a gallery, the natural history museum and the loop in Aubachpark."],
        "days": [["w558371648", "n1300835200", "w122082110", "w39962246"],
                 ["r4649329", "w100118132", "w100317431", "rh879a9f6458"]],
        "stay": ["w294684868", "w280702664", "n6378136515"],
        "stations": ["n2703868858"],
        "wc": [],
        "routes": [],
    },
    {
        "id": "mnichov",
        "region": "de-horni-bavorsko", "area": ["Mnichov", "München", "Munich"], "country": "de",
        "title": ["Mnichov na tři dny", "München in drei Tagen", "Munich in three days"],
        "who": ["Pro lidi na vozíku, seniory a rodiny. Mnichov má hodně měřených údajů z otevřených dat města, hlavně u WC a stanic.",
                "Für Menschen im Rollstuhl, Senioren und Familien. München hat viele gemessene Angaben aus den offenen Daten der Stadt, vor allem zu WCs und Stationen.",
                "For wheelchair users, older people and families. Munich has a lot of measured data from the city's open data, especially for toilets and stations."],
        "intro": ["První den centrum s radnicí, Frauenkirche a Egyptským muzeem. Druhý den zoo Hellabrunn. Třetí den Olympijská věž, SeaLife a park Petuelpark.",
                  "Am ersten Tag das Zentrum mit Rathaus, Frauenkirche und Ägyptischem Museum. Am zweiten Tag der Tierpark Hellabrunn. Am dritten Tag Olympiaturm, SeaLife und Petuelpark.",
                  "Day one: the centre with the town hall, the Frauenkirche and the Egyptian Museum. Day two: Hellabrunn Zoo. Day three: the Olympic Tower, SeaLife and Petuelpark."],
        "days": [["r147095", "w225698612", "n5223300524"],
                 ["w156435529"],
                 ["w164084344", "n11747779098", "rh9c760bb6d7"]],
        "stay": ["w142041969", "w264305937"],
        "stations": ["n2941687118", "n2470201868"],
        "wc": ["mucwc253"],
        "routes": [],
    },
]

AREAS = ["vstup", "wc", "parkovani", "vytah"]


def km(a, b):
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


_cache = {}


def region(rid):
    if rid not in _cache:
        _cache[rid] = json.loads((REG / (rid + ".json")).read_text(encoding="utf-8"))
    return _cache[rid]


def find(pid, rid):
    for p in region(rid):
        if p["i"] == pid:
            return p
    # záložně ve všech regionech (místo může ležet za hranicí kraje, třeba Železná Ruda)
    for f in sorted(REG.glob("??-*.json")):
        if f.stem in ("ids", "index", "obce", "ubytovani"):
            continue
        for p in region(f.stem):
            if p["i"] == pid:
                return p | {"_r": f.stem}
    sys.exit(f"Místo {pid} v datech není. Průvodce {rid} nejde sestavit.")


def osm_state(v):
    return {"yes": "ok", "limited": "part", "no": "no"}.get(v, "unk")


def stop(p, rid):
    """Zastávka: co víme o přístupnosti (podle oblastí) a odkud, co nevíme."""
    rid = p.get("_r", rid)
    known, sources = [], []
    for x in p.get("x") or []:
        rows = [r for r in (x.get("rows") or []) if r and r[0]][:6]
        known.append({"a": "data", "src": "data", "label": x.get("label") or x.get("src"), "rows": rows,
                      "url": x.get("url") or "", "date": x.get("date") or "", "cat": x.get("cat")})
        sources.append({"t": "data", "label": x.get("label") or x.get("src"), "url": x.get("url") or "", "date": x.get("date") or "",
                        "license": x.get("license") or ""})
    covered = set()
    if p.get("x"):
        covered.add("vstup")
        if any("WC" in (r[0] or "") or "Toilet" in (r[0] or "") for x in p["x"] for r in (x.get("rows") or [])):
            covered.add("wc")
    for r in p.get("r") or []:
        items = r.get("items") or {}
        for a in AREAS + ["pokoj", "koupelna", "jine"]:
            if items.get(a):
                known.append({"a": a, "src": "web", "txt": items[a], "url": r.get("url") or "", "date": r.get("date") or "",
                              "st": r.get("source_type") or ""})
                if a in AREAS:
                    covered.add(a)
        meas = [[m.get("co"), m.get("hodnota"), m.get("jednotka")] for m in (r.get("measurements") or []) if m.get("co")]
        if meas:
            known.append({"a": "rozmery", "src": "web", "rows": meas[:8], "url": r.get("url") or "", "date": r.get("date") or ""})
        sources.append({"t": "web", "label": r.get("source_type") or "web", "url": r.get("url") or "", "date": r.get("date") or ""})
    if p["c"] != "parkovani" and p.get("w") and "vstup" not in covered:
        known.append({"a": "vstup", "src": "osm", "osm": p.get("w")})
        covered.add("vstup")
    if p.get("t") and "wc" not in covered:
        known.append({"a": "wc", "src": "osm", "osm": p.get("t")})
        covered.add("wc")
    if (p.get("pk") or 0) > 0 and "parkovani" not in covered:
        known.append({"a": "parkovani", "src": "osm", "n": p["pk"]})
        covered.add("parkovani")
    if p.get("i", "").startswith(("n", "w", "r")) and not p["i"].startswith("rh"):
        sources.append({"t": "osm", "label": "OpenStreetMap", "url": "https://www.openstreetmap.org/" +
                        {"n": "node", "w": "way", "r": "relation"}[p["i"][0]] + "/" + p["i"][1:], "date": p.get("u") or ""})
    claim = next((r.get("claim") for r in (p.get("r") or []) if r.get("claim")), None)
    st = osm_state(p.get("w"))
    if p.get("r") and claim in ("yes", "limited", "no"):
        st = osm_state(claim)
    out = {"id": p["i"], "r": rid, "n": p["n"], "c": p["c"], "s": p.get("s") or "", "o": p.get("o") or "", "la": p["la"], "lo": p["lo"],
           "st": st, "w": p.get("w"), "t": p.get("t"), "known": known,
           "unknown": [a for a in AREAS if a not in covered], "sources": sources}
    if p.get("img"):
        out["img"] = p["img"]
    if p.get("a"):
        out["adr"] = p["a"]
    if p.get("web"):
        out["web"] = p["web"]
    quote = next((r.get("quote") for r in (p.get("r") or []) if r.get("quote")), None)
    if quote:
        out["quote"] = quote
    return out


def short(p, rid, ref=None):
    rid = p.get("_r", rid)
    o = {"id": p["i"], "r": rid, "n": p["n"], "c": p["c"], "o": p.get("o") or "", "st": osm_state(p.get("w")), "w": p.get("w"), "t": p.get("t")}
    if ref:
        o["km"] = round(km(ref, (p["la"], p["lo"])), 1)
    if p.get("x"):
        o["data"] = [{"label": x.get("label"), "url": x.get("url"), "date": x.get("date"), "rows": [r for r in (x.get("rows") or []) if r][:6]} for x in p["x"]]
    if p.get("r"):
        r = p["r"][0]
        o["web"] = {"url": r.get("url"), "date": r.get("date"), "items": {k: v for k, v in (r.get("items") or {}).items() if k in ("vstup", "wc", "parkovani")}}
    return o


def nearby(rid, pts, test, radius, limit, exclude=()):
    best = {}
    for p in region(rid):
        if p["i"] in exclude or not test(p):
            continue
        d = min(km(q, (p["la"], p["lo"])) for q in pts)
        if d <= radius and (p["i"] not in best or d < best[p["i"]][0]):
            best[p["i"]] = (d, p)
    return [x[1] for x in sorted(best.values(), key=lambda v: v[0])[:limit]]


def load_routes():
    out = {}
    for f in TRASY:
        for r in json.loads(f.read_text(encoding="utf-8")):
            out[r["id"]] = r
    return out


def main():
    routes = load_routes()
    guides = []
    for g in GUIDES:
        rid = g["region"]
        days = []
        allpts = []
        for d in g["days"]:
            stops = []
            prev = None
            for pid in d:
                p = find(pid, rid)
                s = stop(p, rid)
                if prev:
                    s["km_prev"] = round(km(prev, (p["la"], p["lo"])), 1)
                prev = (p["la"], p["lo"])
                allpts.append(prev)
                stops.append(s)
            days.append(stops)
        center = (sum(q[0] for q in allpts) / len(allpts), sum(q[1] for q in allpts) / len(allpts))
        used = {s["id"] for d in days for s in d}
        # WC: ručně vybraná (prověřená, že jsou v datech) + nejbližší bezbariérová podle OSM do 800 m od zastávek
        wc = [short(find(i, rid), rid, center) for i in g["wc"]]
        wc_ids = {w["id"] for w in wc} | used
        wc += [short(p, rid, center) for p in nearby(rid, allpts, lambda p: p["c"] == "wc" and p.get("t") == "yes", 0.8, max(0, 4 - len(wc)), wc_ids)]
        # Parkování ZTP: vyhrazená stání z OSM do 500 m od zastávek
        park = [short(p, rid, center) for p in nearby(rid, allpts, lambda p: p["c"] == "parkovani", 0.5, 4, used)]
        for pk in park:
            q = find(pk["id"], rid)
            n, dist = min(((s["n"], km((s["la"], s["lo"]), (q["la"], q["lo"]))) for d in days for s in d), key=lambda v: v[1])
            pk.update({"near": n, "near_m": int(round(dist * 1000, -1)), "pk": q.get("pk"), "fee": q.get("fee")})
            pk.pop("km", None)
        stations = [short(find(i, rid), rid, center) for i in g["stations"]]
        stay = [short(find(i, rid), rid, center) for i in g["stay"]]
        rts = []
        for i in g["routes"]:
            r = routes.get(i)
            if not r:
                sys.exit(f"Trasa {i} v datech není.")
            rts.append({"id": r["id"], "nazev": r["nazev"], "delka_km": r["delka_km"], "typ": r["typ"], "max_sklon": r.get("max_sklon"),
                        "useky_nad_6": r.get("useky_nad_6"), "schody": r.get("schody"), "povrchy": r.get("povrchy") or {},
                        "wheelchair": r.get("wheelchair"), "km": round(km(center, tuple(r["start"])), 1)})
        nstops = sum(len(d) for d in days)
        st_count = {k: sum(1 for d in days for s in d if s["st"] == k) for k in ("ok", "part", "no", "unk")}
        photos = [{"id": s["id"], "n": s["n"], "img": s["img"]} for d in days for s in d if s.get("img")]
        src_set = {}
        for d in days:
            for s in d:
                for x in s["sources"]:
                    if x["t"] != "osm":
                        src_set.setdefault(x["url"], x)
        guides.append({
            "id": g["id"], "country": g["country"], "region": rid,
            "area": dict(zip(("cs", "de", "en"), g["area"])), "title": dict(zip(("cs", "de", "en"), g["title"])),
            "who": dict(zip(("cs", "de", "en"), g["who"])), "intro": dict(zip(("cs", "de", "en"), g["intro"])),
            "days_n": len(days), "price_eur": PRICE[len(days)], "stops_n": nstops, "states": st_count,
            "with_web": sum(1 for d in days for s in d if any(k["src"] == "web" for k in s["known"])),
            "with_data": sum(1 for d in days for s in d if any(k["src"] == "data" for k in s["known"])),
            "only_osm": sum(1 for d in days for s in d if s["known"] and all(k["src"] == "osm" for k in s["known"])),
            "unknown_n": sum(1 for d in days for s in d if not s["known"]),
            "center": [round(center[0], 5), round(center[1], 5)],
            "days": days, "wc": wc, "parking": park, "stations": stations, "stay": stay, "routes": rts,
            "photos": photos[:4], "sources": list(src_set.values()),
        })
    out = {
        "vytvoreno": date.today().isoformat(),
        "popis": "Hotoví průvodci sestavení skriptem tools/build_pruvodci.py jen ze skutečných míst a tras v datech webu. Ceny jsou návrh pro ostrou verzi.",
        "zdroje_vstupu": ["data/regions/*.json", "data/trasy/trasy_cz.json", "data/trasy/trasy_by.json"],
        "cena_navrh_eur": PRICE,
        "pruvodci": guides,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {len(guides)} průvodců, {sum(g['stops_n'] for g in guides)} zastávek, {OUT.stat().st_size // 1024} kB")
    for g in guides:
        print(f"  {g['id']}: {g['days_n']} d, {g['stops_n']} zastávek, stavy {g['states']}, web {g['with_web']}, data {g['with_data']}, jen OSM {g['only_osm']}, WC {len(g['wc'])}, P {len(g['parking'])}")


if __name__ == "__main__":
    main()
