import re
from typing import List, Dict, Any, Optional, Tuple

"""
Segmentierung flacher Zeilen (flatten_pages Output) in Reden.

Erwarteter Input flat_lines:
[
  {"page": 1, "line_index": 0, "text": "Präsidentin ...:"},
  {"page": 1, "line_index": 1, "text": "Sehr geehrte ..."},
  ...
]

Ausgabe: Liste von Speech-Objekten:
{
  "index": 1,
  "start_page": 1,
  "end_page": 2,
  "speaker": {
     "raw": "Präsidentin Muhterem Aras",
     "name": "Muhterem Aras",
     "role": "Präsidentin",
     "party": None,
     "normalized": None,
     "parliament_function": None
  },
  "text": "Redezeilen...\nNoch eine Zeile...",
  "lines": [  # optional für Debug / Offsets
     {
       "page": 1,
       "line_index": 1,
       "text": "Sehr geehrte ...",
       "char_start": 0,
       "char_end": 23
     },
     ...
  ],
  "annotations": [],
  "continuation": False,
  "debug": { ... }  # wenn debug=True
}

Optional: Offsets und char_start/char_end werden nur gefüllt, wenn capture_offsets=True
"""

# -----------------------------------------------------------
# Muster & Regex
# -----------------------------------------------------------

ROLE_PREFIX_RE = re.compile(
    r"^(Abg\.|Abgeordnete[rn]?|Präsident(?:in)?|Vizepräsident(?:in)?|Stellv\.\s*Präsident(?:in)?|"
    r"Ministerpräsident(?:in)?|Minister(?:in)?|Staatssekretär(?:in)?|Justizminister(?:in)?|"
    r"Innenminister(?:in)?|Finanzminister(?:in)?|Wirtschaftsminister(?:in)?|Kultusminister(?:in)?|"
    r"Landesbeauftragte[rn]?|Ombudsmann|Ombudsfrau)\b"
)

# Partei-Kürzel (kann erweitert werden)
PARTY_TOKEN_RE = re.compile(
    r"^(CDU|SPD|AfD|FDP\/DVP|FDP|Grüne|GRÜNE|Bündnis\s*90\/Die\s*Grünen|BÜNDNIS\s*90\/DIE\s*GRÜNEN|"
    r"FW|Freie\s*Wähler|Linke|LINKE|fraktionslos)$",
    re.IGNORECASE
)

PAREN_PARTY_RE = re.compile(r"\(([^()]{2,50})\)\s*$")
MULTI_SPACE_RE = re.compile(r"\s{2,}")
ALL_CAPS_NAME_RE = re.compile(r"^[A-ZÄÖÜÄÖÜß][A-ZÄÖÜÄÖÜß\- ]{2,}$")
TRAILING_COLON_RE = re.compile(r":\s*$")

# Zeilen, die wir ignorieren wollen (Kopfzeilen, Artefakte)
INLINE_PAGE_BREAK_MARKERS = [
    "Landtag von Baden-Württemberg",
]

# Heuristik für „Fortsetzung desselben Sprechers“ (z. B. wenn Protokoll eine formale Einleitung hat)
SAME_SPEAKER_ROLES_FOR_CONTINUATION = {
    "Abg.", "Abgeordneter", "Abgeordnete", "Abgeordneter", "Präsident", "Präsidentin",
    "Ministerpräsident", "Ministerpräsidentin", "Minister", "Ministerin", "Staatssekretär", "Staatssekretärin"
}


# -----------------------------------------------------------
# Öffentliche Hauptfunktion
# -----------------------------------------------------------

