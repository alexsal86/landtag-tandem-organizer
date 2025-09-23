import re
from typing import List, Tuple

HEADER_PATTERNS = [
    re.compile(r"^Landtag\s+Baden-?Württemberg", re.IGNORECASE),
    re.compile(r"^\(.*Sitzung.*\d{4}\)$"),   # z.B. "(127. Sitzung Mittwoch, 16. Juli 2025)"
]

FOOTER_PATTERNS = [
    re.compile(r"^Schluss:\s*\d{1,2}:\d{2}\s*Uhr\.?$", re.IGNORECASE),
    re.compile(r"^(Ende|Schluss)\s+der\s+Sitzung\.?$", re.IGNORECASE),
]

PAGE_NUMBER_RE = re.compile(r"^\d{3,5}$")  # Druckseiten wie 7639, 7680
WHITESPACE_RE = re.compile(r"\s+")


def _strip_headers(lines: List[str]) -> List[str]:
    """
    Entfernt führende Kopfzeilen. Wir prüfen die ersten 3 Zeilen.
    """
    out = list(lines)
    changed = True
    # Mehrfach, falls z. B. zwei meta-Zeilen übereinander
    for _ in range(3):
        if not out:
            break
        first = out[0].strip()
        if any(pat.match(first) for pat in HEADER_PATTERNS):
            out.pop(0)
            continue
        # Falls reine Seitenzahl oben (eher selten) → auch weg
        if PAGE_NUMBER_RE.match(first):
            out.pop(0)
            continue
        break
    return out


def _strip_footers(lines: List[str]) -> Tuple[List[str], int]:
    """
    Entfernt Footer am Ende.
    Rückgabe: (bereinigte Zeilen, anzahl_entfernter_zeilen)
    """
    out = list(lines)
    removed = 0
    for _ in range(5):  # maximal 5 Footer-Zeilen prüfen
        if not out:
            break
        last = out[-1].strip()
        if not last:
            out.pop()
            removed += 1
            continue
        if PAGE_NUMBER_RE.match(last):
            out.pop()
            removed += 1
            continue
        if any(pat.match(last) for pat in FOOTER_PATTERNS):
            out.pop()
            removed += 1
            continue
        # Falls nur Seitenzahl + optional Punkt oder Doppelpunkt? (absichern)
        if re.match(r"^\d{3,5}\.?$", last):
            out.pop()
            removed += 1
            continue
        break
    return out, removed


def clean_pages_headers_footers(pages: List[List[str]]) -> Tuple[List[List[str]], dict]:
    """
    Wendet Header/Footer-Säuberung an.
    Gibt (bereinigte_pages, stats) zurück.
    """
    cleaned = []
    total_removed = 0
    footer_removed_pages = 0
    header_removed_pages = 0

    for page_lines in pages:
        original_len = len(page_lines)
        lines = _strip_headers(page_lines)
        if len(lines) != original_len:
            header_removed_pages += 1
        lines, rem = _strip_footers(lines)
        if rem:
            footer_removed_pages += 1
            total_removed += rem
        cleaned.append(lines)

    stats = {
        "pages": len(pages),
        "footer_removed_pages": footer_removed_pages,
        "header_removed_pages": header_removed_pages,
        "total_footer_lines_removed": total_removed
    }
    return cleaned, stats
