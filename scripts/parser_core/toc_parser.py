import re
import unicodedata
from typing import List, Dict, Any, Optional, Tuple

"""
Parser für das Inhaltsverzeichnis (Tagesordnung).

Ziele (gemäß Anforderung):
- Punkte OHNE führende Ziffer: einzelne (unnummerierte) Tagesordnungspunkte (z. B. "Eröffnung – Mitteilungen der Präsidentin.")
- Punkte MIT führender Ziffer: echte Tagesordnungspunkte. Struktur:
    <NUMMER>. <ART> – <TITEL> – Drucksache <NR>
  Beispiele für <ART>: "Aktuelle Debatte", "Zweite Beratung des Gesetzentwurfs der Landesregierung", ...
- Unterpunkte unter einem nummerierten TOP:
    • "Beschlussempfehlung und Bericht des Ausschusses … – Drucksache <NR>"
    • "Beschluss"
- Danach: Redereihenfolge (Zeilen beginnend mit Abg./Minister/Staatssekretär/Präsident(in) …).
- Seitenzahlen und Punktreihen (… … … 7639) AM ENDE von Zeilen werden ignoriert.
- Bold/Typografie aus PDF ist nicht erforderlich; wir arbeiten textbasiert.

Eingabeformat:
- flat_lines: Liste von Dicts mit mindestens: { "text": str, "page": int, "line_index": int }
  (Es ist okay, hier nur die TOC-Seite(n) zu übergeben.)

Ausgabeformat:
{
  "items": [
    {
      "number": 1,                       # None bei unnummerierten Punkten
      "kind": "Aktuelle Debatte",
      "title": "Schleichender Verlust kultureller und pädagogischer Selbstbestimmung unserer Kinder",
      "drucksachen": ["17/90977"],       # Liste aller DS-Nrn, die im Kopf des TOPs stehen (falls vorhanden)
      "extra": "beantragt von der Fraktion der AfD",   # optional, falls vorhanden
      "subentries": [                    # Unterpunkte (z. B. Beschlussempfehlungen)
        {
          "text": "Beschlussempfehlung und Bericht des Ausschusses für Wissenschaft, Forschung und Kunst",
          "drucksachen": ["17/8861"]
        },
        {
          "text": "Beschluss",
          "drucksachen": []
        }
      ],
      "speakers": [                      # Redereihenfolge
        { "role": "Abg.", "name": "Rainer Balzer", "party": "AfD" },
        { "role": "Abg.", "name": "Marilena Geugjes", "party": "GRÜNE" },
        { "role": "Staatssekretärin", "name": "Sandra Boser", "party": None }
      ],
      "raw_header": "1. Aktuelle Debatte – … (bereinigt, ohne Seitenziffern)",
      "raw_lines": [ ... ]               # optional, alle Rohzeilen (bereinigt) die in diesen TOP eingeflossen sind
    },
    ...
  ]
}

Anmerkungen:
- "drucksachen" enthält nur Nummern im Format \d+/\d+ (z. B. "17/8819").
- Dot-Leader/Punktreihen und Seitenzahlen am Zeilenende werden entfernt.
- Mehrzeilige Header (z. B. "<ART> –" in Zeile 1, "<TITEL> – Drucksache <NR>" in Zeile 2) werden korrekt zusammengefügt.
- Die Rolle/Partei für Sprecherzeilen wird heuristisch wie im Reden-Parser erkannt (ohne Doppelpunkt).

"""

# -----------------------------------------------------------
# Regex-Grundlagen
# -----------------------------------------------------------

# Führende Ziffern wie "1." (mit optionalem Leerraum danach)
NUMBERED_START_RE = re.compile(r"^\s*(?P<num>\d+)\.\s+(?P<body>.+)$")

# Unnummerierter, eigenständiger Punkt (heuristisch: enthält einen Gedankenstrich " – " im Kopf)
UNNUMBERED_HEADER_HINT_RE = re.compile(r".+\s[–—-]\s+.+")  # "Eröffnung – Mitteilungen der Präsidentin."

