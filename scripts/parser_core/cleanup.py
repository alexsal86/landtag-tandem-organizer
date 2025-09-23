import re
from typing import List, Dict, Any, Tuple

FOOTER_PATTERNS = [
    re.compile(r"^Schluss:\s*\d{1,2}:\d{2}\s*$", re.IGNORECASE),
]

PAGE_NUMBER_PATTERN = re.compile(r"^\d{3,5}$")

INTERJECTION_KEYWORDS = [
    "Beifall", "Zuruf", "Heiterkeit", "Lachen", "Unruhe",
    "Zwischenruf", "Widerspruch", "Glocke", "Zurufe"
]

INTERJECTION_PAREN_PATTERN = re.compile(
    r"\(([^()]{0,160}?(?:"
    + "|".join(INTERJECTION_KEYWORDS)
    + r")[^()]*)\)"
)

def clean_page_footers(pages_lines: List[List[str]]) -> Tuple[List[List[str]], Dict[str, Any]]:
    new_pages = []
    removed_total = 0
    removed_footer_by_page = {}
    last_page_index = len(pages_lines) - 1

    for i, lines in enumerate(pages_lines):
        kept = []
        removed_here = []
        for ln_index, line in enumerate(lines):
            raw = line.strip()

            if PAGE_NUMBER_PATTERN.match(raw):
                if ln_index >= len(lines) - 3:
                    removed_here.append(raw)
                    continue

            if any(p.search(raw) for p in FOOTER_PATTERNS):
                removed_here.append(raw)
                continue

            if i == last_page_index:
                lower = raw.lower()
                if lower.startswith("ich schließe hiermit die sitzung"):
                    removed_here.append(raw)
                    continue
                if lower.startswith("die nächste sitzung findet"):
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
        seq_counter = 0

        modified_text, extracted_blocks = _extract_interjection_blocks_with_spans(original_text)
        new_annotations = []

        for blk in extracted_blocks:
            inner = blk["inner"]
            # Split zusammengesetzte Interjections
            parts = _split_compound_interjections(inner)
            for part in parts:
                part_clean = part.strip()
                if not part_clean:
                    continue
                total_found += 1
                if part_clean in existing_texts:
                    total_already_present += 1
                    continue
                before_snip = original_text[max(0, blk["start"] - 25):blk["start"]]
                after_snip = original_text[blk["end"]:blk["end"] + 25]
                new_annotations.append({
                    "type": "interjection",
                    "text": part_clean,
                    "page": sp.get("start_page"),
                    "raw_start": blk["start"],
                    "raw_end": blk["end"],
                    "context_before": before_snip,
                    "context_after": after_snip,
                    "sequence_index": seq_counter
                })
                seq_counter += 1

        if new_annotations:
            existing.extend(new_annotations)
            sp["annotations"] = existing
            sp["text_raw"] = original_text  # Rohtext sichern
            sp["text"] = _strip_redundant_spaces(modified_text)
            speech_stats.append({
                "speech_index": sp.get("index"),
                "added": len(new_annotations),
                "raw_blocks": len(extracted_blocks)
            })

    return {
        "interjections_found": total_found,
        "interjections_added": total_added,
        "interjections_existing_skipped": total_already_present,
        "speeches_modified": len(speech_stats),
        "speech_details": speech_stats[:25]
    }

def _extract_interjection_blocks_with_spans(text: str):
    results = []
    new_text_parts = []
    last_idx = 0
    for m in INTERJECTION_PAREN_PATTERN.finditer(text):
        inner = m.group(1)
        if any(k.lower() in inner.lower() for k in INTERJECTION_KEYWORDS):
            new_text_parts.append(text[last_idx:m.start()])
            new_text_parts.append(" ")
            results.append({
                "inner": inner,
                "start": m.start(),
                "end": m.end()
            })
            last_idx = m.end()
    new_text_parts.append(text[last_idx:])
    return "".join(new_text_parts), results

def _split_compound_interjections(block: str):
    cleaned = block.strip().strip("()[]{} ")
    # Split an " – " vor Schlüsselwörtern
    import re
    parts = re.split(r"\s+–\s+(?=(?:Zuruf|Beifall|Heiterkeit|Lachen|Unruhe|Widerspruch|Zwischenruf))", cleaned, flags=re.IGNORECASE)
    out = []
    for p in parts:
        sub = re.split(r"\)\s*\(", p)
        for s in sub:
            s = s.strip("() ").strip()
            if s:
                out.append(s)
    return out if out else [cleaned]

def _strip_redundant_spaces(text: str) -> str:
    import re
    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r"\(\s*\)", "", text)
    return text.strip()
