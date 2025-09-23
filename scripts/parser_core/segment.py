import re
from typing import List, Dict, Any, Optional

# -----------------------------------------------------------
# Regex-Heuristiken für Sprecherzeilen
# -----------------------------------------------------------

# Beispiele, die wir abfangen wollen:
# "Abg. Dr. Erik Schweickert FDP/DVP:"
# "Abg. Erik Schweickert (FDP/DVP):"
# "Präsidentin Muhterem Aras:"
# "Stellv. Präsident Daniel Born:"
# "Ministerpräsident Winfried Kretschmann:"
# "Staatssekretärin Dr. Gisela Splett:"
# "Minister der Finanzen Dr. XYZ:"
# "Vizepräsident ...:"
# Variation mit Partei am Ende oder in Klammern.

SPEAKER_LINE_RE = re.compile(
    r"^(?P<prefix>"
    r"(Abg\.|Abgeordnete[rn]?|Präsident(?:in)?|Vizepräsident(?:in)?|Stellv\.\s*Präsident(?:in)?|Ministerpräsident(?:in)?|Minister(?:in)?|Staatssekretär(?:in)?|Justizminister(?:in)?|Innenminister(?:in)?|Finanzminister(?:in)?))"
    r"(?P<rest>.*?):\s*$"
)

# Partei-Kürzel Muster (locker – kann erweitert werden)
PARTY_RE = re.compile(
    r"\b(CDU|SPD|AfD|FDP\/DVP|FDP|Grüne|Grünen|Bündnis\s*90\/Die\s*Grünen|FW|Linke|fraktionslos)\b",
    re.IGNORECASE
)

# Klammer-Partei am Ende z. B. "Name (CDU)" – extrahieren.
PAREN_PARTY_RE = re.compile(r"\(([^()]{2,30})\)\s*$")

# Entferne multiple Spaces für Normalisierung
MULTI_SPACE_RE = re.compile(r"\s{2,}")


def segment_speeches(flat_lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Nimmt die durch flatten_pages erzeugte Liste von Zeilen:
      flat_lines[i] = {
          "page": <int>,
          "line_index": <int>,
          "text": <str>
      }

    Erzeugt daraus eine Liste von Speech-Objekten:
      {
        "index": fortlaufend ab 1,
        "start_page": int,
        "end_page": int,
        "speaker": {
            "raw": <Original Sprecherzeile ohne abschließenden Doppelpunkt>,
            "name": <heuristisch extrahiert oder None>,
            "role": <z. B. Präsident, Abg., Minister...>,
            "party": <heuristisch extrahiert oder None>
        },
        "text": "Rede ohne Sprecherzeile(n)",
        "annotations": []
      }

    Hinweis: Interjections werden später entfernt & als annotations ergänzt.
    """
    speeches: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    buffer_lines: List[str] = []
    current_speaker_line_raw: Optional[str] = None
    current_speaker_meta: Optional[Dict[str, Any]] = None

    def flush_current():
        nonlocal current, buffer_lines, current_speaker_line_raw, current_speaker_meta
        if current is None:
            buffer_lines = []
            return
        # Text zusammenbauen
        text = "\n".join(l for l in buffer_lines if l.strip())
        current["text"] = text
        current["end_page"] = current.get("end_page") or current["start_page"]
        current["annotations"] = current.get("annotations", [])
        current["speaker"] = current_speaker_meta or {
            "raw": current_speaker_line_raw,
            "name": None,
            "role": None,
            "party": None
        }
        speeches.append(current)
        # Reset
        current = None
        buffer_lines = []
        current_speaker_line_raw = None
        current_speaker_meta = None

    speech_index = 0

    for line_obj in flat_lines:
        raw_text = line_obj.get("text", "")
        page = line_obj.get("page")

        if not raw_text or not raw_text.strip():
            # Leere Zeile -> einfach puffern (kann Absatzgrenze bedeuten)
            if current is not None:
                buffer_lines.append("")
            continue

        stripped = raw_text.rstrip()
        speaker_match = SPEAKER_LINE_RE.match(stripped)

        if speaker_match:
            # Neue Sprecherzeile gefunden -> aktuelle Rede flushen
            flush_current()
            speech_index += 1
            # Sprecherzeile ohne abschließenden Doppelpunkt
            speaker_line_no_colon = stripped[:-1].strip()

            # Metadaten heuristisch parsen
            meta = _parse_speaker_line(speaker_line_no_colon)

            current = {
                "index": speech_index,
                "start_page": page,
                "end_page": page
            }
            current_speaker_line_raw = speaker_line_no_colon
            current_speaker_meta = meta
        else:
            # Normale Redezeile
            if current is None:
                # Wenn wir Text vor der ersten erkannten Sprecherzeile haben, legen wir eine "anonyme" Rede an.
                speech_index += 1
                current = {
                    "index": speech_index,
                    "start_page": page,
                    "end_page": page
                }
                current_speaker_line_raw = None
                current_speaker_meta = {
                    "raw": None,
                    "name": None,
                    "role": None,
                    "party": None
                }
            else:
                # Update end_page
                if page > current.get("end_page", page):
                    current["end_page"] = page

            buffer_lines.append(stripped)

    # Am Ende letzte Rede flushen
    flush_current()

    return speeches


def _parse_speaker_line(line: str) -> Dict[str, Any]:
    """
    Versucht aus der kompletten Sprecherzeile ohne abschließenden Doppelpunkt
    Sprecherrolle, Name und Partei zu extrahieren.
    """
    # Beispiel: "Abg. Dr. Erik Schweickert FDP/DVP"
    # Beispiel: "Präsidentin Muhterem Aras"
    # Beispiel: "Stellv. Präsident Daniel Born"
    # Beispiel: "Ministerpräsident Winfried Kretschmann (Grüne)"

    role = None
    party = None
    name = None

    working = line.strip()
    working = MULTI_SPACE_RE.sub(" ", working)

    # Partei in Klammern am Ende?
    m_paren = PAREN_PARTY_RE.search(working)
    if m_paren:
        possible_party = m_paren.group(1).strip()
        if PARTY_RE.search(possible_party):
            party = possible_party
            working = working[:m_paren.start()].strip()

    # Partei als letztes Token?
    tokens = working.split()
    if tokens:
        last_token = tokens[-1]
        if PARTY_RE.match(last_token):
            party = last_token
            working = " ".join(tokens[:-1]).strip()

    # Rolle am Anfang?
    role_match_prefix = re.match(
        r"^(Abg\.|Abgeordnete[rn]?|Präsident(?:in)?|Vizepräsident(?:in)?|Stellv\.\s*Präsident(?:in)?|Ministerpräsident(?:in)?|Minister(?:in)?|Staatssekretär(?:in)?|Justizminister(?:in)?|Innenminister(?:in)?|Finanzminister(?:in)?)\b",
        working
    )
    if role_match_prefix:
        role = role_match_prefix.group(1)
        name = working[role_match_prefix.end():].strip()
    else:
        # Kein klarer Rollenprefix → alles als Name
        name = working

    # Falls Name leer, None setzen
    if name == "":
        name = None

    return {
        "raw": line,
        "name": name,
        "role": role,
        "party": party
    }
