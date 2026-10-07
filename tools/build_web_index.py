"""Pomocné indexy pro web (spouští se až po tools/build_by.py).

Čte data/regions/index.json a soubory regionů a zapíše:
  data/regions/obce.json – [[obec, id regionu, počet míst, jih, západ, sever, východ], ...] seřazeno podle počtu míst
                           (hledání obce na mapě a v Trasách bez načítání všech regionů)
  data/regions/ids.json  – {id regionu: "id1,id2,..."} (staré odkazy misto.html?id=… bez parametru r
                           a uložená místa v profilu najdou svůj region bez stahování všech dat)
  data/regions/ubytovani.json – jen místa s c='ubytovani' ze všech regionů (s "_r" a "z"); stránka Ubytování
                           tak nestahuje všech ~27 MB regionů
Nic nového nevymýšlí, jen přeskládá údaje, které už v souborech regionů jsou.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REG = ROOT / "data" / "regions"


def main():
    index = json.loads((REG / "index.json").read_text(encoding="utf-8"))
    towns = {}
    ids = {}
    ubyt = []
    for r in index:
        rid = r["id"]
        files = r.get("soubory") or [r["soubor"]]
        lst = []
        for f in files:
            places = json.loads((ROOT / f).read_text(encoding="utf-8"))
            for p in places:
                lst.append(p["i"])
                if p.get("c") == "ubytovani":
                    q = dict(p); q["_r"] = rid; q.setdefault("z", r["zeme"])
                    ubyt.append(q)
                o = (p.get("o") or "").strip()
                if not o:
                    continue
                t = towns.get((o, rid))
                if t is None:
                    towns[(o, rid)] = [o, rid, 1, p["la"], p["lo"], p["la"], p["lo"]]
                else:
                    t[2] += 1
                    t[3] = min(t[3], p["la"]); t[4] = min(t[4], p["lo"])
                    t[5] = max(t[5], p["la"]); t[6] = max(t[6], p["lo"])
            del places
        ids[rid] = ",".join(lst)
    out = sorted(towns.values(), key=lambda t: (-t[2], t[0]))
    for t in out:
        t[3:] = [round(x, 4) for x in t[3:]]
    (REG / "obce.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (REG / "ids.json").write_text(json.dumps(ids, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (REG / "ubytovani.json").write_text(json.dumps(ubyt, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("ubytování:", len(ubyt))
    print("obce:", len(out), "regionů:", len(ids), "id:", sum(s.count(",") + 1 for s in ids.values() if s))


if __name__ == "__main__":
    main()
