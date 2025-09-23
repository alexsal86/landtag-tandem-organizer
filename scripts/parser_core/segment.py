import re
import unicodedata
from typing import List, Dict, Any, Optional, Tuple, Union

"""
Rede-Segmentierung mit kompakten Interjektionen.

NEU (gegenüber letzter Version):
- Interjektionen werden (wenn compact_interjections=True) im Speech-Objekt nur noch so gespeichert:
    { "type": "interjection", "text": "...", "annotation_ref": <int> }
  (Optional: + "category", falls include_interjection_category=True)
- Ausführliche Positionsdaten (raw_start, raw_end) werden – falls externalize_interjection_offsets=True – in
  einem separaten Rückgabeobjekt interjection_offsets ausgegeben (Top-Level).
- raw_start / raw_end beziehen sich auf den zusammengesetzten Rede-Text (speech["text"]) – also auf
  denselben String, den ihr speichert. Sie können separat persistiert werden.
- Keine alten Felder wie raw, role_hint, speaker_hint, party_hint usw. mehr in den Speech-Annotations
  (stark verkleinertes JSON). Wer diese Infos braucht, kann sie bei Bedarf anreichern.

Rückgabeformat:
- Wenn externalize_interjection_offsets=False:
    -> List[Speech]
- Wenn externalize_interjection_offsets=True:
    -> Dict{
          "speeches": [...],
          "interjection_offsets": [
             {
               "annotation_ref": 7,
               "speech_index": 3,
               "raw_start": 842,
               "raw_end": 863,
               "page": 5,
               "line_index": 217
             },
             ...
          ]
       }

Parameter:
- capture_offsets: falls True, speichert weiterhin speech["lines"] mit char_start/char_end pro Body-Zeile
- compact_interjections: aktiviert kompaktes Schema (Default True)
- include_interjection_category: falls True, bleibt "category" Feld in jeder Annotation
- externalize_interjection_offsets: erzeugt separate Offsets-Liste
- fallback_inline_header: heuristische Erkennung neuer Header wenn Leerzeile/Absatz fehlt

Hinweis:
- Für Offsets der Interjektionen wird eine simple Heuristik verwendet:
  Wir suchen das Interjektions-Textstück (annotation text) innerhalb der zugehörigen Body-Zeile.
  Bei mehrfach gleichem Vorkommen wird der erste Treffer genommen.
"""

# -----------------------------------------------------------
# Regex-Grundlagen
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
    rf"^\s*(?P<role>{ROLE_PATTERN})\s+"
    rf"(?P<name_block>[^:\n]{{1,160}}?)"
    rf"(?:\s+(?P<party>{PARTY_PATTERN}))?\s*:",
    re.IGNORECASE
)

LINE_START_ROLE_RE = re.compile(rf"^\s*(?P<role>{ROLE_PATTERN})\b", re.IGNORECASE)
PARTY_ONLY_LINE_RE = re.compile(rf"^\s*(?P<party>{PARTY_PATTERN})\s*:\s*$", re.IGNORECASE)

EMBEDDED_ROLE_RE = re.compile(
    rf"(?P<role>{ROLE_PATTERN})\s+"
    rf"(?P<name_block>[^:\n]{{1,160}}?)"
    rf"(?:\s+(?P<party>{PARTY_PATTERN}))?\s*:",
    re.IGNORECASE
)

FALLBACK_ABG_INNER_RE = re.compile(
    rf"Abg\.\s+(?P<name>[^()–—\-:]{{2,120}}?)"
    rf"(?:\s+(?P<party>{PARTY_PATTERN}))?(?=$|[\s)–—\-])",
    re.IGNORECASE
)

