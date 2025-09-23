import re
from typing import List, Dict, Any, Optional, Tuple

"""
Vereinfachte Segmentierung gemäß Absatzregel (aktualisierte Version mit Früherkennung
des ersten Headers auch ohne vorangehende Leerzeile).

Grundregel (unverändert):
- Neue Rede nur am Beginn eines Absatzes: Dokumentanfang oder nach mindestens einer Leerzeile.
- Ausnahme NEU: Der ALLERERSTE gültige Header (Rolle + Name + ":" / ggf. Multi-Line) startet die erste Rede
  auch dann, wenn keine Leerzeile davor stand (Frontmatter wird ignoriert).
- Multi-Line-Header: Zeile 1 beginnt mit Rolle, enthält keinen ":", Zeile 2 ergänzt ":" → zusammen Header.
- Keine Inline-Header-Segmentierung mitten im Absatz.
- Interjektionen (Abg. ...: ...) innerhalb von Klammern → Annotation, keine neue Rede.
- Partei bei Abg. optional (allow_abg_without_party=True Standard).
- Continuation-Flag bei wiederholtem (role, name).

Neu hinzugefügt:
- first_speech_started Logik
- Header-Früherkennung vor erster Rede auch ohne at_paragraph_start
"""

# -----------------------------------------------------------
# Rollen- & Partei-Definitionen / Regex
# -----------------------------------------------------------

ROLE_TOKENS = [
    r"Abg\.", r"Abgeordneter", r"Abgeordnete",
    r"Präsidentin", r"Präsident",
    r"Stellv\.\s*Präsidentin?", r"Stellv\.\s*Präsident",
    r"Ministerpräsidentin?", r"Ministerpräsident",
    r"Ministerin?", r"Minister",
    r"Staatssekretärin?", r"Staatssekretär"
]

PARTY_VARIANTS = [
    r"AfD", r"CDU", r"SPD", r"FDP/DVP", r"FDP",
    r"GRÜNE", r"GRUENE", r"B90/GRÜNE", r"BÜNDNIS(?:\s+90/DIE\s+GRÜNEN)?",
    r"LINKE", r"DIE\s+LINKE", r"Freie\s+Wähler", r"fraktionslos"
]

ROLE_PATTERN = "(?:" + "|".join(ROLE_TOKENS) + ")"
PARTY_PATTERN = "(?:" + "|".join(PARTY_VARIANTS) + ")"

HEADER_LINE_RE = re.compile(
    rf"^(?P<role>{ROLE_PATTERN})\s+"
    rf"(?P<name_block>(?:[^\n:()]|\((?!.*?:\))){{1,150}}?)"
    rf"(?:\s+(?P<party>{PARTY_PATTERN}))?\s*:"
)

LINE_START_ROLE_RE = re.compile(rf"^(?P<role>{ROLE_PATTERN})\b")

PAREN_INTERJECTION_RE = re.compile(
    r"Abg\.\s+([^:()]{2,120}?)(?:\s+(AfD|CDU|SPD|FDP/DVP|FDP|GRÜNE|GRUENE|B90/GRÜNE|BÜNDNIS\s+90/DIE\s+GRÜNEN|LINKE|DIE\s+LINKE|Freie\s+Wähler|fraktionslos))?:\s*([^()]*?)(?=$|[)–\-])",
    re.IGNORECASE
)

ACADEMIC_TITLE_RE = re.compile(
    r"\b(?:Dr\.?|Prof\.?|Professor(?:in)?|Dipl\.-Ing\.?|Dipl\.-Kfm\.?|Mag\.?|BSc|MSc|LL\.M\.?|MBA|MdL)\b\.?",
    re.IGNORECASE
)
MULTI_SPACE_RE = re.compile(r"\s{2,}")

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
    "Abgeordneter": "member",
    "Abgeordnete": "member"
}

# -----------------------------------------------------------
# Hauptfunktion
# -----------------------------------------------------------

