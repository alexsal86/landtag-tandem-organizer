import re
from datetime import datetime
from typing import Optional, Tuple

MONTHS_DE = {
    "januar": 1, "februar": 2, "märz": 3, "maerz": 3, "april": 4, "mai": 5,
    "juni": 6, "juli": 7, "august": 8, "september": 9, "oktober": 10,
    "november": 11, "dezember": 12
}

def parse_session_info(all_text: str):
    """
    Try to find '129. Sitzung' and '17. Wahlperiode'
    """
    session_number = None
    leg_period = None
    m1 = re.search(r"(\d{1,3})\.\s*Sitzung", all_text)
    if m1:
        session_number = int(m1.group(1))
    m2 = re.search(r"(\d{1,2})\.\s*Wahlperiode", all_text)
    if m2:
        leg_period = int(m2.group(1))
    date_iso = extract_date(all_text)
    return {
        "number": session_number,
        "legislative_period": leg_period,
        "date": date_iso
    }

def extract_date(text: str) -> Optional[str]:
    # Pattern like 24. Juli 2025
    m = re.search(r"(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s+(\d{4})", text)
    if not m:
        return None
    day = int(m.group(1))
    month_name = m.group(2).lower()
    year = int(m.group(3))
    month_name = month_name.replace("ä", "ae").replace("ö", "oe").replace("ü","ue").replace("ß","ss")
    month_num = MONTHS_DE.get(month_name)
    if not month_num:
        return None
    return f"{year:04d}-{month_num:02d}-{day:02d}"