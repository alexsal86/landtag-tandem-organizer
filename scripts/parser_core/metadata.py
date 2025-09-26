```python
import re
from typing import Dict, Optional

def parse_session_info(text: str) -> Dict[str, Optional[str]]:
    """
    Extrahiert Sitzungsmetadaten aus dem Text eines Plenarprotokolls.
    Erweitert um Extraktion von Beginn, Schluss und Mittagspause.
    
    Args:
        text (str): Der gesamte normalisierte Text des PDFs.
    
    Returns:
        Dict[str, Optional[str]]: Metadaten mit Sitzungsnummer, Legislaturperiode,
        Datum, Startzeit, Endzeit, Ort und optional Mittagspause.
    """
    meta: Dict[str, Optional[str]] = {
        "number": None,
        "legislative_period": None,
        "date": None,
        "start_time": None,
        "end_time": None,
        "location": None,
        "lunch_break": None
    }
    
    # Sitzungsnummer und Legislaturperiode
    session_re = re.compile(r"Plenarprotokoll\s+(\d+)/(\d+)", re.IGNORECASE)
    session_match = session_re.search(text)
    if session_match:
        meta["legislative_period"] = session_match.group(1)
        meta["number"] = session_match.group(2)
    
    # Datum (z. B. "16. Juli 2025" oder "16.07.2025")
    date_re = re.compile(r"(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})", re.IGNORECASE)
    date_match = date_re.search(text)
    if date_match:
        day, month, year = date_match.groups()
        month_map = {
            "januar": "01", "februar": "02", "märz": "03", "april": "04",
            "mai": "05", "juni": "06", "juli": "07", "august": "08",
            "september": "09", "oktober": "10", "november": "11", "dezember": "12"
        }
        month_num = month_map.get(month.lower())
        if month_num:
            meta["date"] = f"{year}-{month_num}-{day.zfill(2)}"
    
    # Startzeit (z. B. "Beginn: 9.00 Uhr" oder "Sitzung beginnt um 09:00 Uhr")
    start_time_re = re.compile(r"(?:Beginn|Sitzung beginnt um)\s*(\d{1,2})[.:](\d{2})\s*(?:Uhr)?", re.IGNORECASE)
    start_time_match = start_time_re.search(text)
    if start_time_match:
        hour, minute = start_time_match.groups()
        meta["start_time"] = f"{hour.zfill(2)}:{minute}:00"
    
    # Endzeit (z. B. "Schluss: 17.30 Uhr" oder "Sitzung endet um 17:30 Uhr")
    end_time_re = re.compile(r"(?:Schluss|Sitzung endet um)\s*(\d{1,2})[.:](\d{2})\s*(?:Uhr)?", re.IGNORECASE)
    end_time_match = end_time_re.search(text)
    if end_time_match:
        hour, minute = end_time_match.groups()
        meta["end_time"] = f"{hour.zfill(2)}:{minute}:00"
    
    # Mittagspause (z. B. "Mittagspause von 12:30 bis 14:00 Uhr")
    lunch_break_re = re.compile(r"(?:Mittagspause|Unterbrechung)\s*von\s*(\d{1,2})[.:](\d{2})\s*(?:Uhr)?\s*bis\s*(\d{1,2})[.:](\d{2})\s*(?:Uhr)?", re.IGNORECASE)
    lunch_break_match = lunch_break_re.search(text)
    if lunch_break_match:
        start_hour, start_minute, end_hour, end_minute = lunch_break_match.groups()
        meta["lunch_break"] = f"{start_hour.zfill(2)}:{start_minute}:00-{end_hour.zfill(2)}:{end_minute}:00"
    
    # Ort (z. B. "Ort: Stuttgart" oder "Sitzung in Stuttgart")
    location_re = re.compile(r"(?:Ort|Sitzung in)\s*:\s*([A-Za-zäöüÄÖÜß\s-]+)", re.IGNORECASE)
    location_match = location_re.search(text)
    if location_match:
        meta["location"] = location_match.group(1).strip()
    
    return meta
```
