import re
from typing import List, Dict, Any, Optional

# -----------------------------------------------------------
# Regex-Heuristiken / Muster
# -----------------------------------------------------------

ROLE_PREFIX_RE = re.compile(
    r"^(Abg\.|Abgeordnete[rn]?|Präsident(?:in)?|Vizepräsident(?:in)?|Stellv\.\s*Präsident(?:in)?|"
    r"Ministerpräsident(?:in)?|Minister(?:in)?|Staatssekretär(?:in)?|Justizminister(?:in)?|"
    r"Innenminister(?:in)?|Finanzminister(?:in)?|Wirtschaftsminister(?:in)?|Kultusminister(?:in)?|"
    r"Landesbeauftragte[rn]?|Ombudsmann|Ombudsfrau)\b"
)

SPEAKER_LINE_RE = re.compile(r":\s*$")  # Zeile endet mit Doppelpunkt → potenzielle Sprecherzeile

PARTY_TOKEN_RE = re.compile(
    r"^(CDU|SPD|AfD|FDP\/DVP|FDP|Grüne|GRÜNE|Bündnis\s*90\/Die\s*Grünen|BÜNDNIS\s*90\/DIE\s*GRÜNEN|"
    r"FW|Freie\s*Wähler|Linke|LINKE|fraktionslos)$",
    re.IGNORECASE
)

PAREN_PARTY_RE = re.compile(r"\(([^()]{2,50})\)\s*$")

MULTI_SPACE_RE = re.compile(r"\s{2,}")

ALL_CAPS_NAME_RE = re.compile(r"^[A-ZÄÖÜß][A-ZÄÖÜß\- ]{2,}$")

INLINE_PAGE_BREAK_MARKERS = [
    # Falls im Flat-Extrakt Seitenköpfe noch durchgerutscht sind:
    "Landtag von Baden-Württemberg",  # Beispiel – anpassbar
]


# -----------------------------------------------------------
# Public API
# -----------------------------------------------------------

