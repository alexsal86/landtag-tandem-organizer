import re
from typing import List, Dict, Any, Tuple

FOOTER_PATTERNS = [
    re.compile(r"^Schluss:\s*\d{1,2}:\d{2}\s*$", re.IGNORECASE),
]

PAGE_NUMBER_PATTERN = re.compile(r"^\d{3,5}$")  # z. B. 7680
# Optional: Erkenne „Drucksache“ Zeilen am Ende (hier erst mal nicht automatisch entfernt)

INTERJECTION_KEYWORDS = [
    "Beifall", "Zuruf", "Heiterkeit", "Lachen", "Unruhe",
    "Zwischenruf", "Widerspruch", "Glocke", "Zurufe", "Beides", "Beides!"
]

# Grobes Muster für einzelne Interjection-Klammern
INTERJECTION_PAREN_PATTERN = re.compile(
    r"\(([^()]{0,160}?(?:"
    + "|".join(INTERJECTION_KEYWORDS)
    + r")[^()]*)\)"
)

# Trenner innerhalb einer Klammer, um mehrere Ereignisse zu splitten
SPLIT_TOKENS = [
    r"–\s*Zuruf", r"–\s*Beifall", r"–\s*Heiterkeit", r"–\s*Lachen",
    r"\)\s*\(",  # zwei Klammern direkt hintereinander, falls vorher nicht sauber getrennt
]

INTRA_SPLIT_REGEX = re.compile("(" + "|".join(SPLIT_TOKENS) + ")", re.IGNORECASE)

def clean_page_footers(pages_lines: List[List[str]]) -> Tuple[List[List[str]], Dict[str, Any]]:
    """
    Entfernt einmalige Footer-Zeilen, Abschlussformeln und reine Druckseitenzahlen.
    Gibt (neue_pages, stats) zurück.
    """
    new_pages = []
    removed_total = 0
    removed_footer_by_page = {}
    last_page_index = len(pages_lines) - 1

    for i, lines in enumerate(pages_lines):
        kept = []
        removed_here = []
        for ln_index, line in enumerate(lines):
            raw = line.strip()

            # Druckseitenzahl?
            if PAGE_NUMBER_PATTERN.match(raw):
                # Nur wenn wirklich am Ende (letzte oder vorletzte Zeile sinnvoll).
                # Wir nehmen hier eine laxe Regel: wenn Index in letzten 3 Zeilen.
                if ln_index >= len(lines) - 3:
                    removed_here.append(raw)
                    continue

            # „Schluss: HH:MM“
            if any(p.search(raw) for p in FOOTER_PATTERNS):
                removed_here.append(raw)
                continue

            # Spezifisch nur letzte Seite: harte Abschlussformeln
            if i == last_page_index:
                if raw.lower().startswith("ich schließe hiermit die sitzung"):
                    removed_here.append(raw)
                    continue
                # Häufige Variation
                if raw.lower().startswith("die nächste sitzung findet"):
                    removed_here.append(raw)
                    continue

            kept.append(line)

        if removed_here:
            removed_footer_by_page[i + 1] = removed_here
            removed_total += len(removed_here)
        new_pages.append(kept)

    stats = {
        "footer_removed_total": removed_total,
        "footer_removed_pages": removed_footer_by_page
    }
    return new_pages, stats


def cleanup_interjections(speeches: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Entfernt Interjections aus speech['text'] und fügt sie (falls neu) zu speech['annotations'] hinzu.
    Liefert Stats.
    """
    total_found = 0
    total_added = 0
    total_already_present = 0
    speech_stats = []

    for sp in speeches:
        original_text = sp.get("text", "")
        if not original_text:
            continue

        existing = sp.get("annotations") or []
        existing_texts = {a.get("text") for a in existing if a.get("type") == "interjection"}

        new_annotations = []
        modified_text, extracted = _extract_interjection_blocks(original_text)

        for block in extracted:
            norm_block = block.strip()
            if not norm_block:
                continue
            # Aufsplitten zusammengesetzter Interjections
            split_parts = _split_compound_interjections(norm_block)
            for part in split_parts:
                part_clean = part.strip()
                if not part_clean:
                    continue
                total_found += 1
                if part_clean in existing_texts:
                    total_already_present += 1
                    continue
                new_annotations.append({
                    "type": "interjection",
                    "text": part_clean,
                    # Page Approximation: nutze start_page, wenn vorhanden
                    "page": sp.get("start_page")
                })
                total_added += 1

        if new_annotations:
            existing.extend(new_annotations)
            sp["annotations"] = existing
            sp["text"] = _strip_redundant_spaces(modified_text)

            speech_stats.append({
                "speech_index": sp.get("index"),
                "added": len(new_annotations),
                "found_raw_blocks": len(extracted)
            })

    return {
        "interjections_found": total_found,
        "interjections_added": total_added,
        "interjections_existing_skipped": total_already_present,
        "speeches_modified": len(speech_stats),
        "speech_details": speech_stats[:25]  # truncate detail list for payload sanity
    }


def _extract_interjection_blocks(text: str) -> Tuple[str, List[str]]:
    """
    Findet alle Interjection-Klammern (mit Keywords) und entfernt sie aus dem Text.
    Gibt (bereinigter_text, liste_gefunden) zurück.
    """
    found = []
    # Wir iterieren iterativ, um bei Überschneidungen robust zu sein
    def repl(match):
        content = match.group(0)
        inner = content[1:-1]  # ohne Klammern
        # Prüfen ob ein Keyword im inneren Text auftritt
        if any(k.lower() in inner.lower() for k in INTERJECTION_KEYWORDS):
            found.append(inner)
            return " "  # Platzhalter
        return content  # behalten, falls kein Keyword (sollte nicht passieren)

    new_text = INTERJECTION_PAREN_PATTERN.sub(repl, text)
    return new_text, found


def _split_compound_interjections(block: str) -> List[str]:
    """
    Teilt zusammengesetzte Interjections auf. Beispiel:
    "Beifall bei der CDU – Zuruf des Abg. X" -> ["Beifall bei der CDU", "Zuruf des Abg. X"]
    Zusätzlich Klammerreste säubern.
    """
    # Erst einfache Klammerreste weg
    cleaned = block.strip()
    cleaned = cleaned.strip("()[]{} ")

    # Splitten an definierter Tokenliste, aber Token nicht verlieren -> wir rekonstruieren
    # Ansatz: wir erstzen „) (“ bereits vorher; hier reicht: auf " – " Muster
    # Besser: regulärer Split über definierte Token, danach Token selbst wieder anhängen wenn semantisch relevant.
    parts = []
    # Primärer Split an " – " vor Schlüsselwörtern (z. B. „– Zuruf“)
    tmp = re.split(r"\s+–\s+(?=(?:Zuruf|Beifall|Heiterkeit|Lachen|Unruhe|Widerspruch|Zwischenruf))", cleaned, flags=re.IGNORECASE)
    for p in tmp:
        p = p.strip()
        if not p:
            continue
        # Falls mehrere Klammerpaare verschmolzen waren: nochmal auf „) (“ splitten
        sub = re.split(r"\)\s*\(", p)
        for s in sub:
            s = s.strip("() ").strip()
            if s:
                parts.append(s)
    return parts if parts else [cleaned]


def _strip_redundant_spaces(text: str) -> str:
    # Entfernt doppelte Spaces, leerstehende Klammern etc.
    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r"\(\s*\)", "", text)
    return text.strip()
