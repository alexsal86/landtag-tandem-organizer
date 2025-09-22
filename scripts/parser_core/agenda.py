import re
from typing import List, Dict

TOP_REGEX_INLINE = re.compile(r"Ich rufe Punkt\s+(\d+)\s+der Tagesordnung auf", re.IGNORECASE)
TOP_CODE_REGEX = re.compile(r"^(TOP\s*\d+[a-z]?)\s+(.+)$")
INLINE_HEADING_STYLE = re.compile(r"^(Aktuelle Debatte|Zweite Beratung|Dritte Beratung|Beschlussempfehlung|Beratung des Gesetzesentwurfs)", re.IGNORECASE)

def extract_agenda(flat_lines) -> List[Dict]:
    agenda = []
    # Vorhandene TOC (falls später reingereicht) wird von außen gesetzt
    for entry in flat_lines:
        m = TOP_CODE_REGEX.match(entry["text"])
        if m:
            agenda.append({
                "code": m.group(1),
                "title": m.group(2),
                "start_page": entry["page"],
                "speech_indices": [],
                "source": "inline-top"
            })
        else:
            # Heuristik für im Fließtext deklarierte Agenda-Startsignale
            m2 = TOP_REGEX_INLINE.search(entry["text"])
            if m2:
                agenda.append({
                    "code": f"Punkt {m2.group(1)}",
                    "title": None,
                    "start_page": entry["page"],
                    "speech_indices": [],
                    "source": "callout"
                })
            elif INLINE_HEADING_STYLE.match(entry["text"]):
                # Mögliche Überschrift direkt nach Aufruf
                if agenda and agenda[-1]["title"] is None and agenda[-1]["start_page"] == entry["page"]:
                    agenda[-1]["title"] = entry["text"]
    return agenda

def link_agenda(agenda, speeches):
    if not agenda:
        return
    # Sort by start_page
    agenda.sort(key=lambda x: x["start_page"])
    for idx, item in enumerate(agenda):
        next_page = agenda[idx+1]["start_page"] if idx+1 < len(agenda) else 10**9
        for sp in speeches:
            if item["start_page"] <= sp["start_page"] < next_page:
                item["speech_indices"].append(sp["index"])
