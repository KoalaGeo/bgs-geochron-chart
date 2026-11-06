#!/usr/bin/env python3
"""Build the BGS version of the chronostratigraphic chart data.

Structure (hierarchy, ranks, ordering, GSSP/GSSA ratification) comes from the
ICS chart (chart.ttl), joined to BGS concepts through their CGI skos:exactMatch
links. Ages, labels, colours, notations, definitions and identifiers come from
BGS. ICS units BGS cannot be joined to are filled from ICS and flagged.
BGS regional series/stages/substages and Marine Isotope Stages are emitted as
separate units for the extra columns.

BGS data is read through bgs/queries/bgs-geochronology.rq, either from a
SPARQL endpoint or by running the same query over local TTL files:

    python bgs/build_bgs_chart.py --endpoint https://data.bgs.ac.uk/sparql
    python bgs/build_bgs_chart.py --ttl path/to/Geochronology.ttl
    python bgs/build_bgs_chart.py --ttl https://raw.githubusercontent.com/BritishGeologicalSurvey/vocabularies/main/prez/vocabs/Geochronology.ttl

Writes chart-ui-ready Turtle (default bgs/build/bgs-chart.ttl) and a JSON
report of every match, fallback and BGS/ICS age difference.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

from rdflib import BNode, Graph, Literal, Namespace, URIRef
from rdflib.namespace import OWL, RDF, RDFS, SKOS, XSD
from rdflib.util import guess_format

HERE = Path(__file__).resolve().parent
REPO = HERE.parent

GEO = Namespace("http://data.bgs.ac.uk/ref/Geochronology/")
REG = Namespace("http://purl.org/linked-data/registry#")
SDO = Namespace("https://schema.org/")
SH = Namespace("http://www.w3.org/ns/shacl#")
TIME = Namespace("http://www.w3.org/2006/time#")
GTS = Namespace("http://resource.geosciml.org/ontology/timescale/gts#")
ISC = Namespace("https://data.stratigraphy.org/data/gts/")  # ICS units + inMYA
STRAT = "https://data.stratigraphy.org/data/strat/"
VIS = "https://data.stratigraphy.org/data/vis/"
DCT = Namespace("http://purl.org/dc/terms/")
CGI = "http://resource.geosciml.org/classifier/ics/ischart/"
# Terms specific to this chart build. Placeholder namespace: rename if BGS
# wants these published.
BGSC = Namespace("http://data.bgs.ac.uk/def/geochron-chart#")
CHART_SCHEME = GEO.Division

# CGI ischart names that differ from current ICS chart names.
CGI_ALIASES = {"MiddlePleistocene": "Chibanian"}

# ICS rank -> BGS ranks that may stand in for it.
RANK_OK = {
    "Super-Eon": {"-"},
    "Eon": {"EON", "-"},
    "Era": {"ERA"},
    "Period": {"PERIOD"},
    "Sub-Period": {"SUBPERIOD"},
    "Epoch": {"EPOCH"},
    "Age": {"AGE"},
}
REGIONAL_LEVEL = {"SERIES": "series", "STAGE": "stage", "SUBSTAGE": "substage"}
COLUMN_LABELS = {"series": "Series", "stage": "Stage", "substage": "Substage", "mis": "MIS"}

RANK_SUFFIX = re.compile(r"\s+(Eon|Era|Period|Subperiod|Epoch|Age)$")
REGIONAL_SUFFIX = re.compile(r"\s+(Series|Stage|Substage|Complex)$")


def local(iri) -> str:
    return str(iri).rstrip("/").rsplit("/", 1)[-1].rsplit("#", 1)[-1]


def strip_rank(label: str) -> str:
    return RANK_SUFFIX.sub("", label).strip()


def to_stratigraphic(label: str) -> str:
    """BGS labels are chronometric (Early/Mid/Late)."""
    return re.sub(r"^(Early|Mid|Middle|Late)\b",
                  lambda m: {"Early": "Lower", "Late": "Upper"}.get(m.group(1), "Middle"),
                  label)


def norm(label: str) -> str:
    s = strip_rank(label).lower()
    s = re.sub(r"\bmiddle\b", "mid", s)
    s = re.sub(r"\blower\b", "early", s)
    s = re.sub(r"\bupper\b", "late", s)
    return re.sub(r"[^a-z0-9]", "", s)


def ics_name_label(name: str) -> str:
    """Label for ICS units that carry none (e.g. LowerOrdovician)."""
    for adj, chrono in (("Lower", "Early"), ("Middle", "Mid"), ("Upper", "Late")):
        if name.startswith(adj) and len(name) > len(adj):
            return f"{chrono} {name[len(adj):]}"
    return re.sub(r"(?<=[a-z])(?=[A-Z0-9])", " ", name)


def fnum(v):
    return None if v is None else float(v)


# --------------------------------------------------------------------------
# Loading
# --------------------------------------------------------------------------

def load_bgs(query: str, endpoint: str | None, ttl: list[str]) -> Graph:
    if endpoint:
        req = urllib.request.Request(
            endpoint,
            data=urllib.parse.urlencode({"query": query}).encode(),
            headers={"Accept": "text/turtle",
                     "Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=120) as r:
            body = r.read().decode()
        g = Graph()
        g.parse(data=body, format="turtle")
        return g
    src = Graph()
    for f in ttl:  # local paths or URLs (raw.githubusercontent.com serves text/plain, so go by extension)
        src.parse(f, format=guess_format(f) or "turtle")
    return src.query(query).graph


# --------------------------------------------------------------------------
# Main build
# --------------------------------------------------------------------------

def build(bgs: Graph, ics: Graph, schemes_cfg: dict):
    report = {"matches": [], "fallbacks": [], "conflicts": [], "age_differences": [],
              "colour_fallbacks": [], "regional": defaultdict(int), "skipped": [],
              "mis_inferred": []}

    rank = lambda s: local(bgs.value(s, GEO.hasGeochronologyRank) or "")
    stable = lambda s: not str(bgs.value(s, REG.status) or "").endswith("deprecated")
    blabel = lambda s: str(bgs.value(s, SKOS.prefLabel) or "")

    # CGI name -> BGS concepts
    by_cgi = defaultdict(list)
    for s, o in bgs.subject_objects(SKOS.exactMatch):
        if str(o).startswith(CGI):
            name = local(o)
            by_cgi[CGI_ALIASES.get(name, name)].append(s)

    ics_units = sorted(set(ics.subjects(GTS.rank, None)), key=str)
    ics_ranks = {u: {local(r) for r in ics.objects(u, GTS.rank)} for u in ics_units}

    def ics_label(u):
        lab = ics.value(u, SKOS.prefLabel)  # rdflib picks one; prefer English
        for l in ics.objects(u, SKOS.prefLabel):
            if getattr(l, "language", None) == "en":
                lab = l
        return str(lab) if lab is not None else ics_name_label(local(u))

    # 1. Join ICS -> BGS
    chosen: dict[URIRef, URIRef] = {}
    used: dict[URIRef, URIRef] = {}
    for u in ics_units:
        ok = set().union(*(RANK_OK.get(r, set()) for r in ics_ranks[u]))
        cands = [c for c in by_cgi.get(local(u), []) if stable(c)]
        pick, method = None, None
        ranked = [c for c in cands if rank(c) in ok]
        if ranked:
            pick, method = ranked[0], "cgi"
            if len(cands) > 1:
                report["conflicts"].append({
                    "ics": local(u), "chosen": local(pick),
                    "rejected": [f"{local(c)} ({blabel(c)}, {rank(c)})" for c in cands if c != pick],
                    "reason": f"several BGS concepts match CGI {local(u)}; kept the {'/'.join(sorted(ics_ranks[u]))}-rank one"})
        if pick is None:  # label fallback
            target = norm(ics_label(u))
            for c in bgs.subjects(GEO.hasGeochronologyRank, None):
                if stable(c) and rank(c) in ok and norm(blabel(c)) == target:
                    pick, method = c, "label"
                    break
        if pick is not None and pick in used:
            report["conflicts"].append({"ics": local(u), "chosen": None,
                                        "rejected": [local(pick)],
                                        "reason": f"already used for {local(used[pick])}"})
            pick = None
        if pick is None:
            report["fallbacks"].append({"ics": local(u), "label": ics_label(u),
                                        "reason": "no BGS concept joined; ICS values used"})
            continue
        chosen[u] = pick
        used[pick] = u
        report["matches"].append({"ics": local(u), "bgs": local(pick), "bgs_iri": str(pick),
                                  "bgs_label": blabel(pick), "method": method})

    out = Graph()
    for p, ns in (("skos", SKOS), ("time", TIME), ("gts", GTS), ("ischart", ISC),
                  ("sh", SH), ("sdo", SDO), ("bgsc", BGSC), ("geochronology", GEO),
                  ("rdfs", RDFS), ("owl", OWL), ("dcterms", DCT)):
        out.bind(p, ns)
    out.bind("division", "http://data.bgs.ac.uk/id/Geochronology/Division/")

    node_of = {u: chosen.get(u, u) for u in ics_units}

    def marker(subject, pred, mya, moe=None, inferred=False):
        b = BNode()
        out.add((subject, pred, b))
        out.add((b, ISC.inMYA, Literal(str(mya), datatype=XSD.decimal)))
        if moe is not None:
            out.add((b, SDO.marginOfError, Literal(str(moe), datatype=XSD.decimal)))
        if inferred:
            out.add((b, SKOS.note, Literal("inferred")))

    def ics_marker(u, pred):
        b = ics.value(u, pred)
        return (fnum(ics.value(b, ISC.inMYA)), ics.value(b, SDO.marginOfError),
                str(ics.value(b, SKOS.note) or ""))

    # 2. ICS-structured units
    for u in ics_units:
        n = node_of[u]
        b = chosen.get(u)
        flags = []
        out.add((n, RDF.type, SKOS.Concept))
        out.add((n, RDF.type, BGSC.ChartUnit))
        out.add((n, SKOS.inScheme, CHART_SCHEME))
        for r in ics.objects(u, GTS.rank):
            out.add((n, GTS.rank, r))
        for p in (SH.order, GTS.ratifiedGSSP, GTS.ratifiedGSSA):
            v = ics.value(u, p)
            if v is not None:
                out.add((n, p, v))
        for child in ics.objects(u, SKOS.narrower):
            if child in node_of:
                out.add((n, SKOS.narrower, node_of[child]))
                out.add((node_of[child], SKOS.broader, n))
        ib, ib_moe, ib_note = ics_marker(u, TIME.hasBeginning)
        ie, ie_moe, ie_note = ics_marker(u, TIME.hasEnd)

        if b is not None:
            lab = strip_rank(blabel(b))
            out.add((n, SKOS.prefLabel, Literal(lab, lang="en")))
            strat = to_stratigraphic(lab)
            if strat != lab:
                out.add((n, BGSC.stratigraphicLabel, Literal(strat, lang="en")))
            out.add((n, SKOS.exactMatch, u))
            out.add((n, RDFS.isDefinedBy, GEO.Division))
            for p in (SKOS.notation, SKOS.definition):
                v = bgs.value(b, p)
                if v is not None:
                    out.add((n, p, Literal(str(v), lang="en") if p == SKOS.definition else v))
            bmax, bmin = fnum(bgs.value(b, GEO.maxAgeValue)), fnum(bgs.value(b, GEO.minAgeValue))
            if bmax is None or bmin is None:
                flags.append("ages")
                marker(n, TIME.hasBeginning, ib, ib_moe)
                marker(n, TIME.hasEnd, ie, ie_moe)
            else:
                marker(n, TIME.hasBeginning, bmax)
                marker(n, TIME.hasEnd, bmin)
                if abs(bmax - ib) > 1e-6 or abs(bmin - ie) > 1e-6:
                    report["age_differences"].append({
                        "ics": local(u), "label": lab, "bgs": local(b),
                        "bgs_base": bmax, "ics_base": ib, "bgs_top": bmin, "ics_top": ie})
            col = bgs.value(b, SDO.color)
            if col is None:
                flags.append("colour")
                col = ics.value(u, SDO.color)
                report["colour_fallbacks"].append({"ics": local(u), "bgs": local(b), "label": lab})
            if col is not None:
                out.add((n, SDO.color, Literal(str(col))))
        else:
            flags.append("all")
            lab = ics_label(u)
            out.add((n, SKOS.prefLabel, Literal(lab, lang="en")))
            marker(n, TIME.hasBeginning, ib, ib_moe)
            marker(n, TIME.hasEnd, ie, ie_moe)
            col = ics.value(u, SDO.color)
            if col is not None:
                out.add((n, SDO.color, col))
            out.add((n, RDFS.isDefinedBy, URIRef("https://data.stratigraphy.org/data/gts")))
        if flags:
            out.add((n, BGSC.icsFallback, Literal(",".join(flags))))

    # 3. Regional units and MIS
    members = {}
    for scheme, codes in schemes_cfg.get("members", {}).items():
        for code in codes:
            members[code] = scheme
    default_scheme = schemes_cfg.get("default", "uk")
    regional = []
    for c in sorted(set(bgs.subjects(GEO.hasGeochronologyRank, None)), key=str):
        r = rank(c)
        if c in used:
            continue
        if r not in REGIONAL_LEVEL and r != "MIS":
            report["skipped"].append(f"{local(c)} {blabel(c)} [{r}]"
                                     + ("" if stable(c) else " deprecated") + " - not an ICS unit or regional column")
            continue
        mx, mn = fnum(bgs.value(c, GEO.maxAgeValue)), fnum(bgs.value(c, GEO.minAgeValue))
        if not stable(c) or mx is None or mn is None:
            report["skipped"].append(f"{local(c)} {blabel(c)} [{r}]"
                                     + (" deprecated" if not stable(c) else " no ages"))
            continue
        code = str(bgs.value(c, SKOS.notation) or local(c))
        scheme = "mis" if r == "MIS" else members.get(code, default_scheme)
        level = "mis" if r == "MIS" else REGIONAL_LEVEL[r]
        regional.append({"iri": c, "code": code, "scheme": scheme, "level": level,
                         "max": mx, "min": mn, "inferred": False})

    # MIS with a single age: BGS records one value (max == min). Treat it as
    # the stage's base and close it at the next younger stage's base.
    mis = sorted((x for x in regional if x["level"] == "mis"), key=lambda x: -x["max"])
    for i, x in enumerate(mis):
        if x["max"] == x["min"] and i + 1 < len(mis):
            x["min"] = mis[i + 1]["max"]
            x["inferred"] = True
            report["mis_inferred"].append(x["code"])

    regional_iris = {x["iri"] for x in regional}
    for x in regional:
        c = x["iri"]
        col_id = f"{x['scheme']}-{x['level']}" if x["scheme"] != "mis" else "mis"
        report["regional"][col_id] += 1
        out.add((c, RDF.type, SKOS.Concept))
        out.add((c, RDF.type, BGSC.RegionalUnit))
        out.add((c, RDFS.isDefinedBy, GEO.Division))
        out.add((c, BGSC.column, BGSC[col_id]))
        full = blabel(c)
        out.add((c, SKOS.prefLabel, Literal(full, lang="en")))
        short = REGIONAL_SUFFIX.sub("", full)
        if x["level"] == "mis":
            short = full.replace("Marine Isotope Stage ", "")
        out.add((c, BGSC.shortLabel, Literal(short, lang="en")))
        for p in (SKOS.notation, SKOS.definition):
            v = bgs.value(c, p)
            if v is not None:
                out.add((c, p, Literal(str(v), lang="en") if p == SKOS.definition else v))
        col = bgs.value(c, SDO.color)
        if col is not None:
            out.add((c, SDO.color, Literal(str(col))))
        marker(c, TIME.hasBeginning, x["max"])
        marker(c, TIME.hasEnd, x["min"], inferred=x["inferred"])
        if x["inferred"]:
            out.add((c, BGSC.rangeInferred, Literal(True)))
        for parent in bgs.objects(c, SKOS.broader):
            if parent in regional_iris or parent in used:
                out.add((c, SKOS.broader, parent))

    # Column definitions, ordered left to right.
    order = 0
    for scheme in ("uk", "nw-europe", "mis"):
        for level in ("series", "stage", "substage", "mis"):
            col_id = "mis" if scheme == "mis" else f"{scheme}-{level}"
            if (scheme == "mis") != (level == "mis") or not report["regional"].get(col_id):
                continue
            order += 1
            colnode = BGSC[col_id]
            out.add((colnode, RDF.type, BGSC.Column))
            out.add((colnode, SH.order, Literal(order)))
            out.add((colnode, BGSC.scheme, Literal(scheme)))
            out.add((colnode, BGSC.schemeLabel, Literal(schemes_cfg["schemes"][scheme]["label"], lang="en")))
            out.add((colnode, SKOS.prefLabel, Literal(COLUMN_LABELS[level], lang="en")))

    return out, report


def copy_ui_labels(ics: Graph, out: Graph):
    """English UI/header labels the chart UI looks up (column headings etc.)."""
    keep = (STRAT, VIS, str(GTS), str(ISC) + "Eons", str(ISC) + "Eras", str(ISC) + "Periods",
            str(ISC) + "Epochs", str(ISC) + "Ages", str(ISC) + "SuperEons")
    ics_only = {VIS + "mainBlurb", VIS + "ccgm", VIS + "ChartTitle"}  # replaced or not applicable
    for s, p, o in ics.triples((None, SKOS.prefLabel, None)):
        if (isinstance(s, URIRef) and str(s).startswith(keep) and str(s) not in ics_only
                and getattr(o, "language", None) in ("en", None)):
            out.add((s, p, o))


BLURB = {
    VIS + "mainBlurb": (
        "This chart presents the BGS Geochronology vocabulary (http://data.bgs.ac.uk/ref/Geochronology/Division) "
        "laid out on the structure of the International Chronostratigraphic Chart. Numeric ages, names and colours "
        "are those published by BGS; they may differ from the current ICS chart where BGS has not yet adopted a "
        "revision.\n\n"
        "Hierarchy, ordering and GSSP/GSSA ratification are taken from the International Chronostratigraphic "
        "Chart (International Commission on Stratigraphy, https://stratigraphy.org/chart), used under CC BY 4.0. "
        "A dashed outline marks a unit where BGS has no value for something shown (usually colour), so the "
        "ICS value is used.\n\n"
        "British regional and NW European series and stages, and Marine Isotope Stages, are shown alongside. "
        "Marine Isotope Stages recorded by BGS with a single age are drawn from that age to the next younger stage."
    ),
    str(DCT) + "contributor": "Data: British Geological Survey. Chart software: adapted from i-c-stratigraphy/chart.",
    str(SDO) + "license": "International Chronostratigraphic Chart structure © International Commission on Stratigraphy, CC BY 4.0.",
}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--endpoint", help="SPARQL endpoint URL (CONSTRUCT via POST)")
    src.add_argument("--ttl", nargs="+", help="BGS Geochronology TTL file(s): local paths or URLs")
    ap.add_argument("--ics", default=str(REPO / "chart.ttl"), help="ICS chart.ttl (structure)")
    ap.add_argument("--query", default=str(HERE / "queries" / "bgs-geochronology.rq"))
    ap.add_argument("--schemes", default=str(HERE / "regional-schemes.json"))
    ap.add_argument("--out", default=str(HERE / "build" / "bgs-chart.ttl"))
    ap.add_argument("--report", default=str(HERE / "build" / "bgs-chart-report.json"))
    ap.add_argument("--source-label", help="How to name the data source in the chart notes "
                    "(default: the endpoint or TTL location)")
    a = ap.parse_args(argv)
    source = a.source_label or a.endpoint or ", ".join(a.ttl)

    bgs = load_bgs(Path(a.query).read_text(), a.endpoint, a.ttl or [])
    if len(bgs) == 0:
        sys.exit("No BGS triples returned - check the endpoint/graph or the TTL path.")
    ics = Graph()
    ics.parse(a.ics)
    out, report = build(bgs, ics, json.loads(Path(a.schemes).read_text()))
    copy_ui_labels(ics, out)

    # Chart metadata (title/version shown by the UI)
    out.add((CHART_SCHEME, SKOS.prefLabel, Literal("BGS Geochronological Chart", lang="en")))
    version = bgs.value(CHART_SCHEME, OWL.versionInfo)
    out.add((CHART_SCHEME, OWL.versionInfo, Literal(str(version or "unversioned"))))
    out.add((CHART_SCHEME, DCT.creator, Literal("https://www.bgs.ac.uk/")))
    for iri, text in BLURB.items():
        if iri == VIS + "mainBlurb":
            text += f"\n\nBuilt from {source} (BGS vocabulary version {version or 'unversioned'})."
        out.add((URIRef(iri), SKOS.prefLabel, Literal(text, lang="en")))

    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    out.serialize(a.out, format="turtle")
    report["regional"] = dict(report["regional"])
    report["source"] = {"input": a.endpoint or a.ttl, "label": source,
                        "bgs_version": str(version) if version else None}
    report["summary"] = {
        "ics_units": len(report["matches"]) + len(report["fallbacks"]),
        "matched_cgi": sum(m["method"] == "cgi" for m in report["matches"]),
        "matched_label": sum(m["method"] == "label" for m in report["matches"]),
        "ics_fallbacks": len(report["fallbacks"]),
        "age_differences": len(report["age_differences"]),
        "colour_fallbacks": len(report["colour_fallbacks"]),
        "regional_units": report["regional"],
        "mis_inferred": len(report["mis_inferred"]),
        "triples": len(out),
    }
    Path(a.report).write_text(json.dumps(report, indent=2))
    print(json.dumps(report["summary"], indent=2))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        write_github_summary(report, os.environ["GITHUB_STEP_SUMMARY"])


def write_github_summary(report: dict, path: str):
    """Markdown summary for the GitHub Actions run page."""
    s = report["summary"]
    lines = [
        "## BGS chart data",
        f"Source: `{report['source']['label']}`, BGS version `{report['source']['bgs_version']}`",
        "",
        "| | |", "|---|---|",
        f"| ICS units | {s['ics_units']} |",
        f"| joined by CGI match | {s['matched_cgi']} |",
        f"| joined by label (CGI match missing/wrong) | {s['matched_label']} |",
        f"| filled entirely from ICS | {s['ics_fallbacks']} |",
        f"| ICS colour used | {s['colour_fallbacks']} |",
        f"| units whose ages differ from ICS | {s['age_differences']} |",
        f"| MIS with inferred range | {s['mis_inferred']} |",
    ] + [f"| regional: {k} | {v} |" for k, v in sorted(s["regional_units"].items())]
    if report["fallbacks"]:
        lines += ["", "**Filled from ICS:** " + ", ".join(f["ics"] for f in report["fallbacks"])]
    with open(path, "a") as fh:
        fh.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
