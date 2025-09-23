import re
import unicodedata
from typing import List, Dict, Any, Optional, Tuple

"""
Rede-Segmentierung (vereinfachte, robuste Version)

Änderungen / Features dieser Version:
- Einfache Absatz-Regel: Neue Rede nur am Absatzanfang (oder erster gefundener Header).
- Erster Header (Rolle + Name + :) wird auch ohne vorausgehende Leerzeile erkannt (Frontmatter wird übersprungen).
- Multi-Line-Header:
    Zeile 1 beginnt mit Rolle (kein ":"), Zeile 2 ergänzt Doppelpunkt (oder Partei + ":").
- Führende Whitespaces (inkl. NBSP) erlaubt vor Headern.
- Fallback: Falls versehentlich keine Leerzeile vorhanden war und ein klarer Header mitten im Absatz auftaucht
  (fallback_inline_header=True) → neue Rede, sofern NICHT innerhalb von Klammern.
- Geklammerter Bereich (runde Klammern) wird über Zeilengrenzen mittels paren_depth verfolgt.
  ALLES was innerhalb offener Klammern detected wird (auch über mehrere Zeilen) kann Interjektionen enthalten,
  startet aber KEINE neue Rede.
- Interjektionen: Vereinheitlichte, minimalistische Struktur:
    {
      "type": "interjection",
      "raw": "...",
      "speaker_hint": "...",   # optional
      "role_hint": "Abg."|...  # optional
      "party_hint": "...",     # optional
      "category": "applaus" | "zuruf" | "lachen" | "unklar",
      "source_page": int,
      "source_line_index": int
    }
  Keine raw_start/raw_end/context_before/context_after/sequence_index mehr.
- Interjektionsextraktion innerhalb Klammern:
    * Segmentierung an ' – ', ' — ', ' - ' (Gedanken- / Halbgeviertstriche)
    * Erkennung von:
        - Vollen Sprecherfragmenten mit Rolle+Name(+Partei)+':'
        - 'Zuruf ...' Varianten (mit oder ohne Abg. / Partei / Doppelpunkt)
        - 'Beifall', 'Applaus', 'Heiterkeit', 'Lachen'
        - Falls in 'Zuruf ...' ein 'Abg.' + Name + Partei vorkommt ohne Doppelpunkt → trotzdem speaker_hint
- Kategorien:
    applaus  -> wenn 'beifall' oder 'applaus'
    zuruf    -> wenn 'zuruf'
    lachen   -> wenn 'heiterkeit' oder 'lachen'
    unklar   -> sonst

Konfigurierbare Parameter:
- capture_offsets (Body-Zeilen Offsets)
- debug
- require_bold_for_header
- allow_abg_without_party
- fallback_inline_header (siehe oben)

WICHTIG: Parser erwartet Zeilenobjekte mit mindestens:
  { "page": int, "line_index": int, "text": str, (optional) bold/is_bold/font_weight }
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

# Einzeiliger Header (Zeilenanfang)
HEADER_LINE_RE = re.compile(
    rf"^\s*(?P<role>{ROLE_PATTERN})\s+"
    rf"(?P<name_block>[^:\n]{{1,160}}?)"
    rf"(?:\s+(?P<party>{PARTY_PATTERN}))?\s*:",
    re.IGNORECASE
)

# Für Multi-Line Start (erste Zeile ohne ':')
LINE_START_ROLE_RE = re.compile(rf"^\s*(?P<role>{ROLE_PATTERN})\b", re.IGNORECASE)

# Partei-eigene Folgezeile (nur Partei + ':')
PARTY_ONLY_LINE_RE = re.compile(rf"^\s*(?P<party>{PARTY_PATTERN})\s*:\s*$", re.IGNORECASE)

# Eingebettete Sprecherfragmente innerhalb Klammern (ohne Zeilenanker)
EMBEDDED_ROLE_RE = re.compile(
    rf"(?P<role>{ROLE_PATTERN})\s+"
    rf"(?P<name_block>[^:\n]{{1,160}}?)"
    rf"(?:\s+(?P<party>{PARTY_PATTERN}))?\s*:",
    re.IGNORECASE
)

# Fallback "Abg. Name Partei" ohne Doppelpunkt (z.B. in 'Zuruf des Abg. ...')
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

# Interjektion Segment Separator (Gedanken-/Halbgeviertstriche + normaler Bindestrich umgeben von Spaces)
SEGMENT_SPLIT_RE = re.compile(r"\s[–—-]\s")

# -----------------------------------------------------------
# Öffentliche Hauptfunktion
# -----------------------------------------------------------

def segment_speeches(flat_lines: List[Dict[str, Any]],
                     capture_offsets: bool = False,
                     debug: bool = False,
                     require_bold_for_header: bool = False,
                     allow_abg_without_party: bool = True,
                     fallback_inline_header: bool = True) -> List[Dict[str, Any]]:
    speeches: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    body_line_entries: List[Dict[str, Any]] = []
    speech_index = 0
    previous_speaker_signature: Optional[Tuple[str, str]] = None

    at_paragraph_start = True
    pending_header_first_line: Optional[Dict[str, Any]] = None
    first_speech_started = False

    # Parenthesis / Klammer-Depth über Zeilen
    paren_depth = 0  # depth > 0 => innerhalb eines offenen Klammerblocks
    # Für Debug sammeln wir optional Zeileninfos
    if debug:
        debug_events = []

    def flush_current():
        nonlocal current, body_line_entries, speeches
        if current is None:
            body_line_entries.clear()
            return
        parts = []
        for entry in body_line_entries:
            txt = entry["text"]
            if txt.strip():
                parts.append(txt)
            else:
                parts.append("")  # Leerzeilen erhalten
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
        raw_line = unicodedata.normalize("NFKC", raw_line)
        page = line_obj.get("page")
        line_idx = line_obj.get("line_index")
        bold_flag = _extract_bold_flag(line_obj)
        norm_line = raw_line.rstrip("\n\r")

        # Bestimme Klammersegmente dieser Zeile
        segments_in_paren, paren_depth = _parenthesis_segments(norm_line, paren_depth)
        inside_any_parentheses = paren_depth > 0 or bool(segments_in_paren)

        # Leerzeilen (auch NBSP) -> Absatzgrenze
        if _is_effectively_blank(norm_line):
            if current is not None:
                body_line_entries.append({"page": page, "line_index": line_idx, "text": ""})
            at_paragraph_start = True
            if pending_header_first_line:
                # Unvollendeter Multi-Line Header -> Body
                if current is None:
                    speech_index += 1
                    current = _make_new_speech(
                        speech_index,
                        pending_header_first_line["page"],
                        _empty_speaker(),
                        False
                    )
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
            # Partei-folgt-Zeile könnte nur Partei + ":" enthalten
            m_comb = HEADER_LINE_RE.match(combined)
            if m_comb and _accept_header_match(m_comb, allow_abg_without_party):
                if not (require_bold_for_header and pending_header_first_line.get("bold") is False):
                    flush_current()
                    speech_index += 1
                    speaker_meta = _speaker_meta_from_match(m_comb)
                    signature = (speaker_meta.get("role"), speaker_meta.get("name"))
                    continuation = (previous_speaker_signature == signature)
                    current = _make_new_speech(
                        speech_index,
                        pending_header_first_line["page"],
                        speaker_meta,
                        continuation
                    )
                    previous_speaker_signature = signature
                    first_speech_started = True
                    after = combined[m_comb.end():].strip()
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
                else:
                    # Bold gefordert aber nicht vorhanden -> alles Body
                    if current is None:
                        speech_index += 1
                        current = _make_new_speech(speech_index, pending_header_first_line["page"], _empty_speaker(), False)
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
                # Interjektionen (Klammern) trotzdem extrahieren
                if segments_in_paren:
                    _collect_interjections(norm_line, segments_in_paren, current, page, line_idx)
                continue
            else:
                # Kein vollständiger Header -> Body beider Zeilen
                if current is None:
                    speech_index += 1
                    current = _make_new_speech(speech_index, pending_header_first_line["page"], _empty_speaker(), False)
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
                    _collect_interjections(norm_line, segments_in_paren, current, page, line_idx)
                continue

        # Früherkennung erster Header (Frontmatter überspringen)
        if not first_speech_started:
            m_first = HEADER_LINE_RE.match(norm_line)
            if m_first and _accept_header_match(m_first, allow_abg_without_party) and not _match_inside_parentheses(m_first, segments_in_paren):
                # Bold-Anforderung am Start sehr häufig optional tolerieren
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
                at_paragraph_start = False
                if debug:
                    current.setdefault("debug", {})
                    current["debug"]["origin"] = "first_header"
                if segments_in_paren:
                    _collect_interjections(norm_line, segments_in_paren, current, page, line_idx)
                continue
            # Multi-Line Start vor erster Rede
            if at_paragraph_start and LINE_START_ROLE_RE.match(norm_line) and ":" not in norm_line and not inside_any_parentheses:
                pending_header_first_line = {
                    "page": page,
                    "line_index": line_idx,
                    "text": norm_line.strip(),
                    "bold": bold_flag
                }
                at_paragraph_start = False
                if segments_in_paren:
                    _collect_interjections(norm_line, segments_in_paren, current, page, line_idx)
                continue

        # Regulärer Absatzbeginn (nach erster Rede)
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
                    if debug:
                        current.setdefault("debug", {})
                        current["debug"]["origin"] = "singleline_header"
                    if segments_in_paren:
                        _collect_interjections(norm_line, segments_in_paren, current, page, line_idx)
                    continue
            if LINE_START_ROLE_RE.match(norm_line) and ":" not in norm_line and not inside_any_parentheses:
                pending_header_first_line = {
                    "page": page,
                    "line_index": line_idx,
                    "text": norm_line.strip(),
                    "bold": bold_flag
                }
                at_paragraph_start = False
                if segments_in_paren:
                    _collect_interjections(norm_line, segments_in_paren, current, page, line_idx)
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
            # Innerhalb Absatz
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
                    previous_speaker_signature = signature
                    after = norm_line[m_inline.end():].strip()
                    if after:
                        body_line_entries.append({
                            "page": page,
                            "line_index": line_idx,
                            "text": after
                        })
                    if debug:
                        current.setdefault("debug", {})
                        current["debug"]["origin"] = "fallback_inline_header"
                    if segments_in_paren:
                        _collect_interjections(norm_line, segments_in_paren, current, page, line_idx)
                    continue

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

        # Interjektionen sammeln (nur sinnvoll falls es Klammersegmente gibt)
        if segments_in_paren:
            _collect_interjections(norm_line, segments_in_paren, current, page, line_idx)

    # Offener Multi-Line Header ohne Abschluss -> Body
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
# Klammer-Handling / Interjektionen
# -----------------------------------------------------------

def _parenthesis_segments(line: str, initial_depth: int) -> Tuple[List[Tuple[int, int]], int]:
    """
    Ermittelt Segmente innerhalb Klammern für diese Zeile.
    initial_depth gibt an, ob wir aus vorheriger Zeile bereits innerhalb einer Klammer waren.
    Rückgabe:
        segments: Liste (start, end) innerhalb der Zeile (end exklusiv)
        new_depth: Tiefe nach dieser Zeile (0 = geschlossen)
    Hinweis: Mehrfach verschachtelte Klammern werden als ein zusammenhängender Segmentbereich betrachtet.
    """
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
        # Offener Segmentrest bis Zeilenende
        if seg_start is None:
            seg_start = 0  # falls z. B. erst mitten in der Zeile '(' öffnete und nicht schloss
        segments.append((seg_start, len(line)))  # temporärer offener Bereich
    return segments, depth

def _collect_interjections(line: str,
                           paren_segments: List[Tuple[int, int]],
                           current_speech: Optional[Dict[str, Any]],
                           page: int,
                           line_idx: int):
    """
    Extrahiert Interjektionen aus den geklammerten Segmenten einer Zeile.
    Erzeugt mehrere Annotationen (type=interjection) direkt im current_speech.
    """
    if current_speech is None:
        return
    for seg_start, seg_end in paren_segments:
        segment_text = line[seg_start:seg_end]
        # In Teilstücke splitten an gedanklichen Trennstrichen
        pieces = _split_parenthetical_segment(segment_text)
        for piece in pieces:
            cleaned = piece.strip()
            if not cleaned:
                continue
            # 1) Versuche Sprecherfragment mit EMBEDDED_ROLE_RE
            emb_match = EMBEDDED_ROLE_RE.search(cleaned)
            if emb_match:
                role = _normalize_role(emb_match.group("role"))
                name_block = emb_match.group("name_block").strip()
                party_raw = emb_match.group("party")
                party_norm = _normalize_party_token(party_raw) if party_raw else None
                name_clean = _strip_academic_titles(name_block)
                raw_fragment = _cut_fragment_after_header(cleaned, emb_match)
                ann = _make_interjection_annotation(
                    raw_fragment,
                    role_hint=role,
                    speaker_hint=name_clean,
                    party_hint=party_norm,
                    page=page,
                    line_index=line_idx
                )
                current_speech["annotations"].append(ann)
                # Restlicher Text nach dem Header (falls existiert) als eigener piece?
                tail = cleaned[emb_match.end():].strip()
                if tail:
                    # tail könnte 'Bravo!' etc. sein → zuruf/applaus extrahieren
                    cat = _classify_interjection(tail)
                    if cat != "unklar":
                        current_speech["annotations"].append(_make_interjection_annotation(
                            tail, role_hint=None, speaker_hint=None, party_hint=None,
                            page=page, line_index=line_idx, category_override=cat
                        ))
                continue

            # 2) Fallback: 'Zuruf' / 'Beifall' / 'Heiterkeit' / 'Lachen'
            lowered = cleaned.lower()
            if any(k in lowered for k in ("beifall", "applaus", "zuruf", "heiterkeit", "lachen")):
                # Try fallback Abg pattern inside piece (ohne ':')
                fb = FALLBACK_ABG_INNER_RE.search(cleaned)
                speaker_hint = None
                party_hint = None
                role_hint = None
                if fb:
                    role_hint = "Abg."
                    name_clean = _strip_academic_titles(fb.group("name"))
                    speaker_hint = name_clean
                    if fb.group("party"):
                        party_hint = _normalize_party_token(fb.group("party"))
                ann = _make_interjection_annotation(
                    cleaned,
                    role_hint=role_hint,
                    speaker_hint=speaker_hint,
                    party_hint=party_hint,
                    page=page,
                    line_index=line_idx
                )
                current_speech["annotations"].append(ann)
                continue

            # 3) Sonst ignorieren (kein klarer Interjektionsinhalt)
            continue

def _split_parenthetical_segment(text: str) -> List[str]:
    """
    Teilt den geklammerten Segmenttext an Trennstrichen ' – ', ' — ', ' - '.
    Erhält die Reihenfolge.
    """
    parts = SEGMENT_SPLIT_RE.split(text)
    return [p for p in parts if p is not None]

def _cut_fragment_after_header(full_piece: str, match: re.Match) -> str:
    """
    Schneidet einen Sprecher-Header innerhalb eines Pieces so ab,
    dass header + unmittelbar folgende inhaltliche Worte (bis Segmentende) als raw bleiben.
    (Hier behalten wir standardmäßig das komplette Piece bei.)
    """
    return full_piece.strip()

# -----------------------------------------------------------
# Interjektionserzeugung & Klassifikation
# -----------------------------------------------------------

def _make_interjection_annotation(raw: str,
                                  role_hint: Optional[str],
                                  speaker_hint: Optional[str],
                                  party_hint: Optional[str],
                                  page: int,
                                  line_index: int,
                                  category_override: Optional[str] = None) -> Dict[str, Any]:
    category = category_override or _classify_interjection(raw)
    return {
        "type": "interjection",
        "raw": raw.strip(),
        "speaker_hint": speaker_hint,
        "role_hint": role_hint,
        "party_hint": party_hint,
        "category": category,
        "source_page": page,
        "source_line_index": line_index
    }

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
# Header / Speaker Hilfen
# -----------------------------------------------------------

def _accept_header_match(m: re.Match, allow_abg_without_party: bool) -> bool:
    role = m.group("role")
    party = m.group("party")
    norm_role = _normalize_role(role)
    if norm_role == "Abg." and not allow_abg_without_party and not party:
        return False
    return True

def _combine_multiline_header(line1: str, line2: str) -> str:
    """
    Kombiniert Zeile 1 + Zeile 2 für Multi-Line Header.
    Falls Zeile2 nur Partei + ':' → spezielles Zusammenführen.
    """
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
    if r.lower().startswith("abgeordnete"):
        return "Abg."
    return r

def _match_inside_parentheses(m: re.Match, paren_segments: List[Tuple[int, int]]) -> bool:
    """
    Prüft, ob ein Match vollständig innerhalb eines Klammersegments liegt.
    """
    start, end = m.start(), m.end()
    for s, e in paren_segments:
        if start >= s and end <= e:
            return True
    return False

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
# Speech Objekte & Offsets
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
            accum = end + 1  # newline
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
    demo_lines = [
        # Frontmatter
        {"page": 1, "line_index": 0, "text": "Protokoll"},
        {"page": 1, "line_index": 1, "text": "Beginn: 9:02 Uhr"},
        {"page": 1, "line_index": 2, "text": "Präsidentin Muhterem Aras: Guten Morgen, meine Damen und Herren!"},
        {"page": 1, "line_index": 3, "text": "Ich eröffne die 127. Sitzung des Landtags."},
        {"page": 1, "line_index": 4, "text": ""},
        # Split Header in zwei Zeilen (Name / Partei)
        {"page": 1, "line_index": 5, "text": "Abg. Dr. Rainer Balzer"},
        {"page": 1, "line_index": 6, "text": "AfD:"},
        {"page": 1, "line_index": 7, "text": "Sehr geehrte Frau Präsidentin, sehr geehrte Damen und Herren ..."},
        {"page": 1, "line_index": 8, "text": "(Beifall bei der AfD – Zuruf von der AfD: Bravo! – Abg. Dr. Timm Kern FDP/DVP: Was für ein Unsinn! – Zuruf des Abg. Thomas Poreski GRÜNE)"},
        {"page": 1, "line_index": 9, "text": ""},
        # Fallback inline header (keine Leerzeile davor)
        {"page": 1, "line_index": 10, "text": "Abg. Max Mustermann FDP/DVP: Danke."},
        {"page": 1, "line_index": 11, "text": "Weitere Sätze."},
        {"page": 1, "line_index": 12, "text": "(Heiterkeit und Zuruf)"},
        {"page": 1, "line_index": 13, "text": ""},
    ]
    speeches = segment_speeches(demo_lines, capture_offsets=True, debug=True)
    import json
    print(json.dumps(speeches, ensure_ascii=False, indent=2))
