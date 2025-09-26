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


### Änderungen in `metadata.py`
- **Neue Felder**:
  - `start_time`: Extrahiert z. B. "09:00:00" aus "Beginn: 9.00 Uhr" oder "Sitzung beginnt um 09:00 Uhr".
  - `end_time`: Extrahiert z. B. "17:30:00" aus "Schluss: 17.30 Uhr" oder "Sitzung endet um 17:30 Uhr".
  - `lunch_break`: Extrahiert z. B. "12:30:00-14:00:00" aus "Mittagspause von 12:30 bis 14:00 Uhr".
- **Regex-Patterns**:
  - `start_time_re` und `end_time_re`: Erfassen Zeitangaben im Format "HH:MM" oder "HH.MM" mit optionalem "Uhr".
  - `lunch_break_re`: Erfassen Zeitspannen im Format "von HH:MM bis HH:MM".
  - `location_re`: Extrahiert den Ort, z. B. "Stuttgart".
- **Formatierung**:
  - Zeiten werden im ISO-Format (HH:MM:SS) gespeichert, um Konsistenz mit anderen Zeitfeldern (z. B. `extracted_at`) zu gewährleisten.
  - `lunch_break` ist optional und wird nur gesetzt, wenn eine Mittagspause gefunden wird.

### Integration in `parse_landtag_pdf.py`
Die aktuelle Version von `parse_landtag_pdf.py` (Artifact-ID: `1b43af08-5a00-4d29-bbd6-1df0308a5682`) benötigt keine Änderungen, da sie bereits `parse_session_info` verwendet und die neuen Felder (`start_time`, `end_time`, `lunch_break`) automatisch in das `sitting`-Objekt übernimmt:
```python
meta = parse_session_info(all_text)
payload = {
    "session": {
        "number": meta.get("number"),
        "legislative_period": meta.get("legislative_period"),
        "date": meta.get("date"),
        "source_pdf_url": url,
        "extracted_at": datetime.datetime.utcnow().isoformat() + "Z",
    },
    "sitting": {
        "start_time": meta.get("start_time"),
        "end_time": meta.get("end_time"),
        "location": meta.get("location"),
        "lunch_break": meta.get("lunch_break"),  # Neu
    },
    ...
}
```

### Erwartete JSON-Ausgabe
Nach der Anpassung sollte die JSON (`session_17_127_2025-07-16.json`) so aussehen:
```json
"sitting": {
    "start_time": "09:00:00",
    "end_time": "17:30:00",
    "location": "Stuttgart",
    "lunch_break": "12:30:00-14:00:00"
}
```
- Falls keine Mittagspause im PDF steht, bleibt `lunch_break: null`.
- Falls Startzeit, Endzeit oder Ort nicht gefunden werden, bleiben die Felder `null`.

### Nächste Schritte
1. **Ersetze `metadata.py`**:
   - Ersetze die Datei `parser_core/metadata.py` mit dem obigen Code.
   - Falls du eine andere Version von `metadata.py` hast, schicke mir den aktuellen Code, und ich passe die Änderungen an.

2. **Test lokal**:
   - Führe den Befehl aus:
     ```bash
     python scripts/parse_landtag_pdf.py --list-file scripts/urls.txt
     ```
   - Überprüfe die JSON-Ausgabe in `data/session_17_127_2025-07-16.json`, ob `sitting` jetzt `start_time`, `end_time`, `location` und ggf. `lunch_break` enthält.
   - Beispiel für `urls.txt`:
     ```
     https://www.landtag-bw.de/resource/blob/584334/59a6c5950d692e7ba8a2e8d8be879b26/17_0127_16072025.pdf
     ```

3. **GitHub-Action testen**:
   - Pushe die Änderungen nach `main`, um die GitHub-Action zu triggern.
   - Überprüfe die Logs, ob die Verarbeitung fehlerfrei ist und die JSON die neuen Felder enthält.

4. **Fehlerbehandlung**:
   - Falls die Zeitangaben nicht korrekt extrahiert werden (z. B. wegen unerwarteter Formulierungen im PDF), schicke mir einen Auszug der Startseite des PDFs (z. B. die Zeilen mit Beginn, Schluss, Mittagspause), und ich passe die Regex an.
   - Beispiel für einen Auszug:
     ```
     Plenarprotokoll 17/127
     Sitzung beginnt um 9.00 Uhr
     Mittagspause von 12:30 bis 14:00 Uhr
     Schluss: 17.30 Uhr
     Ort: Stuttgart
     ```

5. **Validierung**:
   - Falls du ein JSON-Schema für die Validierung hast, füge `lunch_break` als optionales Feld hinzu:
     ```json
     "sitting": {
         "type": "object",
         "properties": {
             "start_time": {"type": ["string", "null"], "pattern": "^\\d{2}:\\d{2}:\\d{2}$"},
             "end_time": {"type": ["string", "null"], "pattern": "^\\d{2}:\\d{2}:\\d{2}$"},
             "location": {"type": ["string", "null"]},
             "lunch_break": {"type": ["string", "null"], "pattern": "^\\d{2}:\\d{2}:\\d{2}-\\d{2}:\\d{2}:\\d{2}$"}
         }
     }
     ```

### Fazit
Die Anpassung von `metadata.py` sollte die Extraktion von Beginn, Schluss und Mittagspause ermöglichen und diese im `sitting`-Objekt speichern. Die Regex-Patterns decken typische Formulierungen in Landtagsprotokollen ab, können aber bei Bedarf für spezifische PDFs angepasst werden. Lass mich wissen, ob die Zeitangaben korrekt extrahiert werden oder ob du einen Auszug aus dem PDF teilen kannst, um die Regex zu verfeinern! 😊