ACADEMIC_TITLE_RE = re.compile(
    r"\b(?:Dr\.?|Prof\.?|Professor(?:in)?|Dipl\.-Ing\.?|Dipl\.-Kfm\.?|Mag\.?|BSc|MSc|LL\.M\.?|MBA|MdL)\b\.?",
    re.IGNORECASE
)
MULTI_SPACE_RE = re.compile(r"\s{2,}")
SEGMENT_SPLIT_RE = re.compile(r"\s[–—-]\s")

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
                     allow_abg_without_party: bool = True,
                     fallback_inline_header: bool = True,
                     compact_interjections: bool = True,
                     include_interjection_category: bool = False,
                     externalize_interjection_offsets: bool = False
                     ) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    speeches: List[Dict[str, Any]] = []
    # Wenn externalize_interjection_offsets=True sammeln wir hier Offsets
    interjection_offset_records: List[Dict[str, Any]] = []

    current: Optional[Dict[str, Any]] = None
    body_line_entries: List[Dict[str, Any]] = []
    speech_index = 0
    previous_speaker_signature: Optional[Tuple[str, str]] = None

    at_paragraph_start = True
    pending_header_first_line: Optional[Dict[str, Any]] = None
    first_speech_started = False
    paren_depth = 0

    # Globale laufende Referenzen für Interjektionen
    next_annotation_ref = 1

    # Temporäre Speicherung für Annotation-Metadaten zur späteren Offsets-Berechnung
    # pro Speech (ID -> Liste)
    pending_interjection_meta: Dict[int, List[Dict[str, Any]]] = {}

    def ensure_current(page_for_new: int):
        nonlocal current, speech_index
        if current is None:
            speech_index += 1
            current = _make_new_speech(speech_index, page_for_new, _empty_speaker(), False)
            pending_interjection_meta[current["index"]] = []

    def flush_current():
        nonlocal current, body_line_entries, speeches
        if current is None:
            body_line_entries.clear()
            return
        # Text zusammensetzen
        parts = []
        for entry in body_line_entries:
            t = entry["text"]
            parts.append(t)
        final_text = "\n".join(parts).rstrip("\n")

        # Berechne line offsets falls nötig (auch nötig für externe interjection offsets)
        line_offsets = _compute_offsets(body_line_entries) if (capture_offsets or externalize_interjection_offsets) else None
        if capture_offsets and line_offsets is not None:
            current["lines"] = line_offsets

        current["text"] = final_text
        current["end_page"] = current.get("end_page") or current["start_page"]
        current.setdefault("annotations", [])

        if externalize_interjection_offsets and compact_interjections:
            # Offsets für Interjektionen berechnen
            # Map (page,line_index) -> (line_text,char_start)
            line_map = {}
            if line_offsets is not None:
                for lo in line_offsets:
                    key = (lo["page"], lo["line_index"])
                    line_map[key] = {
                        "char_start": lo["char_start"],
                        "text": lo["text"]
                    }
            meta_list = pending_interjection_meta.get(current["index"], [])
            for meta in meta_list:
                key = (meta["page"], meta["line_index"])
                base = line_map.get(key)
                if not base:
                    raw_start = None
                    raw_end = None
                else:
                    # Finde Substring
                    sub = meta["text"]
                    line_text = base["text"]
                    local_pos = line_text.find(sub)
                    if local_pos == -1:
                        raw_start = None
                        raw_end = None
                    else:
                        raw_start = base["char_start"] + local_pos
                        raw_end = raw_start + len(sub)
                interjection_offset_records.append({
                    "annotation_ref": meta["annotation_ref"],
                    "speech_index": current["index"],
                    "raw_start": raw_start,
                    "raw_end": raw_end,
                    "page": meta["page"],
                    "line_index": meta["line_index"]
                })

        speeches.append(current)
        current = None
        body_line_entries.clear()

    for line_obj in flat_lines:
        raw_line = (line_obj.get("text") or "")
        raw_line = unicodedata.normalize("NFKC", raw_line)
        page = line_obj.get("page")
        line_idx = line_obj.get("line_index")
        bold_flag = _extract_bold_flag(line_obj)
        norm_line = raw_line.rstrip("\n\r")

        # Klammersegmente
        segments_in_paren, paren_depth = _parenthesis_segments(norm_line, paren_depth)

        # Leerzeile?
        if _is_effectively_blank(norm_line):
            if current is not None:
                body_line_entries.append({"page": page, "line_index": line_idx, "text": ""})
            at_paragraph_start = True
            if pending_header_first_line:
                ensure_current(pending_header_first_line["page"])
                body_line_entries.append({
                    "page": pending_header_first_line["page"],
                    "line_index": pending_header_first_line["line_index"],
                    "text": pending_header_first_line["text"]
                })
                pending_header_first_line = None
            continue

        # Multi-Line Header Abschluss?
        if pending_header_first_line:
            combined = _combine_multiline_header(pending_header_first_line["text"], norm_line)
            m_comb = HEADER_LINE_RE.match(combined)
            if m_comb and _accept_header_match(m_comb, allow_abg_without_party):
                if not (require_bold_for_header and pending_header_first_line.get("bold") is False):
                    flush_current()
                    speech_index += 1
                    speaker_meta = _speaker_meta_from_match(m_comb)
                    signature = (speaker_meta.get("role"), speaker_meta.get("name"))
                    continuation = (previous_speaker_signature == signature)
                    current = _make_new_speech(speech_index, pending_header_first_line["page"], speaker_meta, continuation)
                    pending_interjection_meta[current["index"]] = []
                    previous_speaker_signature = signature
                    first_speech_started = True
                    after = combined[m_comb.end():].strip()
                    if after:
                        body_line_entries.append({
                            "page": page,
                            "line_index": line_idx,
                            "text": after
                        })
                else:
                    ensure_current(pending_header_first_line["page"])
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
                # Interjektionen aus aktueller Zeile
                if segments_in_paren:
                    next_annotation_ref = _collect_interjections(
                        norm_line, segments_in_paren, current, page, line_idx,
                        next_annotation_ref, pending_interjection_meta, compact_interjections,
                        include_interjection_category
                    )
                continue
            else:
                # Kein vollständiger Header
                ensure_current(pending_header_first_line["page"])
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
                if segments_in_paren:
                    next_annotation_ref = _collect_interjections(
                        norm_line, segments_in_paren, current, page, line_idx,
                        next_annotation_ref, pending_interjection_meta, compact_interjections,
                        include_interjection_category
                    )
                continue

        # Erster Header?
        if not first_speech_started:
            m_first = HEADER_LINE_RE.match(norm_line)
            if m_first and _accept_header_match(m_first, allow_abg_without_party) and not _match_inside_parentheses(m_first, segments_in_paren):
                flush_current()
                speech_index += 1
                speaker_meta = _speaker_meta_from_match(m_first)
                current = _make_new_speech(speech_index, page, speaker_meta, False)
                pending_interjection_meta[current["index"]] = []
                previous_speaker_signature = (speaker_meta.get("role"), speaker_meta.get("name"))
                first_speech_started = True
                after = norm_line[m_first.end():].strip()
                if after:
                    body_line_entries.append({
                        "page": page,
                        "line_index": line_idx,
                        "text": after
                    })
                at_paragraph_start = False
                if segments_in_paren:
                    next_annotation_ref = _collect_interjections(
                        norm_line, segments_in_paren, current, page, line_idx,
                        next_annotation_ref, pending_interjection_meta, compact_interjections,
                        include_interjection_category
                    )
                continue
            if at_paragraph_start and LINE_START_ROLE_RE.match(norm_line) and ":" not in norm_line and not segments_in_paren:
                pending_header_first_line = {
                    "page": page,
                    "line_index": line_idx,
                    "text": norm_line.strip(),
                    "bold": bold_flag
                }
                at_paragraph_start = False
                continue

        # Regulärer Absatzanfang
        if at_paragraph_start:
            m = HEADER_LINE_RE.match(norm_line)
            if m and _accept_header_match(m, allow_abg_without_party) and not _match_inside_parentheses(m, segments_in_paren):
                if not (require_bold_for_header and bold_flag is False):
                    flush_current()
                    speech_index += 1
                    speaker_meta = _speaker_meta_from_match(m)
                    signature = (speaker_meta.get("role"), speaker_meta.get("name"))
                    continuation = (previous_speaker_signature == signature)
                    current = _make_new_speech(speech_index, page, speaker_meta, continuation)
                    pending_interjection_meta[current["index"]] = []
                    previous_speaker_signature = signature
                    first_speech_started = True
                    after = norm_line[m.end():].strip()
                    if after:
                        body_line_entries.append({
                            "page": page,
                            "line_index": line_idx,
                            "text": after
                        })
                    at_paragraph_start = False
                    if segments_in_paren:
                        next_annotation_ref = _collect_interjections(
                            norm_line, segments_in_paren, current, page, line_idx,
                            next_annotation_ref, pending_interjection_meta, compact_interjections,
                            include_interjection_category
                        )
                    continue
            if LINE_START_ROLE_RE.match(norm_line) and ":" not in norm_line and not segments_in_paren:
                pending_header_first_line = {
                    "page": page,
                    "line_index": line_idx,
                    "text": norm_line.strip(),
                    "bold": bold_flag
                }
                at_paragraph_start = False
                continue
            # Body
            ensure_current(page)
            body_line_entries.append({
                "page": page,
                "line_index": line_idx,
                "text": norm_line
            })
            at_paragraph_start = False
        else:
            # Absatz läuft
            if fallback_inline_header:
                m_inline = HEADER_LINE_RE.match(norm_line)
                if (m_inline and
                        _accept_header_match(m_inline, allow_abg_without_party) and
                        not _match_inside_parentheses(m_inline, segments_in_paren)):
                    flush_current()
                    speech_index += 1
                    speaker_meta = _speaker_meta_from_match(m_inline)
                    signature = (speaker_meta.get("role"), speaker_meta.get("name"))
                    continuation = (previous_speaker_signature == signature)
                    current = _make_new_speech(speech_index, page, speaker_meta, continuation)
                    pending_interjection_meta[current["index"]] = []
                    previous_speaker_signature = signature
                    after = norm_line[m_inline.end():].strip()
                    if after:
                        body_line_entries.append({
                            "page": page,
                            "line_index": line_idx,
                            "text": after
                        })
                    if segments_in_paren:
                        next_annotation_ref = _collect_interjections(
                            norm_line, segments_in_paren, current, page, line_idx,
                            next_annotation_ref, pending_interjection_meta, compact_interjections,
                            include_interjection_category
                        )
                    continue
            ensure_current(page)
            if page > current.get("end_page", page):
                current["end_page"] = page
            body_line_entries.append({
                "page": page,
                "line_index": line_idx,
                "text": norm_line
            })

        # Interjektionen
        if segments_in_paren and current is not None:
            next_annotation_ref = _collect_interjections(
                norm_line, segments_in_paren, current, page, line_idx,
                next_annotation_ref, pending_interjection_meta, compact_interjections,
                include_interjection_category
            )

    # Offener Multi-Line Header?
    if pending_header_first_line:
        ensure_current(pending_header_first_line["page"])
        body_line_entries.append({
            "page": pending_header_first_line["page"],
            "line_index": pending_header_first_line["line_index"],
            "text": pending_header_first_line["text"]
        })
        pending_header_first_line = None

    flush_current()

    if externalize_interjection_offsets:
        return {
            "speeches": speeches,
            "interjection_offsets": interjection_offset_records
        }
    return speeches

