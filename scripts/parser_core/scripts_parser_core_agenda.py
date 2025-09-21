import re
from typing import List, Dict

TOP_REGEX = re.compile(r"^(TOP\s*\d+[a-z]?)\s+(.+)$")

def extract_agenda(flat_lines) -> List[Dict]:
    # Placeholder: real agendas oft am Anfang konsolidiert; hier nur Inline-Erkennung
    agenda = []
    for entry in flat_lines:
        m = TOP_REGEX.match(entry["text"])
        if m:
            agenda.append({
                "code": m.group(1),
                "title": m.group(2),
                "start_page": entry["page"],
                "speech_indices": []
            })
    return agenda

def link_agenda(agenda, speeches):
    # Simple: if a speech starts on or after agenda start until next agenda
    if not agenda:
        return
    for idx, item in enumerate(agenda):
        next_start = agenda[idx+1]["start_page"] if idx+1 < len(agenda) else 10**9
        for sp in speeches:
            if item["start_page"] <= sp["start_page"] < next_start:
                item["speech_indices"].append(sp["index"])