def segment_speeches(flat_lines: List[Dict[str, Any]],
                     capture_offsets: bool = False,
                     debug: bool = False,
                     min_header_confidence: float = 0.5) -> List[Dict[str, Any]]:
    """
    Segmentiert flache Zeilen in Reden.

    Parameter:
      capture_offsets: Wenn True, werden pro Speech die einzelnen Zeilen inkl. char_start/char_end
                       innerhalb des zusammengesetzten Rede-Texts gespeichert (nützlich für spätere
                       Mapping-Schritte von Interjections / Highlight).
      debug: Wenn True, wird in jeder Rede ein debug-Dict mit Erkennungs-Heuristiken abgelegt.
      min_header_confidence: Placeholder (aktuell nicht genutzt für Scoring, aber vorbereitet für spätere
                             gewichtete Header-Klassifikation).

    Rückgabe:
      Liste von Speech-Dicts (siehe Modul-Docstring).
    """
    speeches: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    body_line_entries: List[Dict[str, Any]] = []
    pending_speaker_lines: List[Dict[str, Any]] = []
    speech_index = 0
    previous_speaker_signature: Optional[Tuple[str, str]] = None  # (role, name) zur Continuation-Heuristik

    def flush_current():
        nonlocal current, body_line_entries, speeches
        if current is None:
            body_line_entries = []
            return
        # Text aus Body bauen
        text_parts = []
        char_cursor = 0
        for entry in body_line_entries:
            line_text = entry["text"]
            if line_text.strip():
                text_parts.append(line_text)
            else:
                # Leere Zeile als Absatztrenner
                text_parts.append("")
        # Rekonstruiere Text (bewahre leere Absätze -> späterer reflow kann das noch justieren)
        # Wir lassen einfache "\n" – Downstream Reflow vereinheitlicht später
        final_text = "\n".join(text_parts).strip("\n")

        if capture_offsets:
            # Offsets neu berechnen
            enriched_lines = []
            accum = 0
            for entry in body_line_entries:
                t = entry["text"]
                # Speichere Start/End nur für nicht-leere Zeilen; leere bekommen Länge 0
                if t:
                    start = accum
                    accum += len(t)
                    enriched_lines.append({
                        "page": entry["page"],
                        "line_index": entry["line_index"],
                        "text": t,
                        "char_start": start,
                        "char_end": start + len(t)
                    })
                    # newline im zusammengesetzten Text
                    accum += 1  # für das '\n'
                else:
                    start = accum
                    enriched_lines.append({
                        "page": entry["page"],
                        "line_index": entry["line_index"],
                        "text": t,
                        "char_start": start,
                        "char_end": start
                    })
                    accum += 1
        else:
            enriched_lines = None

        current["text"] = final_text
        current["end_page"] = current.get("end_page") or current["start_page"]
        current.setdefault("annotations", [])
        if capture_offsets:
            current["lines"] = enriched_lines
        if debug:
            current.setdefault("debug", {})
            current["debug"]["line_count"] = len(body_line_entries)
            current["debug"]["pending_header_lines"] = len(current["debug"].get("pending_header_lines", []))

        speeches.append(current)
        current = None
        body_line_entries = []

    for line_obj in flat_lines:
        raw_line = line_obj.get("text", "")
        if raw_line is None:
            raw_line = ""
        page = line_obj.get("page")
        line_index = line_obj.get("line_index")

        # Normalisierung (nur für Header-Erkennung – Body speichern wir original)
        norm_line = raw_line.rstrip()

        if not norm_line.strip():
            if current is not None:
                body_line_entries.append({"page": page, "line_index": line_index, "text": ""})
            continue

        # Kopf-/Seitentrennermarker wegfiltern
        if any(norm_line.startswith(m) for m in INLINE_PAGE_BREAK_MARKERS):
            continue

        # Prüfen ob die Zeile (oder ein Fragment) wie ein Sprecherheader aussieht
        is_header_candidate = _looks_like_speaker_line(norm_line)

        if is_header_candidate:
            # Sammeln für evtl. Multi-Line Header
            pending_speaker_lines.append({
                "page": page,
                "line_index": line_index,
                "text": norm_line
            })
            # Wenn Zeile wahrscheinlich komplett (endet mit ":")
            if norm_line.endswith(":"):
                full_header_text = _merge_speaker_header([p["text"] for p in pending_speaker_lines])
                header_page = pending_speaker_lines[0]["page"]
                header_line_index = pending_speaker_lines[0]["line_index"]

                # Alte Rede flushen
                flush_current()
                speech_index += 1
                speaker_meta = _parse_speaker_header(full_header_text)

                # Continuation-Heuristik: gleicher (role, name) wie vorheriger?
                signature = (speaker_meta.get("role"), speaker_meta.get("name"))
                continuation = False
                if previous_speaker_signature and signature == previous_speaker_signature:
                    continuation = True

                current = {
                    "index": speech_index,
                    "start_page": header_page,
                    "end_page": header_page,
                    "speaker": speaker_meta,
                    "continuation": continuation
                }
                if debug:
                    current.setdefault("debug", {})
                    current["debug"]["header_lines"] = [p["text"] for p in pending_speaker_lines]
                    current["debug"]["pending_header_lines"] = [p["text"] for p in pending_speaker_lines]

                previous_speaker_signature = signature
                pending_speaker_lines.clear()
            else:
                # Header ist evtl. umgebrochen – weiter sammeln
                continue
        else:
            # Es gibt pending Speaker Lines, aber Zeile passt nicht -> false positive
            if pending_speaker_lines:
                # Dann interpretieren wir die bisher gesammelten als normalen Bodytext
                if current is None:
                    speech_index += 1
                    current = {
                        "index": speech_index,
                        "start_page": page,
                        "end_page": page,
                        "speaker": {
                            "raw": None,
                            "name": None,
                            "role": None,
                            "party": None,
                            "normalized": None,
                            "parliament_function": None
                        },
                        "continuation": False
                    }
                for pl in pending_speaker_lines:
                    body_line_entries.append({
                        "page": pl["page"],
                        "line_index": pl["line_index"],
                        "text": pl["text"]
                    })
                pending_speaker_lines.clear()

            # Normale Body-Zeile
            if current is None:
                # Text vor erster Sprecherzeile → anonyme Rede
                speech_index += 1
                current = {
                    "index": speech_index,
                    "start_page": page,
                    "end_page": page,
                    "speaker": {
                        "raw": None,
                        "name": None,
                        "role": None,
                        "party": None,
                        "normalized": None,
                        "parliament_function": None
                    },
                    "continuation": False
                }
                previous_speaker_signature = None
            else:
                if page > current.get("end_page", page):
                    current["end_page"] = page

            body_line_entries.append({
                "page": page,
                "line_index": line_index,
                "text": norm_line
            })

    # Offene pending Header Lines am Ende?
    if pending_speaker_lines:
        # Falls keine Rede offen -> neue anonyme Rede
        if current is None:
            if flat_lines:
                last_page = flat_lines[-1]["page"]
            else:
                last_page = 1
            speech_index += 1
            current = {
                "index": speech_index,
                "start_page": last_page,
                "end_page": last_page,
                "speaker": {
                    "raw": None,
                    "name": None,
                    "role": None,
                    "party": None,
                    "normalized": None,
                    "parliament_function": None
                },
                "continuation": False
            }
        for pl in pending_speaker_lines:
            body_line_entries.append({
                "page": pl["page"],
                "line_index": pl["line_index"],
                "text": pl["text"]
            })
        pending_speaker_lines.clear()

    # Letzte Rede flushen
    flush_current()

    return speeches