# -----------------------------------------------------------
# Interjektionen
# -----------------------------------------------------------

def _collect_interjections(line: str,
                           paren_segments: List[Tuple[int, int]],
                           current_speech: Optional[Dict[str, Any]],
                           page: int,
                           line_index: int,
                           next_annotation_ref: int,
                           pending_interjection_meta: Dict[int, List[Dict[str, Any]]],
                           compact: bool,
                           include_category: bool) -> int:
    if current_speech is None:
        return next_annotation_ref
    speech_idx = current_speech["index"]
    if speech_idx not in pending_interjection_meta:
        pending_interjection_meta[speech_idx] = []

    for seg_start, seg_end in paren_segments:
        seg_text = line[seg_start:seg_end]
        pieces = _split_parenthetical_segment(seg_text)
        for piece in pieces:
            cleaned = piece.strip()
            if not cleaned:
                continue

            # 1) Voller eingebetteter Sprecher (mit ':')
            emb = EMBEDDED_ROLE_RE.search(cleaned)
            if emb:
                # Der ganze 'cleaned' Block ist die Interjektion
                annotation_ref = next_annotation_ref
                next_annotation_ref += 1
                category = _classify_interjection(cleaned)
                ann_obj = {
                    "type": "interjection",
                    "text": cleaned,
                    "annotation_ref": annotation_ref
                }
                if include_category:
                    ann_obj["category"] = category
                current_speech["annotations"].append(ann_obj)
                # Meta für Offsets
                pending_interjection_meta[speech_idx].append({
                    "annotation_ref": annotation_ref,
                    "text": cleaned,
                    "page": page,
                    "line_index": line_index
                })

                # Rest hinter Match?
                tail = cleaned[emb.end():].strip()
                if tail:
                    cat_tail = _classify_interjection(tail)
                    annotation_ref = next_annotation_ref
                    next_annotation_ref += 1
                    tail_ann = {
                        "type": "interjection",
                        "text": tail,
                        "annotation_ref": annotation_ref
                    }
                    if include_category:
                        tail_ann["category"] = cat_tail
                    current_speech["annotations"].append(tail_ann)
                    pending_interjection_meta[speech_idx].append({
                        "annotation_ref": annotation_ref,
                        "text": tail,
                        "page": page,
                        "line_index": line_index
                    })
                continue

            # 2) Stichworte (Beifall / Zuruf / Heiterkeit / Lachen) oder Fallback Abg.-Muster
            lower = cleaned.lower()
            if any(k in lower for k in ("beifall", "applaus", "zuruf", "heiterkeit", "lachen")):
                annotation_ref = next_annotation_ref
                next_annotation_ref += 1
                category = _classify_interjection(cleaned)
                ann_obj = {
                    "type": "interjection",
                    "text": cleaned,
                    "annotation_ref": annotation_ref
                }
                if include_category:
                    ann_obj["category"] = category
                current_speech["annotations"].append(ann_obj)
                pending_interjection_meta[speech_idx].append({
                    "annotation_ref": annotation_ref,
                    "text": cleaned,
                    "page": page,
                    "line_index": line_index
                })
                continue
            # Sonst ignorieren
    return next_annotation_ref