def segment_speeches(flat_lines: List[Dict[str, Any]],
                     capture_offsets: bool = False,
                     debug: bool = False,
                     require_bold_for_header: bool = False,
                     allow_abg_without_party: bool = True) -> List[Dict[str, Any]]:
    speeches: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    body_line_entries: List[Dict[str, Any]] = []
    speech_index = 0
    previous_speaker_signature: Optional[Tuple[str, str]] = None

    at_paragraph_start = True
    pending_header_first_line: Optional[Dict[str, Any]] = None
    first_speech_started = False  # NEU

    def flush_current():
        nonlocal current, body_line_entries, speeches
        if current is None:
            body_line_entries.clear()
            return
        parts = []
        for entry in body_line_entries:
            t = entry["text"]
            if t.strip():
                parts.append(t)
            else:
                parts.append("")
        final_text = "\n".join(parts).strip("\n")
        if capture_offsets:
            current["lines"] = _compute_offsets(body_line_entries)
        current["text"] = final_text
        current["end_page"] = current.get("end_page") or current["start_page"]
        current.setdefault("annotations", [])
        speeches.append(current)
        current = None
        body_line_entries.clear()

    for line_obj in flat_lines:
        raw_line = (line_obj.get("text") or "")
        page = line_obj.get("page")
        line_idx = line_obj.get("line_index")
        bold_flag = _extract_bold_flag(line_obj)
        norm_line = raw_line.rstrip("\n\r")

        if not norm_line.strip():
            if current is not None:
                body_line_entries.append({"page": page, "line_index": line_idx, "text": ""})
            at_paragraph_start = True
            if pending_header_first_line:
                if current is None:
                    speech_index += 1
                    current = _make_new_speech(speech_index,
                                               pending_header_first_line["page"],
                                               _empty_speaker(), False)
                body_line_entries.append({
                    "page": pending_header_first_line["page"],
                    "line_index": pending_header_first_line["line_index"],
                    "text": pending_header_first_line["text"]
                })
                pending_header_first_line = None
            continue

        # Multi-Line Phase (zweite Zeile versucht Header abzuschließen)
        if pending_header_first_line:
            combined = f"{pending_header_first_line['text']} {norm_line}"
            if ":" in combined:
                m = HEADER_LINE_RE.match(combined)
                if m and _accept_header_match(m, allow_abg_without_party):
                    if require_bold_for_header and pending_header_first_line.get("bold") is False:
                        # Bold verlangt aber nicht vorhanden -> Body
                        if current is None:
                            speech_index += 1
                            current = _make_new_speech(speech_index,
                                                       pending_header_first_line["page"],
                                                       _empty_speaker(), False)
                        body_line_entries.append({
                            "page": pending_header_first_line["page"],
                            "line_index": pending_header_first_line["line_index"],
                            "text": pending_header_first_line["text"]
                        })
                        body_line_entries.append({
                            "page": page,
                            "line_index": line_idx,
                            "text": norm_line
                        })
                    else:
                        flush_current()
                        speech_index += 1
                        speaker_meta = _speaker_meta_from_match(m)
                        signature = (speaker_meta.get("role"), speaker_meta.get("name"))
                        continuation = (previous_speaker_signature == signature)
                        current = _make_new_speech(speech_index, pending_header_first_line["page"],
                                                   speaker_meta, continuation)
                        previous_speaker_signature = signature
                        first_speech_started = True
                        after = combined[m.end():].strip()
                        if after:
                            body_line_entries.append({
                                "page": page,
                                "line_index": line_idx,
                                "text": after
                            })
                        if debug:
                            current.setdefault("debug", {})
                            current["debug"]["origin"] = "multiline_header"
                            current["debug"]["lines"] = [pending_header_first_line["text"], norm_line]
                    pending_header_first_line = None
                    at_paragraph_start = False
                    continue
                else:
                    # Nicht akzeptiert -> Body
                    if current is None:
                        speech_index += 1
                        current = _make_new_speech(speech_index,
                                                   pending_header_first_line["page"],
                                                   _empty_speaker(), False)
                    body_line_entries.append({
                        "page": pending_header_first_line["page"],
                        "line_index": pending_header_first_line["line_index"],
                        "text": pending_header_first_line["text"]
                    })
                    body_line_entries.append({
                        "page": page,
                        "line_index": line_idx,
                        "text": norm_line
                    })
                    pending_header_first_line = None
                    at_paragraph_start = False
                    continue
            else:
                # Kein ":" → Body
                if current is None:
                    speech_index += 1
                    current = _make_new_speech(speech_index,
                                               pending_header_first_line["page"],
                                               _empty_speaker(), False)
                body_line_entries.append({
                    "page": pending_header_first_line["page"],
                    "line_index": pending_header_first_line["line_index"],
                    "text": pending_header_first_line["text"]
                })
                body_line_entries.append({
                    "page": page,
                    "line_index": line_idx,
                    "text": norm_line
                })
                pending_header_first_line = None
                at_paragraph_start = False
                continue

        # Früherkennung des ersten Headers (NEU):
        if not first_speech_started:
            m_first = HEADER_LINE_RE.match(norm_line)
            if m_first and _accept_header_match(m_first, allow_abg_without_party):
                # Bold-Pflicht?
                if require_bold_for_header and bold_flag is False:
                    # Als Body (falls du das lieber doch erzwingen willst, setze require_bold_for_header False)
                    if current is None:
                        speech_index += 1
                        current = _make_new_speech(speech_index, page, _empty_speaker(), False)
                    body_line_entries.append({
                        "page": page,
                        "line_index": line_idx,
                        "text": norm_line
                    })
                else:
                    flush_current()
                    speech_index += 1
                    speaker_meta = _speaker_meta_from_match(m_first)
                    signature = (speaker_meta.get("role"), speaker_meta.get("name"))
                    current = _make_new_speech(speech_index, page, speaker_meta, False)
                    previous_speaker_signature = signature
                    first_speech_started = True
                    after = norm_line[m_first.end():].strip()
                    if after:
                        body_line_entries.append({
                            "page": page,
                            "line_index": line_idx,
                            "text": after
                        })
                    if debug:
                        current.setdefault("debug", {})
                        current["debug"]["origin"] = "first_header_no_paragraph_break"
                        current["debug"]["bold_used"] = bold_flag
                at_paragraph_start = False
                continue
            # Multi-Line Start vor erster Rede
            if at_paragraph_start and LINE_START_ROLE_RE.match(norm_line) and ":" not in norm_line:
                # Bold-Pflicht beachten
                if require_bold_for_header and bold_flag is False:
                    # Kein Header -> Body
                    if current is None:
                        speech_index += 1
                        current = _make_new_speech(speech_index, page, _empty_speaker(), False)
                    body_line_entries.append({
                        "page": page,
                        "line_index": line_idx,
                        "text": norm_line
                    })
                else:
                    pending_header_first_line = {
                        "page": page,
                        "line_index": line_idx,
                        "text": norm_line,
                        "bold": bold_flag
                    }
                at_paragraph_start = False
                continue

        # Regulärer Absatzstart (für nachfolgende Reden)
        if at_paragraph_start:
            m = HEADER_LINE_RE.match(norm_line)
            header_accepted = False
            if m and _accept_header_match(m, allow_abg_without_party):
                if require_bold_for_header and bold_flag is False:
                    # Body
                    pass
                else:
                    flush_current()
                    speech_index += 1
                    speaker_meta = _speaker_meta_from_match(m)
                    signature = (speaker_meta.get("role"), speaker_meta.get("name"))
                    continuation = (previous_speaker_signature == signature)
                    current = _make_new_speech(speech_index, page, speaker_meta, continuation)
                    previous_speaker_signature = signature
                    first_speech_started = True
                    after = norm_line[m.end():].strip()
                    if after:
                        body_line_entries.append({
                            "page": page,
                            "line_index": line_idx,
                            "text": after
                        })
                    if debug:
                        current.setdefault("debug", {})
                        current["debug"]["origin"] = "singleline_header"
                    header_accepted = True
                    at_paragraph_start = False
            if header_accepted:
                continue

            # Multi-Line Start
            if LINE_START_ROLE_RE.match(norm_line) and ":" not in norm_line:
                if require_bold_for_header and bold_flag is False:
                    if current is None:
                        speech_index += 1
                        current = _make_new_speech(speech_index, page, _empty_speaker(), False)
                    body_line_entries.append({
                        "page": page,
                        "line_index": line_idx,
                        "text": norm_line
                    })
                else:
                    pending_header_first_line = {
                        "page": page,
                        "line_index": line_idx,
                        "text": norm_line,
                        "bold": bold_flag
                    }
                at_paragraph_start = False
                continue

            # Kein Header → Body
            if current is None:
                speech_index += 1
                current = _make_new_speech(speech_index, page, _empty_speaker(), False)
            body_line_entries.append({
                "page": page,
                "line_index": line_idx,
                "text": norm_line
            })
            at_paragraph_start = False

        else:
            # Innerhalb Absatz rein Body
            if current is None:
                speech_index += 1
                current = _make_new_speech(speech_index, page, _empty_speaker(), False)
            else:
                if page > current.get("end_page", page):
                    current["end_page"] = page
            body_line_entries.append({
                "page": page,
                "line_index": line_idx,
                "text": norm_line
            })

        # Interjektionen in Klammern
        if "(" in norm_line and ")" in norm_line and current is not None:
            for im in PAREN_INTERJECTION_RE.finditer(norm_line):
                raw_name = im.group(1).strip()
                party_raw = im.group(2)
                utterance = im.group(3).strip()
                ann = {
                    "type": "interjection",
                    "speaker_hint": _strip_academic_titles(raw_name),
                    "party_hint": _normalize_party_token(party_raw) if party_raw else None,
                    "text": utterance,
                    "source_line_index": line_idx,
                    "source_page": page
                }
                current.setdefault("annotations", []).append(ann)

    # Falls noch Multi-Line-Anfang ohne Abschluss
    if pending_header_first_line:
        if current is None:
            speech_index += 1
            current = _make_new_speech(speech_index,
                                       pending_header_first_line["page"],
                                       _empty_speaker(), False)
        body_line_entries.append({
            "page": pending_header_first_line["page"],
            "line_index": pending_header_first_line["line_index"],
            "text": pending_header_first_line["text"]
        })
        pending_header_first_line = None

    flush_current()
    return speeches

