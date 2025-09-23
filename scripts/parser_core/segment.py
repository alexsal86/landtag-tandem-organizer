import re
from typing import List, Dict, Any, Optional, Tuple, Iterable

"""
Segmentierung flacher Zeilen in Reden.

Aktuelle Version – vereinheitlichte Master-Regel für ALLE Rollen:

Grundprinzip:
- Ein Sprecher-Header liegt vor, wenn ein Muster
    <Rolle> <Name(+Titel...)> [<Partei>] :
  außerhalb von runden Klammern "()" vorkommt.
  -> startet eine neue Rede (Speech).
- Dasselbe Muster innerhalb von Klammern gilt als Interjektion (Zwischenruf) und startet KEINE neue Rede.
- Für Abgeordnete (Abg.) wird – wie ursprünglich gewünscht – die Partei standardmäßig erwartet.
  (Konfig: allow_abg_without_party=False kann gesetzt werden, falls nötig.)

Weitere Merkmale:
- Mehrere Headers in EINER Zeile werden sequentiell segmentiert (Inline-Header-Kaskade).
- Text, der zwischen zwei Headers liegt (auf derselben Zeile), wird als Body der vorherigen neuen Rede angehängt.
- Multi-Line-Header (Zeilenumbruch vor dem Doppelpunkt) werden unterstützt: Wenn eine Zeile mit Rolle beginnt,
  aber noch keinen ":", werden Zeilen gesammelt bis ein ":" erscheint; dann Verarbeitung wie normaler Header.
- Interjektionen:
  * Abgeordnete- oder andere Rollen-Muster innerhalb von Klammern -> Annotation type=interjection.
  * Zusätzlich generische eingebettete Muster "- Abg. ...: Ruf!" werden erkannt (falls außerhalb der Master-Regel).
- Partei- und Namens-Normalisierung (Entfernung akademischer Titel, Kanonisierung von Parteien)
- Optionaler Bold-Zwang für Header (require_bold_for_header) – gilt für alle Rollen, außer wir erzwingen explizit,
  dass Abg.-Header auch ohne Bold erkannt werden (config allow_header_without_bold_for_roles).
- Continuation-Heuristik: Wenn (role, name) identisch zum vorherigen Sprecher, wird continuation=True gesetzt.

Konfiguration (einfach im Funktionsaufruf anpassbar):
- require_bold_for_header: bool = False
- allow_abg_without_party: bool = False (Partei für Abg.-Header zwingend?)
- allow_header_without_bold_for_roles: Optional[set] – falls bestimmte Rollen Bold nicht benötigen (Default None => alle benötigen Bold falls require_bold_for_header=True)

Erwarteter Input flat_lines:
[
  {"page": 1, "line_index": 0, "text": "Präsidentin ...:"},
  ...
  (Optional) {"bold": True} oder {"font_weight": 700}
]

Ausgabe: Liste von Speech-Dicts:
{
  "index": 1,
  "start_page": 1,
  "end_page": 1,
  "speaker": {
      "raw": "Präsidentin Vorname Nachname",
      "role": "Präsidentin",
      "name": "Vorname Nachname",
      "party": None,
      "normalized": "Vorname Nachname",
      "parliament_function": "chair"
  },
  "text": "Rede ...",
  "annotations": [
      { "type": "interjection", "speaker_hint": "...", "party_hint": "...", "text": "...", ... }
  ],
  "continuation": False
}
"""

# -----------------------------------------------------------
# Rollen- & Partei-Definitionen
# -----------------------------------------------------------

ROLE_TOKENS = [
    r"Abg\.", r"Abgeordneter", r"Abgeordnete",
    r"Präsidentin", r"Präsident",
    r"Stellv\.\s*Präsidentin?", r"Stellv\.\s*Präsident",
    r"Ministerpräsidentin?", r"Ministerpräsident",
    r"Ministerin?", r"Minister",
    r"Staatssekretärin?", r"Staatssekretär"
]