def _split_parenthetical_segment(text: str) -> List[str]:
    return [p for p in SEGMENT_SPLIT_RE.split(text) if p]

# -----------------------------------------------------------
# Header / Speaker Hilfsfunktionen
# -----------------------------------------------------------

def _accept_header_match(m: re.Match, allow_abg_without_party: bool) -> bool:
    role = m.group("role")
    party = m.group("party")
    norm_role = _normalize_role(role)
    if norm_role == "Abg." and not allow_abg_without_party and not party:
        return False
    return True

def _combine_multiline_header(line1: str, line2: str) -> str:
    m_party_only = PARTY_ONLY_LINE_RE.match(line2)
    if m_party_only:
        return f"{line1} {m_party_only.group('party')}:"
    return f"{line1} {line2}"

def _speaker_meta_from_match(m: re.Match) -> Dict[str, Any]:
    role_raw = m.group("role")
    name_block = (m.group("name_block") or "").strip()
    party_raw = m.group("party")
    role_norm = _normalize_role(role_raw)
    name_clean = _strip_academic_titles(name_block)
    party_norm = _normalize_party_token(party_raw) if party_raw else None
    category = CATEGORY_BY_ROLE.get(role_norm)
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
    if r.lower().startswith("abgeordnete"):
        return "Abg."
    return r

