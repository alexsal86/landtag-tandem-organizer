import requests
from bs4 import BeautifulSoup
from pathlib import Path
import time

BASE_URL = "https://www.landtag-bw.de/de/dokumente/plenarprotokolle"
SAVE_DIR = Path("downloads/plenarprotokolle")
SAVE_DIR.mkdir(parents=True, exist_ok=True)

def get_protokoll_links():
    resp = requests.get(BASE_URL)
    soup = BeautifulSoup(resp.content, "html.parser")
    links = []
    # Die genaue CSS-Klasse/Struktur kann variieren, ggf. anpassen!
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.endswith(".pdf") and "resource/blob" in href:
            # Absolute URL bauen
            if not href.startswith("http"):
                full_url = "https://www.landtag-bw.de" + href
            else:
                full_url = href
            links.append(full_url)
    return links

def download_pdf(url, save_dir):
    local_name = url.split("/")[-1]
    out_path = save_dir / local_name
    if out_path.exists():
        print(f"Bereits vorhanden: {local_name}")
        return
    print(f"Lade herunter: {local_name}")
    r = requests.get(url)
    out_path.write_bytes(r.content)
    time.sleep(2)  # Netiquette: Pausiere zwischen Downloads!

if __name__ == "__main__":
    links = get_protokoll_links()
    print(f"Insgesamt {len(links)} Protokolle gefunden.")
    for link in links:
        download_pdf(link, SAVE_DIR)