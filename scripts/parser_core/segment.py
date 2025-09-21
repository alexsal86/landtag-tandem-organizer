import re
from typing import List, Dict, Optional

# Verbesserter Regex für Sprecherzeilen
SPEAKER_REGEX = re.compile(
    r"""^(?P<prefix_num>\d+\.\s*)?
        (?P<prefix>(?:(?:Präsidentin|Präsident|Vizepräsidentin|Vizepräsident|Abg\.|Frau|Herr|Staatssekretär(?:in)?|Minister(?:in)?|Staatsminister(?:in)?|Prof\.|Dr\.)\s+)+)
        (?P<name>[A-ZÄÖÜ][\wÄÖÜäöüß'\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß'\-]+)+)
        (?:\s+\((?P<party_paren>[A-ZÄÖÜ/]+)\)|\s+(?P<party_plain>[A-ZÄÖÜ/]{2,}(?:/[A-ZÄÖÜ/]+)?))?
        :\s?(?P<after>.*)$
    """,
    re.VERBOSE
)

# Mapping zur Normalisierung von Parteien
PARTY_NORMALIZATION = {
    "GRÜNE": "GRUENE",
    "BÜNDNIS90/DIEGRÜNEN": "GRUENE",
    "B90/DIEGRÜNEN": "GRUENE",
    "FDP/DVP": "FDP-DVP",
    # Beispiele – erweiterbar
    "CDU": "CDU",
    "SPD": "SPD",
    "AFD": "AfD",
    "FDP": "FDP"
}

ROLE_KEYWORDS = {
    "präsident": "Präsidium",
    "vizepräsident": "Präsidium",
    "abg.": "Abgeordnete/r",
    "minister": "Minister",
    "staatssekretär": "Staatssekretär",
    "staatsminister": "Staatsminister"
}

TITLE_TOKENS = {"dr.", "prof."}


def normalize_party(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    key = raw.upper().replace("Ä", "AE").replace("Ö", "OE").replace("Ü", "UE").replace("ß", "SS")
    key = key.replace(" ", "").replace("-", "").replace("_", "")
    return PARTY_NORMALIZATION.get(raw, PARTY_NORMALIZATION.get(key, raw))


def detect_role(prefix_block: str) -> Optional[str]:
    # Suche nach Rolle anhand der Tokens im Präfix
    low = prefix_block.lower()
    for kw, role in ROLE_KEYWORDS.items():
        if kw in low:
            return role
    return None


def extract_titles(prefix_block: str) -> List[str]:
    titles = []
    for token in prefix_block.strip().split():
        t = token.lower()
        if t in TITLE_TOKENS:
            titles.append(token.rstrip("."))
    return titles


def normalize_speaker_name(name: str) -> str:
    # Platzhalter – hier könnte später Dr./Prof. rausgefiltert werden, falls im Namen enthalten
    return name.strip()


def segment_speeches(flat_lines: List[Dict]) -> List[Dict]:
    """
    flat_lines: [{page, text}]
    returns speeches with start/end pages
    """
    speeches = []
    current = None

    for entry in flat_lines:
        line = entry["text"].strip()

        m = SPEAKER_REGEX.match(line)
        if m:
            # Abschluss des vorherigen
            if current:
                finish_current_speech(current, speeches)

            prefix_block = m.group("prefix") or ""
            raw_name = m.group("name").strip()
            party = m.group("party_paren") or m.group("party_plain")
            party_norm = normalize_party(party)
            role = detect_role(prefix_block)
            titles = extract_titles(prefix_block)

            after = m.group("after").strip() if m.group("after") else ""

            current = {
                "index": len(speeches) + 1,
                "speaker": {
                    "raw": f"{prefix_block}{raw_name}".strip(),
                    "normalized_name": normalize_speaker_name(raw_name),
                    "role": role,
                    "titles": titles,
                    "party": party_norm
                },
                "text_parts": [],
                "start_page": entry["page"],
                "end_page": entry["page"]
            }
            if after:
                current["text_parts"].append(after)
        else:
            # Zeilen, die NICHT mit einem neuen Sprecher beginnen
            if current:
                # Applaus / Zwischenrufe markieren?
                if is_interjection(line):
                    if "annotations" not in current:
                        current["annotations"] = []
                    current["annotations"].append({
                        "type": "interjection",
                        "text": line,
                        "page": entry["page"]
                    })
                else:
                    current["text_parts"].append(line)
                    current["end_page"] = entry["page"]
            else:
                # Preamble ignorieren oder später sammeln
                pass

    if current:
        finish_current_speech(current, speeches)

    return speeches


INTERJECTION_PATTERNS = [
    re.compile(r"^\(Beifall.*\)$"),
    re.compile(r"^\(Heiterkeit.*\)$"),
    re.compile(r"^\(Zuruf.*\)$"),
    re.compile(r"^\(Lachen.*\)$"),
    re.compile(r"^\(Unruhe.*\)$"),
]


def is_interjection(line: str) -> bool:
    l = line.strip()
    if not (l.startswith("(") and l.endswith(")")):
        return False
    for pat in INTERJECTION_PATTERNS:
        if pat.match(l):
            return True
    return False


def finish_current_speech(current: Dict, speeches: List[Dict]):
    # Join
    text = "\n".join(p for p in current["text_parts"] if p.strip())
    current.pop("text_parts", None)
    current["text"] = text
    speeches.append(current)
