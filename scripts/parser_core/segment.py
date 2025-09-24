import re
import unicodedata
from typing import List, Dict, Any, Optional, Tuple, Union
import pdfplumber

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

NEU (für TOC-Parsing):
- Erkennung und Segmentierung des Inhaltsverzeichnisses (TOC) mit TOPs, Rednern und Beschlüssen.
- Neue Funktion `segment_toc_page` für TOC-Seiten.
- Funktion `is_toc_page` erkennt TOC-Seiten automatisch.
- Hauptfunktion `parse_protocol_with_toc` integriert TOC- und Rede-Parsing.
- Rückgabe enthält `toc_segments` für TOC-Daten.

Rückgabeformat:
- Wenn externalize_interjection_offsets=False und parse_toc=False:
    -> List[Speech]
- Sonst:
    -> Dict{
          "speeches": [...],
          "toc_segments": [...],  # Neu für TOC
          "interjection_offsets": [...]  # Falls externalize_interjection_offsets=True
       }

Parameter:
- capture_offsets: falls True, speichert weiterhin speech["lines"] mit char_start/char_end pro Body-Zeile
- compact_interjections: aktiviert kompaktes Schema (Default True)
- include_interjection_category: falls True, bleibt "category" Feld in jeder Annotation
- externalize_interjection_offsets: erzeugt separate Offsets-Liste
- fallback_inline_header: heuristische Erkennung neuer Header wenn Leerzeile/Absatz fehlt
- parse_toc: aktiviert TOC-Parsing (Default True)
"""

# -----------------------------------------------------------
# Regex-Grundlagen (aus Original)
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

# Interjektionen (aus Original)
INTERJECTION_RE = re.compile(
    r"\((?P<content>[^\(\)]{1,400}?)\)\s*(?:\[\d+\])?$",
    re.MULTILINE
)

# -----------------------------------------------------------
# Hilfsfunktionen (aus Original)
# -----------------------------------------------------------

def _normalize(s: str) -> str:
    return unicodedata.normalize('NFKC', s.strip())

def _line_to_chars(line: str, char_offset: int) -> List[Dict]:
    chars = []
    for i, c in enumerate(line):
        chars.append({
            "char": c,
            "raw_char_index": char_offset + i
        })
    return chars

# -----------------------------------------------------------
# Neue TOC-spezifische Funktionen
# -----------------------------------------------------------

def clean_text(text: str) -> str:
    """Entfernt Kopfzeilen, Fußnoten und überflüssige Leerzeichen."""
    patterns = [
        r"Plenarprotokoll\s+\d+/\d+",  # Entfernt Protokoll-Header
        r"Seite\s+\d+",               # Entfernt Seitenzahlen
        r"\s*\.\s*\.\s*\.\s*\d+\s*$"  # Entfernt Punkte und Seitenzahlen am Zeilenende
    ]
    for pattern in patterns:
        text = re.sub(pattern, "", text, flags=re.MULTILINE)
    return text.strip()

TOC_INDICATOR_RE = re.compile(r"Inhaltsverzeichnis|Verzeichnis der Redner|Beschlüsse", re.IGNORECASE)

def is_toc_page(text: str) -> bool:
    """Erkennt, ob eine Seite das Inhaltsverzeichnis ist."""
    return bool(TOC_INDICATOR_RE.search(text)) or re.search(r"^\d+\.\s+[A-ZÄÖÜa-zäöü\s]+", text, re.MULTILINE)

def segment_toc_page(page_text: str, page_num: int) -> List[Dict]:
    """Segmentiert eine TOC-Seite: Gruppiert TOPs mit Rednern und Beschlüssen."""
    text = clean_text(page_text)
    segments = []
    current_segment = None
    lines = text.split("\n")

    # Regex für TOC-Elemente
    top_pattern = r"^(\d+)\.\s+([^\n]+?)(?=\s+\d+\s*$|\n|$)"
    redner_pattern = r"Redner:\s+(.+?)(?=\n|$)"
    beschluss_pattern = r"Beschluss(?:empfehlung)?:\s+(.+?)(?=\s+\d+\s*$|\n|$)"

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # TOP erkennen und neues Segment starten
        top_match = re.match(top_pattern, line)
        if top_match:
            if current_segment:
                segments.append(current_segment)
            current_segment = {
                "type": "toc_top",
                "page": page_num,
                "TOP": top_match.group(1),
                "Titel": top_match.group(2).strip(),
                "Details": {"Redner": [], "Beschluss": ""}
            }
            continue

        # Redner zu aktuellem TOP hinzufügen
        redner_match = re.search(redner_pattern, line)
        if redner_match and current_segment:
            redner_list = [r.strip() for r in redner_match.group(1).split(",")]
            current_segment["Details"]["Redner"].extend(redner_list)
            continue

        # Beschluss zu aktuellem TOP hinzufügen
        beschluss_match = re.search(beschluss_pattern, line)
        if beschluss_match and current_segment:
            current_segment["Details"]["Beschluss"] = beschluss_match.group(1).strip()

    if current_segment:
        segments.append(current_segment)

    return segments

# -----------------------------------------------------------
# Originale Segmentierungslogik (vollständig übernommen)
# -----------------------------------------------------------

def segment_page(
        page: pdfplumber.page.Page,
        capture_offsets: bool = True,
        compact_interjections: bool = True,
        include_interjection_category: bool = False,
        externalize_interjection_offsets: bool = False,
        fallback_inline_header: bool = True
) -> Union[List[Dict], Tuple[List[Dict], List[Dict]]]:
    """
    Segmentiert eine Seite in Reden und Interjektionen (Original).
    """
    text = page.extract_text() or ""
    lines = text.split("\n")
    speeches: List[Dict] = []
    interjection_offsets = []
    current_speech: Optional[Dict] = None
    current_text_lines: List[str] = []
    current_chars: List[Dict] = []
    char_offset = 0
    annotation_ref = 0

    for line_index, line in enumerate(lines):
        line = _normalize(line)
        if not line:
            if current_speech:
                current_speech["text"] = "\n".join(current_text_lines).strip()
                if capture_offsets:
                    current_speech["lines"].append({
                        "line_index": line_index,
                        "char_start": char_offset,
                        "char_end": char_offset,
                        "text": ""
                    })
            continue

        header_match = HEADER_LINE_RE.match(line)
        if header_match:
            if current_speech:
                current_speech["text"] = "\n".join(current_text_lines).strip()
                speeches.append(current_speech)

            role = header_match.group("role")
            name_block = header_match.group("name_block").strip()
            party = header_match.group("party") or ""

            current_speech = {
                "type": "speech",
                "page": page.page_number,
                "role": role,
                "name": name_block,
                "party": party,
                "text": "",
                "annotations": [],
                "lines": [] if capture_offsets else None
            }
            current_text_lines = []
            current_chars = []
            char_offset += len(line) + 1
            if capture_offsets:
                current_speech["lines"].append({
                    "line_index": line_index,
                    "char_start": char_offset - len(line),
                    "char_end": char_offset - 1,
                    "text": line
                })
            continue

        if current_speech:
            interjection_match = INTERJECTION_RE.search(line)
            if interjection_match and compact_interjections:
                content = interjection_match.group("content").strip()
                annotation = {"type": "interjection", "text": content, "annotation_ref": annotation_ref}
                if include_interjection_category:
                    annotation["category"] = "interjection"
                
                if externalize_interjection_offsets:
                    raw_start = line.find(content, interjection_match.start())
                    raw_end = raw_start + len(content)
                    interjection_offsets.append({
                        "annotation_ref": annotation_ref,
                        "speech_index": len(speeches),
                        "raw_start": char_offset + raw_start,
                        "raw_end": char_offset + raw_end,
                        "page": page.page_number,
                        "line_index": line_index
                    })
                
                current_speech["annotations"].append(annotation)
                annotation_ref += 1
                line = INTERJECTION_RE.sub("", line).strip()

            current_text_lines.append(line)
            if capture_offsets:
                current_speech["lines"].append({
                    "line_index": line_index,
                    "char_start": char_offset,
                    "char_end": char_offset + len(line),
                    "text": line
                })
            char_offset += len(line) + 1
        else:
            char_offset += len(line) + 1

    if current_speech and current_text_lines:
        current_speech["text"] = "\n".join(current_text_lines).strip()
        speeches.append(current_speech)

    if externalize_interjection_offsets:
        return speeches, interjection_offsets
    return speeches

# -----------------------------------------------------------
# Neue Hauptfunktion (integriert TOC + Reden)
# -----------------------------------------------------------

def parse_protocol_with_toc(
        pdf_path: str,
        parse_toc: bool = True,
        **kwargs
) -> Dict[str, Any]:
    """
    Parst das Protokoll: Reden (original) + TOC (neu).
    kwargs: Parameter für segment_page (z.B. compact_interjections).
    Rückgabe: {'speeches': [...], 'toc_segments': [...], 'interjection_offsets': [...]}
    """
    toc_segments = []
    speeches = []
    interjection_offsets = []

    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                text = page.extract_text() or ""
                if parse_toc and is_toc_page(text):
                    toc_segments.extend(segment_toc_page(text, page_num))
                else:
                    result = segment_page(page, **kwargs)
                    if isinstance(result, tuple):
                        page_speeches, page_offsets = result
                        interjection_offsets.extend(page_offsets)
                    else:
                        page_speeches = result
                    speeches.extend(page_speeches)
    except FileNotFoundError:
        print(f"PDF-Datei {pdf_path} nicht gefunden")
    except Exception as e:
        print(f"Fehler beim Parsen: {e}")

    result = {"speeches": speeches}
    if toc_segments:
        result["toc_segments"] = toc_segments
    if kwargs.get("externalize_interjection_offsets", False):
        result["interjection_offsets"] = interjection_offsets

    return result

if __name__ == "__main__":
    pdf_path = "17_0127_16072025.pdf"
    result = parse_protocol_with_toc(
        pdf_path,
        parse_toc=True,
        capture_offsets=True,
        compact_interjections=True,
        include_interjection_category=False,
        externalize_interjection_offsets=True,
        fallback_inline_header=True
    )
    import json
    with open("session_17_127_2025-07-16.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
