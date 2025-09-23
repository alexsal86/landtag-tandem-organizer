import re
from typing import List, Dict, Optional

# Erweiterte Sprecher-Regex:
# - erlaubt zweiteilige/mehrteilige Namen
# - Partei in Klammern ODER blank ODER versehentlich ans Ende des Namens gehängt
# - erlaubt zusammengesetzte Rollen (Stellv. Präsident ...)
SPEAKER_REGEX = re.compile(
    r"""
    ^(?P<prefix_num>\d+\.\s*)?                             # optional führende Nummer (z.B. 2.)
    (?P<prefix>(?:
        (?:Stellv\.\s+Präsident(?:in)?|
           Präsident(?:in)?|
           Vizepräsident(?:in)?|
           Abg\.|
           Frau|
           Herr|
           Staatssekretär(?:in)?|
           Staatsminister(?:in)?|
           Minister(?:in)?|
           Prof\.|
           Dr\.)\s+
    )+)
    (?P<name>[A-ZÄÖÜ][\wÄÖÜäöüß'\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß'\-]+){0,5})
    (?:\s+\((?P<party_paren>[A-ZÄÖÜ/]+)\)|
       \s+(?P<party_plain>(?:AfD|CDU|SPD|FDP/DVP|FDP|GRÜNE|GRUENE|BÜNDNIS\s+90/DIE\s+GRÜNEN))
    )?
    \s*:\s*(?P<after>.*)$
    """,
    re.VERBOSE
)

# Parteien-Kanon
PARTY_MAP = {
    "AFD": "AfD",
    "CDU": "CDU",
    "SPD": "SPD",
    "FDP": "FDP",
    "FDP/DVP": "FDP-DVP",
    "GRÜNE": "GRÜNE",
    "GRUENE": "GRÜNE",
    "BÜNDNIS 90/DIE GRÜNEN": "GRÜNE",
    "BUENDNIS 90/DIE GRUENEN": "GRÜNE",
}

ROLE_KEYWORDS = {
    "präsident": "Präsidium",
    "vizepräsident": "Präsidium",
    "stellv. präsident": "Präsidium",
    "abg.": "Abgeordnete/r",
    "minister": "Minister",
    "staatsminister": "Staatsminister",
    "staatssekretär": "Staatssekretär",
    "staatssekretärin": "Staatssekretär"
}

TITLE_TOKENS = {"dr.", "prof."}

# Interjections umfangreicher
INTERJECTION_PATTERNS = [
    re.compile(r"^\(Beifall.*\)$"),
    re.compile(r"^\(Zuruf.*\)$"),
    re.compile(r"^\(Lachen.*\)$"),
    re.compile(r"^\(Heiterkeit.*\)$"),
    re.compile(r"^\(Unruhe.*\)$"),
    re.compile(r"^\(Oh-Rufe.*\)$"),
    re.compile(r"^\(Glocke des Präsidenten.*\)$"),
]

# Fallback Parteien-Kürzel, falls im Namen dranhängt
PARTY_TAIL_RE = re.compile(r"\b(AfD|CDU|SPD|FDP/DVP|FDP|GRÜNE|GRUENE)\b$", re.IGNORECASE)


def normalize_party(party: Optional[str]) -> Optional[str]:
    if not party:
        return None
    key = party.upper().replace("Ä", "AE").replace("Ö", "OE").replace("Ü", "UE")
    key = key.replace("BÜNDNIS90/DIEGRÜNEN", "BÜNDNIS 90/DIE GRÜNEN")
    key = re.sub(r"\s+", " ", key).strip()
    return PARTY_MAP.get(key, PARTY_MAP.get(key.replace(" ", ""), party))


def detect_role(prefix_block: str) -> Optional[str]:
    low = prefix_block.lower()
    for kw, role in ROLE_KEYWORDS.items():
        if kw in low:
            return role
    return None


def extract_titles(prefix_block: str) -> List[str]:
    titles = []
    for token in prefix_block.strip().split():
        t = token.lower().rstrip(".")
        if t + "." in TITLE_TOKENS or t in TITLE_TOKENS:
            titles.append(token.rstrip("."))
    return titles


def clean_normalized_name(name: str) -> str:
    # Partei-Endung entfernen falls fälschlich Bestandteil
    if PARTY_TAIL_RE.search(name):
        name = PARTY_TAIL_RE.sub("", name).strip()
    # Titelreste entfernen falls versehentlich im Namen
    parts = []
    for p in name.split():
        if p.lower().rstrip(".") in {t.rstrip(".") for t in TITLE_TOKENS}:
            continue
        parts.append(p)
    return " ".join(parts).strip()


def is_interjection(line: str) -> bool:
    l = line.strip()
    if not (l.startswith("(") and l.endswith(")")):
        return False
    for pat in INTERJECTION_PATTERNS:
        if pat.match(l):
            return True
    return False


def segment_speeches(flat_lines: List[Dict]) -> List[Dict]:
    speeches: List[Dict] = []
    current = None
    i = 0
    total = len(flat_lines)

    while i < total:
        entry = flat_lines[i]
        line = entry["text"].strip()

        # Versuche direkten Match
        m = SPEAKER_REGEX.match(line)
        # Falls kein Match: Versuche Merge mit nächster Zeile (zweizeiliger Kopf)
        if not m and i + 1 < total:
            merged_candidate = line + " " + flat_lines[i + 1]["text"].strip()
            m2 = SPEAKER_REGEX.match(merged_candidate)
            if m2:
                m = m2
                # Konsumiere nächste Zeile zusätzlich
                i += 1

        if m:
            # Abschluss vorheriger Rede
            if current:
                _finish_current(current, speeches)

            prefix_block = m.group("prefix") or ""
            raw_name = m.group("name").strip()
            party = m.group("party_paren") or m.group("party_plain")
            if not party:
                # Fallback: Partei am Ende des Namens?
                tail_match = PARTY_TAIL_RE.search(raw_name)
                if tail_match:
                    party = tail_match.group(1)
                    raw_name = PARTY_TAIL_RE.sub("", raw_name).strip()

            party_norm = normalize_party(party)
            role = detect_role(prefix_block)
            titles = extract_titles(prefix_block)
            after = (m.group("after") or "").strip()

            current = {
                "index": len(speeches) + 1,
                "speaker": {
                    "raw": (prefix_block + raw_name).strip(),
                    "normalized_name": clean_normalized_name(raw_name),
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
            if current:
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
                # Präambel ignorieren
                pass
        i += 1

    if current:
        _finish_current(current, speeches)

    return speeches


def _finish_current(current: Dict, speeches: List[Dict]):
    text = "\n".join(p for p in current.get("text_parts", []) if p.strip())
    current.pop("text_parts", None)
    current["text"] = text
    speeches.append(current)
