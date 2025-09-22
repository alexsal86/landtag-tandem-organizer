import re
from datetime import datetime
from typing import Optional, Tuple

MONTHS_DE = {
    "januar": 1, "februar": 2, "märz": 3, "maerz": 3, "april": 4, "mai": 5,
    "juni": 6, "juli": 7, "august": 8, "september": 9, "oktober": 10,
    "november": 11, "dezember": 12
}

TIME_LINE_REGEX = re.compile(r"Beginn:\s*(\d{1,2}:\d{2})\s*Uhr.*Schluss:\s*(\d{1,2}:\d{2})\s*Uhr", re.IGNORECASE)
LOCATION_LINE_REGEX = re.compile(r"(Stuttgart|[^,]+),\s*(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),\s*\d{1,2}\.\s*[A-Za-zÄÖÜäöüß]+\s+\d{4}\s*•\s*(.+)$")

def parse_session_info(all_text: str):
    session_number = None
    leg_period = None
    m1 = re.search(r"(\d{1,3})\.\s*Sitzung", all_text)
    if m1:
        session_number = int(m1.group(1))
    m2 = re.search(r"(\d{1,2})\.\s*Wahlperiode", all_text)
    if m2:
        leg_period = int(m2.group(1))
    date_iso = extract_date(all_text)
    header_extra = parse_header_extras(all_text)
    return {
        "number": session_number,
        "legislative_period": leg_period,
        "date": date_iso,
        **header_extra
    }

def extract_date(text: str) -> Optional[str]:
    m = re.search(r"(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s+(\d{4})", text)
    if not m:
        return None
    day = int(m.group(1))
    month_name = m.group(2).lower()
    month_name = month_name.replace("ä", "ae").replace("ö", "oe").replace("ü","ue").replace("ß","ss")
    month_num = MONTHS_DE.get(month_name)
    if not month_num:
        return None
    year = int(m.group(3))
    return f"{year:04d}-{month_num:02d}-{day:02d}"

def parse_header_extras(text: str):
    """
    Liefert: start_time, end_time, location (sofern extrahierbar, times als HH:MM)
    """
    start_time = end_time = location = None
    tm = TIME_LINE_REGEX.search(text)
    if tm:
        start_time, end_time = tm.group(1), tm.group(2)
    # Ort/Location
    for line in text.splitlines():
        lm = LOCATION_LINE_REGEX.search(line)
        if lm:
            location = lm.group(2).strip()
            break
    return {
        "start_time": start_time,
        "end_time": end_time,
        "location": location
    }