# -----------------------------------------------------------
# Hilfsfunktionen
# -----------------------------------------------------------

def _accept_header_match(m: re.Match, allow_abg_without_party: bool) -> bool:
    role = m.group("role")
    party = m.group("party")
    norm_role = _normalize_role(role)
    if norm_role == "Abg." and not allow_abg_without_party and not party:
        return False
    return True

def _speaker_meta_from_match(m: re.Match) -> Dict[str, Any]:
    role_raw = m.group("role")
    name_block = (m.group("name_block") or "").strip()
    party_raw = m.group("party")
    role_norm = _normalize_role(role_raw)
    name_clean = _strip_academic_titles(name_block)
    party_norm = _normalize_party_token(party_raw) if party_raw else None
    category = CATEGORY_BY_ROLE.get(role_norm, None)
    return {
        "raw": f"{role_raw} {name_block}".strip(),
        "role": role_norm,
        "name": name_clean,
        "party": party_norm,
        "normalized": name_clean,
        "parliament_function": category
    }

def _normalize_role(r: str) -> str:
    r = r.strip()
    if r in ("Abgeordneter", "Abgeordnete"):
        return "Abg."
    return r

def _normalize_party_token(tok: Optional[str]) -> Optional[str]:
    if not tok:
        return None
    t = tok.strip()
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
        "FRAKTIONSLOS": "fraktionslos"
    }
    if upper_compact in mapping:
        return mapping[upper_compact]
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
    if upper_compact == "FW":
        return "Freie Wähler"
    return t