# Dot-Leader + Seitenzahl(en) am Zeilenende
DOT_LEADER_PAGES_RE = re.compile(r"[.\s]{2,}\d+(?:\s*,\s*\d+)*\s*$")
TRAILING_PAGES_RE = re.compile(r"\s+\d+(?:\s*,\s*\d+)*\s*$")

# Drucksache: "Drucksache 17/8819" oder "Drs. 17/8819"
DRS_RE = re.compile(r"(?:Drucksache|Drs\.)\s*(?P<ds>\d+/\d+)", re.IGNORECASE)

# Trenner " – " bzw. " — " oder " - " (mit Leerraum)
DASH_SPLIT_RE = re.compile(r"\s[–—-]\s")

# Rollen/Sprecher (ohne Doppelpunkt im TOC)
ROLE_TOKENS = [
    r"Abg\.", r"Abgeordneter", r"Abgeordnete",
    r"Präsidentin", r"Präsident",
    r"Stellv\.\s*Präsidentin?", r"Stellv\.\s*Präsident",
    r"Ministerpräsidentin?", r"Ministerpräsident",
    r"Ministerin?", r"Minister",
    r"Staatssekretärin?", r"Staatssekretär"
]
ROLE_PATTERN = "(?:" + "|".join(ROLE_TOKENS) + ")"

PARTY_VARIANTS = [
    r"AfD", r"CDU", r"SPD", r"FDP/DVP", r"FDP",
    r"GRÜNE", r"GRUENE", r"B90/GRÜNE", r"BÜNDNIS(?:\s+90/DIE\s+GRÜNEN)?",
    r"LINKE", r"DIE\s+LINKE", r"Freie\s+Wähler", r"fraktionslos"
]
PARTY_PATTERN = "(?:" + "|".join(PARTY_VARIANTS) + ")"

# Sprecherzeile (ohne Doppelpunkt, mit optionaler Partei, gefolgt ggf. von Dot-Leader + Seitenzahlen)
SPEAKER_LINE_RE = re.compile(
    rf"^\s*(?P<role>{ROLE_PATTERN})\s+(?P<name>[^.,\d][^.\d]*?)(?:\s+(?P<party>{PARTY_PATTERN}))?\s*(?:[.\s]{{2,}}\d+(?:\s*,\s*\d+)*)?\s*$",
    re.IGNORECASE
)

# Subentry "Beschlussempfehlung..." o. ä. evtl. mit Drucksache
SUBENTRY_WITH_DRS_RE = re.compile(
    rf"^(?P<text>Beschlussempfehlung.+?|Bericht.+?|Beschluss)\s*(?:{DASH_SPLIT_RE.pattern}(?:Drucksache|Drs\.)\s*(?P<ds>\d+/\d+))?$",
    re.IGNORECASE
)

# -----------------------------------------------------------
# Öffentliche API
# -----------------------------------------------------------