# Partei Tokens (auch Varianten)
PARTY_TOKEN_VARIANTS = [
    r"AfD", r"CDU", r"SPD", r"FDP/DVP", r"FDP",
    r"GRÜNE", r"GRUENE", r"B90/GRÜNE", r"BÜNDNIS(?:\s+90/DIE\s+GRÜNEN)?",
    r"LINKE", r"DIE\s+LINKE", r"Freie\s+Wähler", r"fraktionslos"
]

ROLE_PATTERN = "(?:" + "|".join(ROLE_TOKENS) + ")"
PARTY_PATTERN = "(?:" + "|".join(PARTY_TOKEN_VARIANTS) + ")"

# MASTER HEADER REGEX:
# Rolle + mindestens ein Wort Nameblock (Titel/Name) + optional Partei + ":".
# Nameblock erlaubt breite Vielfalt, bricht vor dem optionalen Partei-Token und dem ":" ab.
MASTER_HEADER_RE = re.compile(
    rf"(?P<header>"
    rf"(?P<role>{ROLE_PATTERN})"
    rf"\s+"
    rf"(?P<name_block>(?:[^\s:()]|(?:\s(?!{PARTY_PATTERN}:))){{1,140}}?)"
    rf"(?:\s+(?P<party>{PARTY_PATTERN}))?"
    rf":)"
)

# Für Multi-Line: Zeile beginnt mit Rolle und kein ":" enthalten (oder ":" nicht nach Rolle)
LINE_START_ROLE_RE = re.compile(rf"^(?P<role>{ROLE_PATTERN})\b")

# Akademische Titel entfernen
ACADEMIC_TITLE_RE = re.compile(
    r"\b(?:Dr\.?|Prof\.?|Professor(?:in)?|Dipl\.-Ing\.?|Dipl\.-Kfm\.?|Mag\.?|BSc|MSc|LL\.M\.?|MBA|MdL)\b\.?",
    re.IGNORECASE
)

# Partei-Parsing in Klammern (für Nicht-Abg. optional)
PAREN_PARTY_RE = re.compile(r"\(([^()]{2,60})\)")
MULTI_SPACE_RE = re.compile(r"\s{2,}")
ALL_CAPS_NAME_RE = re.compile(r"^[A-ZÄÖÜẞ][A-ZÄÖÜẞ\- ']{2,}$")

# Generische eingebettete Interjektionen (z. B. "- Abg. ...: Sehr gut!")
EMBEDDED_INTERJECTION_RE = re.compile(
    r"(?:^|[\s(])[–\-]\s*(Abg\.\s+[^:]{2,120}?)(?:\s+"
    r"(AfD|CDU|SPD|FDP/DVP|FDP|GRÜNE|GRUENE|B90/GRÜNE|BÜNDNIS\s+90/DIE\s+GRÜNEN|LINKE|DIE\s+LINKE|Freie\s+Wähler|fraktionslos)"
    r")?:\s*([^()]*?)(?=[)\s]*$)",
    re.IGNORECASE
)

INLINE_PAGE_BREAK_MARKERS = [
    "Landtag von Baden-Württemberg",
]

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

SAME_SPEAKER_ROLES_FOR_CONTINUATION = set(CATEGORY_BY_ROLE.keys())

# Partei-Normalisierung
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
    if upper_compact in ("FDP/DVP",):
        return "FDP/DVP"
    if upper_compact in ("FDP",):
        return "FDP"
    if upper_compact in ("AFD",):
        return "AfD"
    if upper_compact in ("CDU",):
        return "CDU"
    if upper_compact in ("SPD",):
        return "SPD"
    if upper_compact in ("GRÜNE",):
        return "GRÜNE"
    if upper_compact in ("FW",):
        return "Freie Wähler"
    return t

