import re
from typing import List, Dict

SPEAKER_REGEX = re.compile(
    r"^([A-ZÄÖÜ][\wÄÖÜäöüß .'\-]{2,70}?)(?:\s+\(([A-ZÄÖÜ/]+)\))?:\s"
)

def segment_speeches(flat_lines: List[Dict]) -> List[Dict]:
    """
    flat_lines: [{page, text}]
    returns speeches with start/end pages
    """
    speeches = []
    current = None
    for entry in flat_lines:
        line = entry["text"]
        m = SPEAKER_REGEX.match(line)
        if m:
            # start new speech
            if current:
                speeches.append(current)
            speaker_raw = m.group(1)
            party = m.group(2)
            rest = line[m.end():].strip()
            current = {
                "index": len(speeches) + 1,
                "speaker": {
                    "raw": speaker_raw,
                    "normalized_name": normalize_speaker_name(speaker_raw),
                    "role": detect_role(speaker_raw),
                    "party": party
                },
                "text_parts": [rest] if rest else [],
                "start_page": entry["page"],
                "end_page": entry["page"]
            }
        else:
            if current:
                current["text_parts"].append(line)
                current["end_page"] = entry["page"]
            else:
                # preamble text – could store separately or ignore
                pass
    if current:
        speeches.append(current)
    # Join text_parts
    for s in speeches:
        s["text"] = "\n".join(s.pop("text_parts"))
    return speeches

def normalize_speaker_name(raw: str) -> str:
    # Simple heuristics: remove titles like "Dr.", "Minister", keep trailing surname
    # For now return raw (refine later)
    return raw

def detect_role(raw: str):
    r = raw.lower()
    if "präsident" in r:
        return "Präsidium"
    if "minister" in r:
        return "Minister"
    return None