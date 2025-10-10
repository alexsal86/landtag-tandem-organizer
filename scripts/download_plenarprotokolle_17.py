import requests
from pathlib import Path

BASE_URL = "https://www.landtag-bw.de/ajax/filterlist/de/plenarprotokolle-509800?noFilterSet=true&offset={offset}"

SAVE_DIR = Path("downloads/plenarprotokolle_17")
SAVE_DIR.mkdir(parents=True, exist_ok=True)

def fetch_json(BASE_URL):
    response = requests.get(BASE_URL)
    if not response.content.strip():
        print("Fehler: Leere Antwort vom Server.")
        print("Status Code:", response.status_code)
        return None
    try:
        return response.json()
    except ValueError:
        print("Fehler: Die Antwort ist kein gültiges JSON.")
        print("Antwort-Text:", response.text)
        return None
        
def fetch_all_protokolle():
    offset = 0
    all_items = []
    while True:
        url = BASE_URL.format(offset=offset)
        resp = requests.get(url)
        data = resp.json()
        items = data.get("result", [])
        if not items:
            break
        all_items.extend(items)
        offset += len(items)
    return all_items

def get_pdf_links(items):
    pdf_links = []
    for item in items:
        # Filter auf Wahlperiode 17 (meist im Titel oder eigenen Feld)
        if "17. Wahlperiode" in item.get("title", "") or "17. Wahlperiode" in item.get("subtitle", ""):
            for doc in item.get("documents", []):
                url = doc.get("url")
                if url and url.endswith(".pdf"):
                    full_url = url if url.startswith("http") else "https://www.landtag-bw.de" + url
                    pdf_links.append(full_url)
    return pdf_links

def download_pdf(url, save_dir):
    local_name = url.split("/")[-1]
    out_path = save_dir / local_name
    if out_path.exists():
        print(f"Bereits vorhanden: {local_name}")
        return
    print(f"Lade herunter: {local_name}")
    r = requests.get(url)
    out_path.write_bytes(r.content)

def main():
    data = fetch_json(BASE_URL)
    if data is None:
        print("Download fehlgeschlagen.")
        exit(1)
    # Hier kannst du mit den Daten weiter arbeiten
    print("Erfolgreich geladen:", data)

if __name__ == "__main__":
    items = fetch_all_protokolle()
    print(f"{len(items)} Protokolle insgesamt gefunden.")
    pdf_links = get_pdf_links(items)
    print(f"{len(pdf_links)} Protokolle der 17. Wahlperiode gefunden.")
    for link in pdf_links:
        download_pdf(link, SAVE_DIR)
