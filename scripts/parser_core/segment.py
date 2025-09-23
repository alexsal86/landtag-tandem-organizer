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
     "normalized": "Muhterem Aras",
     "parliament_function": "chair"
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
# Muster & Regex / Konfiguration
# -----------------------------------------------------------

# Reihenfolge so, dass längere / spezifischere Titel zuerst erkannt werden
ROLE_PREFIX_RE = re.compile(
    r"^(?:"
    r"Ministerpräsidentin?|Ministerpräsident|"
    r"Stellv\.\s*Präsidentin?|Stellv\.\s*Präsident|"
    r"Präsidentin|Präsident|"
    r"Staatssekretärin?|Staatssekretär|"
    r"Ministerin?|Minister|"
    r"Abg\.|Abgeordnete|Abgeordneter"
    r")$"
)

# Partei-Kürzel / Varianten – Plain Token (ohne Klammern)
PARTY_TOKEN_RE = re.compile(
    r"^(AfD|CDU|SPD|FDP\/DVP|FDP|GRÜNE|GRUENE|B90\/GRÜNE|BÜNDNIS|BÜNDNIS90\/DIEGRÜNEN|"
    r"BÜNDNIS\s*90\/DIE\s*GRÜNEN|FREIE\s*WÄHLER|FW|LINKE|DIE\s+LINKE|fraktionslos)$",
    re.IGNORECASE
)

PAREN_PARTY_RE = re.compile(r"\(([^()]{2,60})\)")
MULTI_SPACE_RE = re.compile(r"\s{2,}")
ALL_CAPS_NAME_RE = re.compile(r"^[A-ZÄÖÜẞ][A-ZÄÖÜẞ\- ']{2,}$")
TRAILING_COLON_RE = re.compile(r":\s*$")
ACADEMIC_TITLE_RE = re.compile(
    r"\b(?:Dr\.?|Prof\.?|Professor(?:in)?|Dipl\.-Ing\.?|Dipl\.-Kfm\.?|Mag\.|BSc|MSc|LL\.M\.|MBA|MdL)\b\.?",
    re.IGNORECASE
)

# Zeilen, die wir ignorieren wollen (Kopfzeilen, Artefakte)
INLINE_PAGE_BREAK_MARKERS = [
    "Landtag von Baden-Württemberg",
]

# Kategorien
CATEGORY_BY_ROLE = {
    "Präsident": "chair",
    "Präsidentin": "chair",
    "Stellv. Präsident": "chair",
    "Stellv. Präsidentin": "chair",
    "Ministerpräsident": "government",
    "Ministerpräsidentin": "government",
    "Minister": "government",
    "Ministerin": "government",
    "Staatssekretär": "government",
    "Staatssekretärin": "government",
    "Abg.": "member",
    "Abgeordnete": "member",
    "Abgeordneter": "member"
}