def _match_inside_parentheses(m: re.Match, paren_segments: List[Tuple[int, int]]) -> bool:
    start, end = m.start(), m.end()
    for s, e in paren_segments:
        if start >= s and end <= e:
            return True
    return False

# -----------------------------------------------------------
# Parenthesis Handling
# -----------------------------------------------------------

def _parenthesis_segments(line: str, initial_depth: int) -> Tuple[List[Tuple[int, int]], int]:
    depth = initial_depth
    segments: List[Tuple[int, int]] = []
    seg_start = 0 if depth > 0 else None

    for i, ch in enumerate(line):
        if ch == "(":
            if depth == 0:
                seg_start = i
            depth += 1
        elif ch == ")":
            if depth > 0:
                depth -= 1
                if depth == 0 and seg_start is not None:
                    segments.append((seg_start, i + 1))
                    seg_start = None

    if depth > 0:
        if seg_start is None:
            seg_start = 0
        segments.append((seg_start, len(line)))
    return segments, depth

# -----------------------------------------------------------
# Normalisierung & Utilities
# -----------------------------------------------------------

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

def _is_effectively_blank(line: str) -> bool:
    return line.replace("\u00A0", "").replace("\ufeff", "").strip() == ""

# -----------------------------------------------------------
# Speech / Offsets
# -----------------------------------------------------------

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
        start = accum
        end = start + len(t)
        enriched.append({
            "page": entry["page"],
            "line_index": entry["line_index"],
            "text": t,
            "char_start": start,
            "char_end": end
        })
        accum = end + 1  # newline char
    return enriched