def parse_toc(flat_lines: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Parst die übergebenen TOC-Zeilen in strukturierte Tagesordnung.
    Erwartet nur die TOC-Seiten (oder einen entsprechend herausgefilterten Ausschnitt).
    """
    items: List[Dict[str, Any]] = []
    i = 0
    n = len(flat_lines)

    # Zustände
    current: Optional[Dict[str, Any]] = None

    while i < n:
        raw = (flat_lines[i].get("text") or "")
        raw = unicodedata.normalize("NFKC", raw)
        text = _cleanup_line(raw)
        if not text:
            i += 1
            continue

        # 1) Neuer nummerierter TOP?
        m_num = NUMBERED_START_RE.match(text)
        if m_num:
            # Finalisiere vorherigen
            if current:
                items.append(current)
                current = None

            num = int(m_num.group("num"))
            body_first = m_num.group("body").strip()
            header_lines = [body_first]

            # Ziehe evtl. mehr Headerzeilen ein (Mehrzeiler bis wir klar einen Subentry/Sprecher/neuen TOP finden)
            j = i + 1
            while j < n:
                nxt_raw = unicodedata.normalize("NFKC", flat_lines[j].get("text") or "")
                nxt = _cleanup_line(nxt_raw)
                if not nxt:
                    break
                if NUMBERED_START_RE.match(nxt):
                    break
                if _looks_like_subentry(nxt) or _looks_like_speaker(nxt):
                    break
                # Ansonsten gehört's zum Header
                header_lines.append(nxt)
                j += 1

            header_text = " ".join(header_lines).strip()
            header_text = _strip_trailing_pages(header_text)

            kind, title, extra, drs_list = _parse_header(header_text)

            current = {
                "number": num,
                "kind": kind,
                "title": title,
                "drucksachen": drs_list,
                "extra": extra,
                "subentries": [],
                "speakers": [],
                "raw_header": header_text,
                "raw_lines": [text] + header_lines[1:]
            }
            i = j
            continue

        # 2) Unnummerierter Einzelpunkt-Header?
        if current is None and UNNUMBERED_HEADER_HINT_RE.match(text) and not _looks_like_subentry(text) and not _looks_like_speaker(text):
            header_lines = [text]
            j = i + 1
            while j < n:
                nxt_raw = unicodedata.normalize("NFKC", flat_lines[j].get("text") or "")
                nxt = _cleanup_line(nxt_raw)
                if not nxt:
                    break
                if NUMBERED_START_RE.match(nxt):
                    break
                if _looks_like_subentry(nxt) or _looks_like_speaker(nxt):
                    break
                header_lines.append(nxt)
                j += 1

            header_text = " ".join(header_lines).strip()
            header_text = _strip_trailing_pages(header_text)
            kind, title, extra, drs_list = _parse_header(header_text)

            current = {
                "number": None,
                "kind": kind,
                "title": title,
                "drucksachen": drs_list,
                "extra": extra,
                "subentries": [],
                "speakers": [],
                "raw_header": header_text,
                "raw_lines": header_lines[:]
            }
            i = j
            continue

        # Ab hier müssen wir innerhalb eines laufenden Items sein, sonst ignorieren
        if current is None:
            i += 1
            continue

        # 3) Subentry (Beschlussempfehlung / Bericht / Beschluss)
        if _looks_like_subentry(text):
            sub_text, ds = _parse_subentry(text)
            current["subentries"].append({
                "text": sub_text,
                "drucksachen": ds
            })
            current["raw_lines"].append(text)
            i += 1
            continue

        # 4) Sprecherzeile (Redereihenfolge)
        if _looks_like_speaker(text):
            sp = _parse_speaker_line(text)
            if sp:
                current["speakers"].append(sp)
                current["raw_lines"].append(text)
            i += 1
            continue

        # 5) Anderes (Ignorieren oder als Zusatztext in 'extra' anhängen)
        # Falls 'extra' leer ist, hänge bereinigte Zeile an (z. B. "beantragt von ...")
        # aber Seitenzahlen sollten bereits entfernt sein.
        if text and text not in current["raw_lines"]:
            # Versuche Drucksachen auch hier zu sammeln
            ds_more = _find_all_drs(text)
            if ds_more:
                for d in ds_more:
                    if d not in current["drucksachen"]:
                        current["drucksachen"].append(d)
                # Entferne DS aus Text, Rest evtl. als 'extra'
                text_wo_drs = DRS_RE.sub("", text).strip(" –—-")
                if text_wo_drs:
                    current["extra"] = (current.get("extra") + " " + text_wo_drs).strip() if current.get("extra") else text_wo_drs
            else:
                current["extra"] = (current.get("extra") + " " + text).strip() if current.get("extra") else text
            current["raw_lines"].append(text)
        i += 1

    # Finalisieren
    if current:
        items.append(current)

    # Normalisierungen am Ende: trimmen leere Strings
    for it in items:
        if it.get("extra"):
            it["extra"] = it["extra"].strip(" –—-")
        if not it.get("extra"):
            it["extra"] = None
        # Partei-Normierung in Speaker
        for sp in it.get("speakers", []):
            sp["party"] = _normalize_party(sp.get("party"))

    return { "items": items }

# -----------------------------------------------------------
# Hilfsfunktionen – Parsing
# -----------------------------------------------------------

def _cleanup_line(s: str) -> str:
    s = s.strip()
    if not s:
        return ""
    # Dot-Leader + Seitenzahlen entfernen
    s = _strip_trailing_pages(s)
    # Mehrfache Spaces normalisieren (aber Gedankenstriche erhalten)
    s = re.sub(r"[ \t]+", " ", s)
    # Typografische Varianten angleichen
    s = s.replace("—", "–")
    return s.strip()

def _strip_trailing_pages(s: str) -> str:
    s2 = DOT_LEADER_PAGES_RE.sub("", s)
    s2 = TRAILING_PAGES_RE.sub("", s2)  # falls ohne Punktreihe
    return s2.strip()

def _parse_header(header_text: str) -> Tuple[Optional[str], Optional[str], Optional[str], List[str]]:
    """
    Splittet den Header in (kind, title, extra, drucksachen).
    Vorgehen:
      - Alle Drucksachen herausziehen und aus dem Text entfernen
      - Danach an ' – ' splitten
      - kind = first part
      - title = second part (falls vorhanden)
      - extra = Rest (zusammengefügt), falls noch Inhalt
    """
    ds = _find_all_drs(header_text)
    text_wo_drs = DRS_RE.sub("", header_text).strip(" –—-")
    parts = DASH_SPLIT_RE.split(text_wo_drs)

    kind = parts[0].strip() if parts else None
    title = parts[1].strip() if len(parts) >= 2 else None
    extra = " – ".join(p.strip() for p in parts[2:]).strip() if len(parts) >= 3 else None
    if extra == "":
        extra = None
    return kind, title, extra, ds

def _find_all_drs(text: str) -> List[str]:
    return [m.group("ds") for m in DRS_RE.finditer(text)]

def _looks_like_subentry(text: str) -> bool:
    if text.lower().startswith("beschluss"):
        return True
    if text.lower().startswith("beschlussempfehlung") or text.lower().startswith("bericht"):
        return True
    # Auch Zeilen mit " – Drucksache" als Subentry interpretieren, wenn sie nicht mit Nummer anfangen
    if "Drucksache" in text or "Drs." in text:
        if not NUMBERED_START_RE.match(text) and not _looks_like_speaker(text):
            return True
    return False

def _parse_subentry(text: str) -> Tuple[str, List[str]]:
    ds = _find_all_drs(text)
    # Entferne Drucksache-Teile und Trennstriche
    txt = DRS_RE.sub("", text).strip(" –—-").strip()
    # Häufige Präfixe vereinheitlichen:
    return txt, ds

def _looks_like_speaker(text: str) -> bool:
    return SPEAKER_LINE_RE.match(text) is not None

def _parse_speaker_line(text: str) -> Optional[Dict[str, Any]]:
    m = SPEAKER_LINE_RE.match(text)
    if not m:
        return None
    role = _normalize_role(m.group("role"))
    name = _strip_academic_titles((m.group("name") or "").strip())
    party = _normalize_party(m.group("party")) if m.group("party") else None
    return {
        "role": role,
        "name": name,
        "party": party
    }

# -----------------------------------------------------------
# Normalisierung
# -----------------------------------------------------------

def _normalize_role(r: Optional[str]) -> Optional[str]:
    if not r:
        return r
    r = r.strip()
    if r.lower().startswith("abgeordnete"):
        return "Abg."
    return r

def _normalize_party(p: Optional[str]) -> Optional[str]:
    if not p:
        return p
    t = p.strip()
    upper_compact = re.sub(r"\s+", "", t.upper())
    mapping = {
        "GRUENE": "GRÜNE",
        "B90/GRÜNE": "GRÜNE",
        "BÜNDNIS": "BÜNDNIS 90/DIE GRÜNEN",
        "BÜNDNIS90/DIEGRÜNEN": "BÜNDNIS 90/DIE GRÜNEN",
        "BÜNDNIS90/DIEGRUENEN": "BÜNDNIS 90/DIE GRÜNEN",
        "FREIEWÄHLER": "Freie Wähler",
        "FREIEWAHLER": "Freie Wähler",
        "LINKE": "DIE LINKE",
        "DIELINKE": "DIE LINKE",
        "FRAKTIONSLOS": "fraktionslos",
        "AFD": "AfD",
        "CDU": "CDU",
        "SPD": "SPD",
        "FDP/DVP": "FDP/DVP",
        "FDP": "FDP",
        "GRÜNE": "GRÜNE",
        "FW": "Freie Wähler"
    }
    return mapping.get(upper_compact, t)

ACADEMIC_TITLE_RE = re.compile(
    r"\b(?:Dr\.?|Prof\.?|Professor(?:in)?|Dipl\.-Ing\.?|Dipl\.-Kfm\.?|Mag\.?|BSc|MSc|LL\.M\.?|MBA|MdL)\b\.?",
    re.IGNORECASE
)
MULTI_SPACE_RE = re.compile(r"\s{2,}")

def _strip_academic_titles(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    cleaned = ACADEMIC_TITLE_RE.sub("", name)
    cleaned = MULTI_SPACE_RE.sub(" ", cleaned)
    return cleaned.strip() or name

# -----------------------------------------------------------
# Demo
# -----------------------------------------------------------

if __name__ == "__main__":
    # Beispiel anhand des Screenshots
    demo_lines = [
        {"page": 1, "line_index": 0, "text": "Eröffnung – Mitteilungen der Präsidentin.  . . . . . . . . . . . . . . . . . . . . 7639"},
        {"page": 1, "line_index": 1, "text": ""},
        {"page": 1, "line_index": 2, "text": "1. Aktuelle Debatte – Schleichender Verlust kultureller und pädagogischer Selbstbestimmung unserer Kinder – beantragt von der Fraktion der AfD . . . . . . . . . . . . . . . . 7639"},
        {"page": 1, "line_index": 3, "text": ""},
        {"page": 1, "line_index": 4, "text": "Abg. Dr. Rainer Balzer AfD . . . . . . . . . . . . . . . . . . . . . . 7639, 7650"},
        {"page": 1, "line_index": 5, "text": "Abg. Dr. Marilena Geugjes GRÜNE . . . . . . . . . . . . . . . . . . 7641, 7650"},
        {"page": 1, "line_index": 6, "text": "Staatssekretärin Sandra Boser . . . . . . . . . . . . . . . . . . . . . . 7648"},
        {"page": 1, "line_index": 7, "text": ""},
        {"page": 1, "line_index": 8, "text": "2. Zweite Beratung des Gesetzentwurfs der Landesregierung – Gesetz zur Neuregelung des Landesarchivrechts – Drucksache 17/8819"},
        {"page": 1, "line_index": 9, "text": "Beschlussempfehlung und Bericht des Ausschusses für Wissenschaft, Forschung und Kunst – Drucksache 17/8861 . . . . . . . . . 7651"},
        {"page": 1, "line_index": 10, "text": "Abg. Stefanie Seemann GRÜNE . . . . . . . . . . . . . . . . . . . . . 7651"},
        {"page": 1, "line_index": 11, "text": "Abg. Dr. Alexander Becker CDU . . . . . . . . . . . . . . . . . . . . 7652"},
        {"page": 1, "line_index": 12, "text": "Beschluss . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 7656"},
    ]
    parsed = parse_toc(demo_lines)
    import json
    print(json.dumps(parsed, ensure_ascii=False, indent=2))