# -----------------------------------------------------------
# Hilfsfunktionen
# -----------------------------------------------------------

def _looks_like_speaker_line(line: str) -> bool:
    """
    Heuristik zur Erkennung einer (Teil-)Sprecherzeile.
    """
    stripped = line.strip()
    if not stripped:
        return False

    # Offensichtlicher Rolleneinstieg
    if ROLE_PREFIX_RE.search(stripped):
        return True

    # Zeile endet mit ":" und hat wenige Tokens (z. B. "Präsidentin:"), oft verkürzte Form
    if stripped.endswith(":") and len(stripped.split()) <= 2:
        return True

    # Zeile endet mit ":" und erstes Token ist eine Rolle
    if stripped.endswith(":") and ROLE_PREFIX_RE.search(stripped.split()[0]):
        return True

    # All-Caps Name + Doppelpunkt (typografische Variationen)
    if stripped.endswith(":") and ALL_CAPS_NAME_RE.match(stripped[:-1].strip()):
        return True

    # Doppelpunkt + Klammern (Partei)
    if stripped.endswith(":") and "(" in stripped and ")" in stripped:
        return True

    # Falls kein Doppelpunkt, aber Rolle drin (Multi-Line Header, nächste Zeile folgt evtl. mit Rest + ":")
    if ROLE_PREFIX_RE.search(stripped) and not stripped.endswith(":"):
        return True

    return False