# -----------------------------------------------------------
# Klassifikation
# -----------------------------------------------------------

def _classify_interjection(raw: str) -> str:
    l = raw.lower()
    if "beifall" in l or "applaus" in l:
        return "applaus"
    if "zuruf" in l:
        return "zuruf"
    if "heiterkeit" in l or "lachen" in l:
        return "lachen"
    return "unklar"

# -----------------------------------------------------------
# Demo
# -----------------------------------------------------------

if __name__ == "__main__":
    demo = [
        {"page": 1, "line_index": 0, "text": "Protokoll"},
        {"page": 1, "line_index": 1, "text": "Beginn: 9:02 Uhr"},
        {"page": 1, "line_index": 2, "text": "Präsidentin Muhterem Aras: Guten Morgen!"},
        {"page": 1, "line_index": 3, "text": "Ich eröffne die Sitzung."},
        {"page": 1, "line_index": 4, "text": ""},
        {"page": 1, "line_index": 5, "text": "Abg. Dr. Rainer Balzer"},
        {"page": 1, "line_index": 6, "text": "AfD:"},
        {"page": 1, "line_index": 7, "text": "Sehr geehrte Frau Präsidentin ..."},
        {"page": 1, "line_index": 8, "text": "(Beifall bei der AfD – Zuruf von der AfD: Bravo! – Abg. Dr. Timm Kern FDP/DVP: Was für ein Unsinn! – Zuruf des Abg. Thomas Poreski GRÜNE)"},
        {"page": 1, "line_index": 9, "text": ""},
        {"page": 1, "line_index": 10, "text": "Abg. Max Mustermann FDP/DVP: Danke."},
        {"page": 1, "line_index": 11, "text": "Fortsetzung."},
        {"page": 1, "line_index": 12, "text": "(Heiterkeit und Zuruf)"},
    ]
    result = segment_speeches(
        demo,
        capture_offsets=True,
        externalize_interjection_offsets=True,
        include_interjection_category=True  # falls Kategorie behalten werden soll
    )
    import json
    print(json.dumps(result, ensure_ascii=False, indent=2))