# Heuristik für „Fortsetzung desselben Sprechers“
SAME_SPEAKER_ROLES_FOR_CONTINUATION = {
    "Abg.", "Abgeordneter", "Abgeordnete",
    "Präsident", "Präsidentin", "Stellv. Präsident", "Stellv. Präsidentin",
    "Ministerpräsident", "Ministerpräsidentin",
    "Minister", "Ministerin",
    "Staatssekretär", "Staatssekretärin"
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
    """
    speeches: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    body_line_entries: List[Dict[str, Any]] = []
    pending_speaker_lines: List[Dict[str, Any]] = []
    speech_index = 0
    previous_speaker_signature: Optional[Tuple[str, str]] = None  # (role, name)

    def flush_current():
        nonlocal current, body_line_entries, speeches
        if current is None:
            body_line_entries = []
            return
        text_parts = []
        for entry in body_line_entries:
            line_text = entry["text"]
            if line_text.strip():
                text_parts.append(line_text)
            else:
                text_parts.append("")
        final_text = "\n".join(text_parts).strip("\n")

        if capture_offsets:
            enriched_lines = []
            accum = 0
            for entry in body_line_entries:
                t = entry["text"]
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
                    accum += 1  # newline
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
        raw_line = line_obj.get("text", "") or ""
        page = line_obj.get("page")
        line_index = line_obj.get("line_index")
        norm_line = raw_line.rstrip()

        if not norm_line.strip():
            if current is not None:
                body_line_entries.append({"page": page, "line_index": line_index, "text": ""})
            continue

        # Kopf-/Seitentrennermarker
        if any(norm_line.startswith(m) for m in INLINE_PAGE_BREAK_MARKERS):
            continue

        is_header_candidate = _looks_like_speaker_line(norm_line)

        if is_header_candidate:
            # Sammeln für Multi-Line
            pending_speaker_lines.append({
                "page": page,
                "line_index": line_index,
                "text": norm_line
            })

            # Fail-safe: nach 3 Zeilen ohne Doppelpunkt abbrechen -> Body
            if len(pending_speaker_lines) >= 3 and not norm_line.endswith(":"):
                # In Body umwandeln
                if current is None:
                    speech_index += 1
                    pl0 = pending_speaker_lines[0]
                    current = {
                        "index": speech_index,
                        "start_page": pl0["page"],
                        "end_page": pl0["page"],
                        "speaker": _empty_speaker(),
                        "continuation": False
                    }
                for pl in pending_speaker_lines:
                    body_line_entries.append({
                        "page": pl["page"],
                        "line_index": pl["line_index"],
                        "text": pl["text"]
                    })
                pending_speaker_lines.clear()
                continue

            # Kompletter Header?
            if norm_line.endswith(":"):
                full_header_text = _merge_speaker_header([p["text"] for p in pending_speaker_lines])
                header_page = pending_speaker_lines[0]["page"]

                # Alte Rede abschließen
                flush_current()
                speech_index += 1
                speaker_meta = _parse_speaker_header(full_header_text)

                # Continuation?
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
                # Weitere Headerzeile sammeln
                continue
        else:
            # Bisher gesammelte Header-Zeilen waren wohl falsch
            if pending_speaker_lines:
                if current is None:
                    speech_index += 1
                    pl0 = pending_speaker_lines[0]
                    current = {
                        "index": speech_index,
                        "start_page": pl0["page"],
                        "end_page": pl0["page"],
                        "speaker": _empty_speaker(),
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
                speech_index += 1
                current = {
                    "index": speech_index,
                    "start_page": page,
                    "end_page": page,
                    "speaker": _empty_speaker(),
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

    # Offene Header-Zeilen am Ende → als Body behandeln
    if pending_speaker_lines:
        if current is None:
            speech_index += 1
            pl0 = pending_speaker_lines[0]
            current = {
                "index": speech_index,
                "start_page": pl0["page"],
                "end_page": pl0["page"],
                "speaker": _empty_speaker(),
                "continuation": False
            }
        for pl in pending_speaker_lines:
            body_line_entries.append({
                "page": pl["page"],
                "line_index": pl["line_index"],
                "text": pl["text"]
            })
        pending_speaker_lines.clear()

    flush_current()
    return speeches

# -----------------------------------------------------------
# Hilfsfunktionen
# -----------------------------------------------------------

def _empty_speaker() -> Dict[str, Any]:
    return {
        "raw": None,
        "name": None,
        "role": None,
        "party": None,
        "normalized": None,
        "parliament_function": None
    }

def _looks_like_speaker_line(line: str) -> bool:
    """
    Verschärfte Heuristik: akzeptiert nur glaubhafte Rollenanfänge
    und typische Formatierungen (Rolle + Name + optional Partei + ':').
    """
    stripped = line.strip()
    if not stripped:
        return False

    # Potenzieller Header muss Doppelpunkt haben oder eine Rolle führen
    has_colon = stripped.endswith(":")
    tokens = stripped.replace(":", "").split()
    if not tokens:
        return False

    first = tokens[0]
    first_is_role = bool(ROLE_PREFIX_RE.match(first))

    # Direkter Rollenstart
    if first_is_role and (has_colon or len(tokens) >= 1):
        return True

    # All-Caps Name mit ":" (seltener Fall)
    if has_colon and ALL_CAPS_NAME_RE.match(stripped[:-1].strip()):
        return True

    # Partei in Klammern + ":" irgendwo
    if has_colon and "(" in stripped and ")" in stripped:
        return True

    # Multi-Line Beginn: Rolle irgendwo in Zeile, aber noch kein ":" → sammeln
    if not has_colon and any(ROLE_PREFIX_RE.match(tok) for tok in tokens):
        return True

    # Kurze Ein-Wort + ":" nur akzeptieren, wenn Wort Rolle ist (z. B. "Präsidentin:")
    if has_colon and len(tokens) <= 2 and first_is_role:
        return True

    return False

def _merge_speaker_header(lines: List[str]) -> str:
    raw = " ".join(l.strip() for l in lines)
    raw = MULTI_SPACE_RE.sub(" ", raw)
    return raw

def _normalize_party_token(tok: str) -> Optional[str]:
    t = tok.strip()
    upper = t.upper().replace("\u00A0", " ")
    upper_compact = re.sub(r"\s+", "", upper)
    mapping = {
        "GRUENE": "GRÜNE",
        "B90/GRÜNE": "GRÜNE",
        "BÜNDNIS": "BÜNDNIS 90/DIE GRÜNEN",
        "BÜNDNIS90/DIEGRÜNEN": "BÜNDNIS 90/DIE GRÜNEN",
        "BÜNDNIS90/DIEGRÜNEN": "BÜNDNIS 90/DIE GRÜNEN",
        "BÜNDNIS90/DIEGRUENEN": "BÜNDNIS 90/DIE GRÜNEN"
    }
    if upper_compact in mapping:
        return mapping[upper_compact]
    # FDP/DVP unverändert
    if upper_compact == "FDP/DVP":
        return "FDP/DVP"
    if upper_compact == "FDP":
        return "FDP"
    if upper_compact == "AFD":
        return "AfD"
    if upper_compact == "CDU":
        return "CDU"
    if upper_compact == "SPD":
        return "SPD"
    if upper_compact == "GRÜNE":
        return "GRÜNE"
    if upper_compact in ("LINKE", "DIELINKE"):
        return "DIE LINKE"
    if upper_compact in ("FRSAKTIONSLOS", "FRAKTIONSLOS", "FRAKTIONSLOS"):
        return "fraktionslos"
    if upper_compact in ("FW", "FREIEWÄHLER", "FREIEWAHLER"):
        return "Freie Wähler"
    return t

def _strip_academic_titles(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    cleaned = ACADEMIC_TITLE_RE.sub("", name)
    cleaned = MULTI_SPACE_RE.sub(" ", cleaned).strip()
    return cleaned or name

def _parse_speaker_header(header: str) -> Dict[str, Any]:
    h = header.strip()
    if h.endswith(":"):
        h = h[:-1].strip()

    # Partei(en) in Klammern extrahieren (alle Vorkommen – selten mehrere)
    parties_found: List[str] = []
    def _paren_repl(m):
        parties_found.append(m.group(1).strip())
        return ""
    h_no_paren = PAREN_PARTY_RE.sub(_paren_repl, h).strip()

    tokens = h_no_paren.split()
    role = None
    name_tokens = tokens[:]

    if tokens and ROLE_PREFIX_RE.match(tokens[0]):
        role = tokens[0]
        name_tokens = tokens[1:]

    # Plain Partei am Ende
    if name_tokens:
        last = name_tokens[-1]
        if PARTY_TOKEN_RE.match(last):
            parties_found.append(last)
            name_tokens = name_tokens[:-1]

    # Name zusammensetzen
    name = " ".join(name_tokens).strip() or None
    normalized_name = _strip_academic_titles(name)

    # Parteien normalisieren und deduplizieren
    norm_parties: List[str] = []
    for p in parties_found:
        # Split bei ; oder / nicht blind – nur wenn im Pattern
        parts = [pp.strip() for pp in re.split(r"[;]", p) if pp.strip()]
        for part in parts:
            np = _normalize_party_token(part)
            if np and np not in norm_parties:
                norm_parties.append(np)
    party = "; ".join(norm_parties) if norm_parties else None

    category = CATEGORY_BY_ROLE.get(role)

    return {
        "raw": h.strip(),
        "role": role,
        "name": name,
        "party": party,
        "normalized": normalized_name,
        "parliament_function": category
    }

# -----------------------------------------------------------
# Optional: Demo
# -----------------------------------------------------------
if __name__ == "__main__":
    demo = [
        {"page": 1, "line_index": 0, "text": "Präsidentin Muhterem Aras:"},
        {"page": 1, "line_index": 1, "text": "Guten Morgen, meine Damen und Herren."},
        {"page": 1, "line_index": 2, "text": "Abg. Dr. Erik Schweickert FDP/DVP:"},
        {"page": 1, "line_index": 3, "text": "Vielen Dank Frau Präsidentin."},
        {"page": 1, "line_index": 4, "text": "(Beifall bei der FDP/DVP und der CDU)"},
        {"page": 2, "line_index": 0, "text": "Stellv. Präsident Karl Beispiel:"},
        {"page": 2, "line_index": 1, "text": "Ich erteile das Wort …"},
        {"page": 2, "line_index": 2, "text": "Ministerpräsident Winfried Kretschmann:"},
        {"page": 2, "line_index": 3, "text": "Sehr geehrtes Präsidium, meine Damen und Herren."},
        {"page": 3, "line_index": 0, "text": "Abg. Dr. Anna"},
        {"page": 3, "line_index": 1, "text": "Beispielmann GRÜNE:"},
        {"page": 3, "line_index": 2, "text": "Ich möchte Folgendes ausführen."},
        {"page": 4, "line_index": 0, "text": "Danke:"},  # False positive vermeiden
        {"page": 4, "line_index": 1, "text": "Das war kein Header."}
    ]
    result = segment_speeches(demo, capture_offsets=True, debug=True)
    import json
    print(json.dumps(result, ensure_ascii=False, indent=2))