def _strip_academic_titles(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    cleaned = ACADEMIC_TITLE_RE.sub("", name)
    cleaned = MULTI_SPACE_RE.sub(" ", cleaned)
    return cleaned.strip() or name

# -----------------------------------------------------------
# Public API
# -----------------------------------------------------------

def segment_speeches(flat_lines: List[Dict[str, Any]],
                     capture_offsets: bool = False,
                     debug: bool = False,
                     min_header_confidence: float = 0.5,
                     require_bold_for_header: bool = False,
                     allow_abg_without_party: bool = False,
                     allow_header_without_bold_for_roles: Optional[set] = None) -> List[Dict[str, Any]]:
    """
    Segmentiert flache Zeilen in Reden gemäß der vereinheitlichten Master-Regel.

    Parameter:
      capture_offsets: char_start/char_end für jede Body-Zeile speichern
      debug: zusätzliche Debug-Informationen
      require_bold_for_header: erzwingt Bold für Header-Erkennung (Ausnahme ggf. in allow_header_without_bold_for_roles)
      allow_abg_without_party: Abg.-Header auch ohne Partei akzeptieren? (Default False → Partei Pflicht)
      allow_header_without_bold_for_roles: Set von Rollen (genaue Rolle-Strings), die Bold nicht benötigen selbst wenn require_bold_for_header=True
    """
    speeches: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    body_line_entries: List[Dict[str, Any]] = []
    speech_index = 0
    previous_speaker_signature: Optional[Tuple[str, str]] = None

    # Multi-Line Pending (für Fälle: "Präsidentin Name" / nächste Zeile ":" etc.)
    pending_multiline: List[Dict[str, Any]] = []

    def flush_current():
        nonlocal current, body_line_entries, speeches
        if current is None:
            body_line_entries.clear()
            return
        text_parts: List[str] = []
        for entry in body_line_entries:
            if entry["text"].strip():
                text_parts.append(entry["text"])
            else:
                text_parts.append("")
        final_text = "\n".join(text_parts).strip("\n")

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
        norm_line = raw_line.rstrip()

        if not norm_line.strip():
            if current is not None:
                body_line_entries.append({"page": page, "line_index": line_idx, "text": ""})
            continue

        if any(norm_line.startswith(m) for m in INLINE_PAGE_BREAK_MARKERS):
            continue

        # Falls wir gerade einen Multi-Line-Header sammeln
        if pending_multiline:
            accumulated = " ".join([p["text"] for p in pending_multiline] + [norm_line])
            if ":" in accumulated:
                # Versuche Master-Regex auf aggregated
                aggregated_parent_spans = _find_parentheses_spans(accumulated)
                matches = list(MASTER_HEADER_RE.finditer(accumulated))
                outside_matches = [
                    m for m in matches
                    if not _inside_any(aggregated_parent_spans, m.start(), m.end())
                ]
                if outside_matches:
                    # Wir nehmen nur den ersten (typischer Multi-Line-Fall)
                    m = outside_matches[0]
                    if _accept_match(m, allow_abg_without_party):
                        flush_current()
                        speech_index += 1
                        speaker_meta = _speaker_meta_from_match(m, allow_abg_without_party)
                        # Continuation?
                        signature = (speaker_meta.get("role"), speaker_meta.get("name"))
                        continuation = (previous_speaker_signature == signature)
                        current = _make_new_speech(speech_index, page, speaker_meta, continuation)
                        previous_speaker_signature = signature
                        if debug:
                            current.setdefault("debug", {})
                            current["debug"]["origin"] = "multiline_master"
                            current["debug"]["lines"] = [p["text"] for p in pending_multiline] + [norm_line]
                        # Rest nach Header in aggregated extrahieren
                        after = accumulated[m.end():].strip()
                        if after:
                            body_line_entries.append({
                                "page": page,
                                "line_index": line_idx,
                                "text": after
                            })
                        pending_multiline.clear()
                        continue
                # Falls kein valider Header → alles als Body zu bisheriger Rede
                if current is None:
                    speech_index += 1
                    current = _make_new_speech(speech_index, page, _empty_speaker(), continuation=False)
                for p in pending_multiline:
                    body_line_entries.append({
                        "page": p["page"],
                        "line_index": p["line_index"],
                        "text": p["text"]
                    })
                pending_multiline.clear()

        # Master-Regel pro Zeile (auch mehrere Matches möglich – inline)
        parent_spans = _find_parentheses_spans(norm_line)
        matches = list(MASTER_HEADER_RE.finditer(norm_line))

        inside_matches, outside_matches = [], []
        for m in matches:
            if _inside_any(parent_spans, m.start(), m.end()):
                inside_matches.append(m)
            else:
                outside_matches.append(m)

        # Interjektionen (inside)
        if inside_matches:
            # Sicherstellen, dass eine laufende Rede existiert
            if current is None:
                speech_index += 1
                current = _make_new_speech(speech_index, page, _empty_speaker(), continuation=False)
            for m in inside_matches:
                if not _accept_match(m, allow_abg_without_party):
                    continue
                ann = _interjection_from_match(norm_line, m)
                current.setdefault("annotations", []).append(ann)

        processed_line = False

        if outside_matches:
            # Reihenfolge sichern
            flush_current()
            # Segmentiere line anhand der Matches
            last_end = 0
            for m in outside_matches:
                if not _accept_match(m, allow_abg_without_party):
                    continue
                # optional: Text zwischen zwei Headers (last_end..m.start()) falls relevant?
                # Ignorieren / könnte als Body an vorherige Rede — hier nicht nötig, weil wir flushen vor jedem Header.
                speech_index += 1
                speaker_meta = _speaker_meta_from_match(m, allow_abg_without_party)
                signature = (speaker_meta.get("role"), speaker_meta.get("name"))
                continuation = (previous_speaker_signature == signature)
                current = _make_new_speech(speech_index, page, speaker_meta, continuation)
                previous_speaker_signature = signature
                if debug:
                    current.setdefault("debug", {})
                    current["debug"]["origin"] = "master_inline"
                    current["debug"]["bold_used"] = bold_flag
                # Body-Anteil direkt nach diesem Header bis zum Beginn des nächsten Headers (oder Zeilenende)
                body_start = m.end()
                # Finde nächstes akzeptiertes Match zum Abschneiden
                next_starts = [nm.start() for nm in outside_matches if nm.start() > m.start()]
                segment_end = min(next_starts) if next_starts else len(norm_line)
                after = norm_line[body_start:segment_end].strip()
                if after:
                    body_line_entries.append({
                        "page": page,
                        "line_index": line_idx,
                        "text": after
                    })
                flush_current()
                last_end = segment_end
            processed_line = True

        if processed_line:
            continue

        # Kein vollständiger Header -> Prüfe auf Multi-Line-Beginn
        if LINE_START_ROLE_RE.match(norm_line) and ":" not in norm_line:
            # Bold Requirement?
            role_token = LINE_START_ROLE_RE.match(norm_line).group("role")
            if require_bold_for_header and not _bold_allowed(bold_flag, role_token, allow_header_without_bold_for_roles):
                # Dann als Body
                if current is None:
                    speech_index += 1
                    current = _make_new_speech(speech_index, page, _empty_speaker(), continuation=False)
                body_line_entries.append({
                    "page": page,
                    "line_index": line_idx,
                    "text": norm_line
                })
                continue
            # Sonst pending
            pending_multiline.append({
                "page": page,
                "line_index": line_idx,
                "text": norm_line,
                "bold": bold_flag
            })
            # Sicherheits-Fail-Safe: wenn >3 Zeilen ohne ":" => Body
            if len(pending_multiline) >= 4:
                if current is None:
                    speech_index += 1
                    current = _make_new_speech(speech_index, page, _empty_speaker(), continuation=False)
                for p in pending_multiline:
                    body_line_entries.append({
                        "page": p["page"],
                        "line_index": p["line_index"],
                        "text": p["text"]
                    })
                pending_multiline.clear()
            continue

        # Generische eingebettete Interjektionen (z. B. "- Abg. ...: Sehr gut!")
        interjections = list(EMBEDDED_INTERJECTION_RE.finditer(norm_line))
        if interjections:
            if current is None:
                speech_index += 1
                current = _make_new_speech(speech_index, page, _empty_speaker(), continuation=False)
            # Ganze Zeile als Body
            body_line_entries.append({
                "page": page,
                "line_index": line_idx,
                "text": norm_line
            })
            for im in interjections:
                raw_speaker = im.group(1).strip()
                party_hint = im.group(2)
                utterance = im.group(3).strip()
                ann = {
                    "type": "interjection",
                    "speaker_hint": _strip_academic_titles(raw_speaker),
                    "party_hint": _normalize_party_token(party_hint),
                    "text": utterance,
                    "source_line_index": line_idx,
                    "source_page": page
                }
                current.setdefault("annotations", []).append(ann)
            continue

        # Normale Body-Zeile
        if current is None:
            speech_index += 1
            current = _make_new_speech(speech_index, page, _empty_speaker(), continuation=False)
        else:
            if page > current.get("end_page", page):
                current["end_page"] = page
        body_line_entries.append({
            "page": page,
            "line_index": line_idx,
            "text": norm_line
        })

    # Offene Multi-Line Pending Lines → Body
    if pending_multiline:
        if current is None:
            if flat_lines:
                last_page = flat_lines[-1]["page"]
            else:
                last_page = 1
            speech_index += 1
            current = _make_new_speech(speech_index, last_page, _empty_speaker(), continuation=False)
        for p in pending_multiline:
            body_line_entries.append({
                "page": p["page"],
                "line_index": p["line_index"],
                "text": p["text"]
            })
        pending_multiline.clear()

    flush_current()
    return speeches

# -----------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------

def _bold_allowed(bold_flag: Optional[bool],
                  role: str,
                  allow_header_without_bold_for_roles: Optional[set]) -> bool:
    if allow_header_without_bold_for_roles and role in allow_header_without_bold_for_roles:
        return True
    return bool(bold_flag)

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

def _find_parentheses_spans(text: str) -> List[Tuple[int, int]]:
    spans: List[Tuple[int, int]] = []
    stack: List[int] = []
    for i, ch in enumerate(text):
        if ch == "(":
            stack.append(i)
        elif ch == ")" and stack:
            s = stack.pop()
            spans.append((s, i))
    return spans

def _inside_any(spans: Iterable[Tuple[int, int]], start: int, end: int) -> bool:
    for s, e in spans:
        if start >= s and end <= e:
            return True
    return False

def _accept_match(m: re.Match, allow_abg_without_party: bool) -> bool:
    role = _normalize_role_token(m.group("role"))
    party = m.group("party")
    if role == "Abg." and not allow_abg_without_party and not party:
        # Partei nötig für Abg.-Header
        return False
    return True

def _normalize_role_token(role_raw: str) -> str:
    # Vereinheitlicht Varianten
    r = role_raw.strip()
    # Stellv. Präsidentin? → Stellv. Präsidentin / Präsident
    # Ministerpräsidentin? etc. wir belassen grammatikalisches Geschlecht
    # Abgeordneter / Abgeordnete → in Mapping belassen
    return r

def _speaker_meta_from_match(m: re.Match, allow_abg_without_party: bool) -> Dict[str, Any]:
    role_raw = m.group("role")
    role = _normalize_role_token(role_raw)
    name_block = m.group("name_block").strip()
    party_raw = m.group("party")
    party_norm = _normalize_party_token(party_raw) if party_raw else None

    # Nameblock bereinigen (Titel raus)
    name_clean = _strip_academic_titles(name_block)

    # Partei evtl. auch in Klammern hinter Name? (bereits nicht Teil des master header)
    # (Wir könnten hier noch PAREN_PARTY_RE laufen lassen auf name_block – optional)

    category = CATEGORY_BY_ROLE.get(role if role in CATEGORY_BY_ROLE else role.replace("Abgeordneter", "Abg."))
    # Sonderfall Abgeordneter/Abgeordnete -> auf "Abg." normalisieren falls gewünscht
    if role in ("Abgeordneter", "Abgeordnete"):
        norm_role = "Abg."
    else:
        norm_role = role

    return {
        "raw": f"{role} {name_block}".strip(),
        "role": norm_role,
        "name": name_clean,
        "party": party_norm,
        "normalized": name_clean,
        "parliament_function": CATEGORY_BY_ROLE.get(norm_role)
    }

def _interjection_from_match(line: str, m: re.Match) -> Dict[str, Any]:
    role = _normalize_role_token(m.group("role"))
    name_block = m.group("name_block").strip()
    party_raw = m.group("party")
    party_norm = _normalize_party_token(party_raw) if party_raw else None
    after = line[m.end():]
    # Beschränken wir Interjektions-Text bis zum Klammer-Ende (wenn in Klammer)
    # Das ist ein heuristischer Ansatz – hier einfache Variante
    return {
        "type": "interjection",
        "speaker_hint": _strip_academic_titles(name_block),
        "role_hint": role,
        "party_hint": party_norm,
        "text": after.strip()
    }

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

def _extract_bold_flag(line_obj: Dict[str, Any]) -> Optional[bool]:
    if "bold" in line_obj and isinstance(line_obj["bold"], bool):
        return line_obj["bold"]
    if "is_bold" in line_obj and isinstance(line_obj["is_bold"], bool):
        return line_obj["is_bold"]
    fw = line_obj.get("font_weight")
    if isinstance(fw, (int, float)):
        return fw >= 600
    return None

# -----------------------------------------------------------
# Demo
# -----------------------------------------------------------

if __name__ == "__main__":
    demo = [
        {"page": 1, "line_index": 0, "text": "Präsidentin Muhterem Aras: Für die SPD-Fraktion erteile ich das Wort Herrn Abg. Dr. Fulst-Blei."},
        {"page": 1, "line_index": 1, "text": "Abg. Dr. Stefan Fulst-Blei SPD: Danke, Kollege Sturm. Und Kollegin Geugjes, Gratulation."},
        {"page": 1, "line_index": 2, "text": "(Beifall bei der CDU und den Grünen – Abg. Manuel Hagel CDU: Sehr gut!)"},
        {"page": 1, "line_index": 3, "text": "Ministerpräsident Winfried Kretschmann: Sehr geehrte Damen und Herren, ich beginne …"},
        {"page": 1, "line_index": 4, "text": "Abgeordnete Dr. Anna Beispielmann GRÜNE: Ich möchte Folgendes ausführen."},
        {"page": 1, "line_index": 5, "text": "Staatssekretär Peter Beispiel: Vielen Dank."},
        {"page": 1, "line_index": 6, "text": "Abg. Max Mustermann FDP/DVP: Zweiter Redebeitrag."},
        {"page": 2, "line_index": 0, "text": "Präsidentin Muhterem Aras"},
        {"page": 2, "line_index": 1, "text": "eröffnet die Sitzung:"},
        {"page": 2, "line_index": 2, "text": "Abg. Dr. Maria Kurz SPD: Neuer Beitrag."},
    ]
    speeches = segment_speeches(
        demo,
        capture_offsets=True,
        debug=True,
        require_bold_for_header=False,
        allow_abg_without_party=False
    )
    import json
    print(json.dumps(speeches, ensure_ascii=False, indent=2))