def _strip_academic_titles(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    cleaned = ACADEMIC_TITLE_RE.sub("", name)
    cleaned = MULTI_SPACE_RE.sub(" ", cleaned)
    return cleaned.strip() or name

def _extract_bold_flag(line_obj: Dict[str, Any]) -> Optional[bool]:
    if "bold" in line_obj and isinstance(line_obj["bold"], bool):
        return line_obj["bold"]
    if "is_bold" in line_obj and isinstance(line_obj["is_bold"], bool):
        return line_obj["is_bold"]
    fw = line_obj.get("font_weight")
    if isinstance(fw, (int, float)):
        return fw >= 600
    return None

def _make_new_speech(index: int, page: int, speaker_meta: Dict[str, Any], continuation: bool) -> Dict[str, Any]:
    return {
        "index": index,
        "start_page": page,
        "end_page": page,
        "speaker": speaker_meta,
        "continuation": continuation,
        "annotations": []
    }

def _empty_speaker() -> Dict[str, Any]:
    return {
        "raw": None,
        "name": None,
        "role": None,
        "party": None,
        "normalized": None,
        "parliament_function": None
    }

def _compute_offsets(body_line_entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    enriched = []
    accum = 0
    for entry in body_line_entries:
        t = entry["text"]
        if t:
            start = accum
            end = start + len(t)
            enriched.append({
                "page": entry["page"],
                "line_index": entry["line_index"],
                "text": t,
                "char_start": start,
                "char_end": end
            })
            accum = end + 1
        else:
            enriched.append({
                "page": entry["page"],
                "line_index": entry["line_index"],
                "text": t,
                "char_start": accum,
                "char_end": accum
            })
            accum += 1
    return enriched

# -----------------------------------------------------------
# Demo
# -----------------------------------------------------------
if __name__ == "__main__":
    demo = [
        # Frontmatter ohne Leerzeilen dazwischen
        {"page": 1, "line_index": 0, "text": "Protokoll"},
        {"page": 1, "line_index": 1, "text": "über die 127. Sitzung vom 16. Juli 2025"},
        {"page": 1, "line_index": 2, "text": "Beginn: 9:02 Uhr"},
        {"page": 1, "line_index": 3, "text": "Präsidentin Muhterem Aras: Guten Morgen, meine Damen und Herren!"},
        {"page": 1, "line_index": 4, "text": "Ich eröffne die 127. Sitzung des 17. Landtags."},
        {"page": 1, "line_index": 5, "text": ""},
        {"page": 1, "line_index": 6, "text": "Abg. Dr. Rainer Balzer AfD: Sehr geehrte Frau Präsidentin,"},
        {"page": 1, "line_index": 7, "text": "sehr geehrte Damen und Herren ..."},
        {"page": 1, "line_index": 8, "text": "(Beifall bei der AfD)"},
    ]
    speeches = segment_speeches(demo, capture_offsets=True, debug=True)
    import json
    print(json.dumps(speeches, ensure_ascii=False, indent=2))