def _merge_speaker_header(lines: List[str]) -> str:
    """
    Fasse mehrere (umgebrochene) Sprecherheaderzeilen zusammen.
    Entfernt doppelte Leerzeichen.
    """
    raw = " ".join(l.strip() for l in lines)
    raw = MULTI_SPACE_RE.sub(" ", raw)
    return raw


def _parse_speaker_header(header: str) -> Dict[str, Any]:
    """
    Parsed finalen Sprecherheader (mit ":" am Ende).
    Entfernt abschließenden ":" und extrahiert Rolle, Name, Partei.
    Gibt strukturierte Speaker-Metadaten zurück.
    """
    h = header.strip()
    if h.endswith(":"):
        h = h[:-1].strip()

    # Partei in Klammern extrahieren
    party = None
    m_paren = PAREN_PARTY_RE.search(h)
    if m_paren:
        candidate = m_paren.group(1).strip()
        if len(candidate) < 60:
            party = candidate
            h = h[:m_paren.start()].strip()

    tokens = h.split()
    role = None
    name_tokens = tokens[:]

    if tokens:
        m_role = ROLE_PREFIX_RE.match(tokens[0])
        if m_role:
            role = m_role.group(0)
            name_tokens = tokens[1:]

    # Partei als letztes Token ohne Klammern
    if name_tokens:
        last = name_tokens[-1]
        if PARTY_TOKEN_RE.match(last):
            if party:
                party = f"{party}; {last}"
            else:
                party = last
            name_tokens = name_tokens[:-1]

    name = " ".join(name_tokens).strip() or None

    return {
        "raw": h,
        "role": role,
        "name": name,
        "party": party,
        "normalized": None,            # Platzhalter für spätere Normalisierung
        "parliament_function": None    # z. B. Ausschussvorsitz, falls extrahiert
    }


# -----------------------------------------------------------
# Optional: Test / Demo (kannst du entfernen oder guarden)
# -----------------------------------------------------------
if __name__ == "__main__":
    demo = [
        {"page": 1, "line_index": 0, "text": "Präsidentin Muhterem Aras:"},
        {"page": 1, "line_index": 1, "text": "Guten Morgen, meine Damen und Herren."},
        {"page": 1, "line_index": 2, "text": "Abg. Dr. Erik Schweickert FDP/DVP:"},
        {"page": 1, "line_index": 3, "text": "Vielen Dank Frau Präsidentin."},
        {"page": 1, "line_index": 4, "text": "(Beifall bei der FDP/DVP und der CDU)"},
        {"page": 2, "line_index": 0, "text": "Präsidentin Muhterem Aras:"},
        {"page": 2, "line_index": 1, "text": "Ich erteile das Wort …"}
    ]
    result = segment_speeches(demo, capture_offsets=True, debug=True)
    import json
    print(json.dumps(result, ensure_ascii=False, indent=2))