def segment_speeches(flat_lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Wandelt flache Zeilen (page, line_index, text) in strukturierte Reden um.
    Pipeline:
      1. Kandidaten für Sprecherzeilen erkennen
      2. Multi-Line Sprecherheader zusammenfügen (falls umgebrochen)
      3. Redebody bis nächste Sprecherzeile sammeln
      4. start_page / end_page füllen
    """
    speeches: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    body_buffer: List[str] = []
    pending_speaker_lines: List[str] = []  # Sammeln, falls Sprecher-Umbuch
    speech_index = 0

    def flush_current():
        nonlocal current, body_buffer, speeches
        if current is None:
            body_buffer = []
            return
        text = "\n".join(l for l in body_buffer if l.strip())
        current["text"] = text
        current["end_page"] = current.get("end_page") or current["start_page"]
        current.setdefault("annotations", [])
        speeches.append(current)
        current = None
        body_buffer = []

    for line_obj in flat_lines:
        line_text = line_obj.get("text", "")
        page = line_obj.get("page")

        if not line_text.strip():
            # Leere Zeile → ggf. Puffer weiterreichen
            if current is not None:
                body_buffer.append("")
            continue

        # Filter harmloser Seitenkopfzeilen (optional erweitern)
        if any(line_text.startswith(m) for m in INLINE_PAGE_BREAK_MARKERS):
            continue

        raw = line_text.rstrip()

        # Prüfen ob potenzieller Beginn einer neuen Sprecherzeile
        if _looks_like_speaker_line(raw):
            # Falls wir schon in einer Rede sind und bereits Body angesammelt → neue Rede beginnt
            # ABER erst multi-line sammeln, falls Zeile vermutlich abgeschnitten war
            pending_speaker_lines.append(raw)
            # Heuristik: Wenn Zeile mit ":" endet -> wahrscheinlich vollständig
            if raw.endswith(":"):
                # Multi-Line Header zusammenbauen
                full_header = _merge_speaker_header(pending_speaker_lines)
                pending_speaker_lines.clear()
                # Wenn es schon eine Rede gibt -> flush
                flush_current()
                speech_index += 1
                speaker_meta = _parse_speaker_header(full_header)
                current = {
                    "index": speech_index,
                    "start_page": page,
                    "end_page": page,
                    "speaker": speaker_meta
                }
            else:
                # Noch sammeln (Zeile könnte umgebrochen sein)
                continue
        else:
            # Falls wir Zeilen im pending Speaker-Buffer hatten, aber diese Zeile gehört nicht dazu:
            if pending_speaker_lines:
                # Wahrscheinlich Fehlinterpretation -> schiebe gesammelte Zeilen in Body der aktuellen Rede
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
                            "party": None
                        }
                    }
                # pending Zeilen reinschieben
                for pl in pending_speaker_lines:
                    body_buffer.append(pl)
                pending_speaker_lines.clear()

            # Normaler Bodytext
            if current is None:
                # anonymer Block vor erster Sprecherzeile
                speech_index += 1
                current = {
                    "index": speech_index,
                    "start_page": page,
                    "end_page": page,
                    "speaker": {
                        "raw": None,
                        "name": None,
                        "role": None,
                        "party": None
                    }
                }
            else:
                if page > current.get("end_page", page):
                    current["end_page"] = page

            body_buffer.append(raw)

    # Ende: Offene pending speaker lines?
    if pending_speaker_lines:
        # Wenn kein current -> neue anonyme Rede
        if current is None:
            speech_index += 1
            current = {
                "index": speech_index,
                "start_page": flat_lines[-1]["page"] if flat_lines else 1,
                "end_page": flat_lines[-1]["page"] if flat_lines else 1,
                "speaker": {
                    "raw": None,
                    "name": None,
                    "role": None,
                    "party": None
                }
            }
        for pl in pending_speaker_lines:
            body_buffer.append(pl)

    flush_current()
    return speeches


# -----------------------------------------------------------
# Hilfsfunktionen
# -----------------------------------------------------------

def _looks_like_speaker_line(line: str) -> bool:
    """
    Entscheidet heuristisch, ob eine Zeile (oder ein Teil eines multi-line Headers)
    eine Sprecherzeile sein könnte.
    Kriterien:
      - Enthält Rollen-Prefix ODER
      - Endet mit ":" UND enthält (mindestens) 1 Wort + ggf. Titel oder Parteiname
      - All-Caps + Partei-Träger vor ":" (manche Setzerformatierungen)
    """
    stripped = line.strip()
    if not stripped:
        return False
    if ROLE_PREFIX_RE.search(stripped):
        return True
    if stripped.endswith(":") and len(stripped.split()) <= 2:
        # Kurzformen wie "Präsident:" → ja
        return True
    if stripped.endswith(":") and ROLE_PREFIX_RE.search(stripped.split()[0]):
        return True
    # All-Caps Name gefolgt von evtl. Partei + Doppelpunkt
    if stripped.endswith(":") and ALL_CAPS_NAME_RE.match(stripped[:-1].strip()):
        return True
    # Partei in Klammern plus Doppelpunkt
    if stripped.endswith(":") and "(" in stripped and ")" in stripped:
        return True
    # Falls Doppelpunkt fehlt, aber Rolle vorhanden: multi-line / umgebrochen
    if ROLE_PREFIX_RE.search(stripped) and not stripped.endswith(":"):
        return True
    return False


def _merge_speaker_header(lines: List[str]) -> str:
    """
    Fügt mehrere Zeilen eines umgebrochenen Headers zusammen.
    Entfernt doppelte Leerzeichen.
    """
    raw = " ".join(l.strip() for l in lines)
    raw = MULTI_SPACE_RE.sub(" ", raw)
    return raw


def _parse_speaker_header(header: str) -> Dict[str, Any]:
    """
    Parsed finalen Sprecherheader (mit Doppelpunkt am Ende).
    Entfernt abschließenden ":".
    Liefert Struktur wie:
    {
      raw: <voller String ohne ":">,
      role: <Abg./Präsidentin/... oder None>,
      name: <extrahierter Name oder None>,
      party: <Parteikürzel oder kombinierter Ausdruck>,
    }
    """
    h = header.strip()
    if h.endswith(":"):
        h = h[:-1].strip()

    # Partei in Klammern extrahieren
    party = None
    m_paren = PAREN_PARTY_RE.search(h)
    if m_paren:
        candidate = m_paren.group(1).strip()
        if len(candidate) < 48:  # plausible Länge
            party = candidate
            h = h[:m_paren.start()].strip()

    tokens = h.split()
    role = None
    name_tokens = tokens[:]

    # Falls erstes Token eine Rolle ist
    if tokens:
        m_role = ROLE_PREFIX_RE.match(tokens[0])
        if m_role:
            role = m_role.group(0)
            name_tokens = tokens[1:]

    # Partei als letztes Token?
    if name_tokens:
        last = name_tokens[-1]
        if PARTY_TOKEN_RE.match(last):
            if party:
                # bereits Partei-Klammer gefunden -> kombiniere
                party = f"{party}; {last}"
            else:
                party = last
            name_tokens = name_tokens[:-1]

    name = " ".join(name_tokens).strip() or None

    return {
        "raw": h,
        "role": role,
        "name": name,
        "party": party
    }
