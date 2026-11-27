#!/usr/bin/env python3
"""Parlis-Drucksachen (WP18) holen, Text extrahieren, Metadaten und Unterzeichner ableiten.

Beispiel:
    python scripts/parlis/extract_drucksachen.py \
        --ids V-246384,V-246399 --out /tmp/parlis.csv --sql /tmp/parlis.sql
    python scripts/parlis/extract_drucksachen.py --limit 20

Benötigt pypdf (pip install pypdf). Eingabe sind die Zeilen der Import-Migration
(--input-sql), damit der Lauf ohne Datenbankzugriff reproduzierbar ist. Ausgabe ist eine CSV (eine Zeile je Dokument)
und optional ein SQL-Skript mit UPDATEs auf public.parlis_proceedings.

Rotation: Drucksachen enthalten quer gedruckte Tabellen (Seite steht hochkant, der
Text ist um 90 Grad gedreht). Solche Seiten werden erkannt und in rotated_pages /
rotated_page_numbers ausgewiesen. Für die reine Textextraktion ist eine Seitendrehung
nicht nötig - gemessen liefert pypdf mit und ohne Drehung denselben Text. Tabellenzellen
dürfen auf gedrehten Seiten aber nicht aus Zeichenkoordinaten rekonstruiert werden (die
Zellen kommen dann als Zeichensalat zurück); dafür ist ein gerenderter Seitenausschnitt
vorgesehen, und genau dafür ist das Flag da.
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import http.cookiejar
import io
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

from pypdf import PdfReader

REPO = Path(__file__).resolve().parents[2]
DEFAULT_INPUT_SQL = REPO / "supabase/migrations/20261127141000_import_parlis_wp18.sql"
DEFAULT_ROSTER = REPO / "docs/election-analysis/sources/district-history-workbook.json"

DATE_RE = re.compile(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$")
ITEM_RE = re.compile(r"^(\d{1,2})\.\s")
SECTION_RE = re.compile(r"^[IVX]{1,4}\.(?:\s|$)")
HEAD_RE = re.compile(
    r"^(?:Kleine Anfrage|Große Anfrage|Mündliche Anfrage|Antrag|Begründung|Antwort|Stellungnahme)$"
)
ANCHOR_RE = re.compile(
    r"^(?:Ich frage die Landesregierung:|Der Landtag wolle beschließen,"
    r"|Die Landesregierung wird (?:gebeten|ersucht),)"
)
FURNITURE_RE = [
    re.compile(p)
    for p in (
        r"^Landtag von Baden-Württemberg( Drucksache \d+ / \d+)?$",
        r"^Drucksache \d+ / \d+$",
        r"^\d{1,2}\. Wahlperiode$",
        r"^\d{1,3}$",
        r"^Drucksachen und Plenarprotokolle sind im Internet$",
        r"^abrufbar unter: www\.landtag-bw\.de/Dokumente$",
        r"^Der Landtag druckt auf Recyclingpapier, ausgezeich-$",
        r"^net mit dem Umweltzeichen „Der Blaue Engel“\.$",
    )
]
PARTIES = r"AfD|CDU|SPD|GRÜNE|Bündnis 90/Die Grünen|FDP|fraktionslos|parteilos"
NAME_PARTY_RE = re.compile(rf"^(.+?)\s({PARTIES})$")
NAME_ITEM_RE = re.compile(
    r"^(?:(?:Dr\.|Prof\.)\s+)?(?:von\s+|van\s+|de\s+|zu\s+|Freiherr\s+von\s+)?"
    r"[A-ZÄÖÜ][\wäöüß.\-']*(?:\s+[A-ZÄÖÜ][\wäöüß\-']+)*$"
)
MINISTER_RE = re.compile(
    r"^(?:Dr\. )?([A-ZÄÖÜ][\wäöüß\-.]+)\s+"
    r"(Minister(?:in)?|Staatssekretär(?:in)?|Präsident(?:in)?)\b(.*)$"
)
MONTHS = "Januar Februar März April Mai Juni Juli August September Oktober November Dezember".split()


# --------------------------------------------------------------------------- Eingabe


def parse_input_rows(path: Path) -> list[dict]:
    """Liest die VALUES-Tupel der Import-Migration (SQL-Stringliterale inkl. '')."""
    sql = path.read_text(encoding="utf-8")
    body = sql[sql.index("VALUES") + len("VALUES") :]
    columns = [
        "legislature", "vorgangs_id", "dokumentnummer_intern", "drucksache",
        "vorgangstyp", "datum", "urheber", "ressort", "titel", "deskriptoren",
        "pdf_url", "dokument_url", "vorgang_text", "id",
    ]
    rows, current, value, i, n = [], [], None, 0, len(body)
    while i < n:
        ch = body[i]
        if ch == "'":
            i += 1
            buf = []
            while i < n:
                if body[i] == "'" and i + 1 < n and body[i + 1] == "'":
                    buf.append("'")
                    i += 2
                    continue
                if body[i] == "'":
                    break
                buf.append(body[i])
                i += 1
            value = "".join(buf)
            i += 1
            continue
        if ch == ",":
            if value is not None:
                current.append(value)
                value = None
            i += 1
            continue
        if ch == ")":
            if value is not None:
                current.append(value)
                value = None
            rows.append(current)
            current = []
            i += 1
            continue
        if ch in "( \n\r\t;":
            i += 1
            continue
        if ch.isdigit():
            j = i
            while j < n and body[j].isdigit():
                j += 1
            value = int(body[i:j])
            i = j
            continue
        i += 1
    return [dict(zip(columns, r)) for r in rows if len(r) == len(columns)]


def load_roster(path: Path, period: int = 18) -> list[dict]:
    """Abgeordnete der laufenden Wahlperiode aus dem Mitglieder-Workbook."""
    if path.suffix == ".csv":
        with path.open(encoding="utf-8") as fh:
            return [
                {"name": r["name"], "partei": r.get("partei", "")}
                for r in csv.DictReader(fh, delimiter=";")
            ]
    sheets = json.loads(path.read_text(encoding="utf-8"))["sheets"]
    roster = []
    for row in sheets.get("Abgeordnete 1952–2026", []):
        if isinstance(row, list) and len(row) > 8 and str(row[3]) == str(period):
            name, party = (row[7] or "").strip(), (row[8] or "").strip()
            if name:
                roster.append({"name": name, "partei": party})
    return roster


# --------------------------------------------------------------------------- Abruf


class Downloader:
    """Holt PDFs von landtag-bw.de. Die Seite schützt Downloads mit einer
    Proof-of-Work-Schranke (Enodia): einmal lösen, Cookie für den Rest des Laufs
    verwenden, danach mit Pause weiterladen."""

    def __init__(self, cache: Path, delay: float = 1.0):
        self.cache = cache
        self.delay = delay
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookies)
        )
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            ),
            "Accept": "application/pdf,text/html;q=0.9,*/*;q=0.8",
            "Accept-Language": "de-DE,de;q=0.9",
        }
        self.cache.mkdir(parents=True, exist_ok=True)

    def _fetch(self, url: str) -> bytes:
        request = urllib.request.Request(url, headers=self.headers)
        try:
            return self.opener.open(request, timeout=120).read()
        except urllib.error.HTTPError as error:
            return error.read()

    @staticmethod
    def _envelope(html: str) -> str:
        match = re.search(r'window\.chl\s*=\s*"([^"]+)"', html)
        if not match:
            raise RuntimeError("Bot-Schranke ohne lösbare Aufgabe")
        return match.group(1)

    def _verify(self, envelope: str) -> tuple[int, str]:
        challenge = json.loads(base64.b64decode(envelope.split(".")[0]))["content"]["challenge"]
        solution = 0
        while hashlib.sha256(f"{challenge}{solution}".encode()).hexdigest()[:4] != "0000":
            solution += 1
        request = urllib.request.Request(
            "https://www.landtag-bw.de/.enodia/verify",
            data=f"{solution}-{envelope}".encode(),
            headers=self.headers,
            method="POST",
        )
        try:
            response = self.opener.open(request, timeout=60)
            return response.status, response.read().decode().strip()
        except urllib.error.HTTPError as error:
            return error.code, error.read().decode("utf-8", "replace").strip()

    def _solve(self, html: str) -> None:
        """Löst die Schranke und setzt das Cookie.

        Antwortet der Verifikations-Endpunkt mit 400, ist der Rumpf keine
        Schlüssel, sondern die nächste Aufgabe - dann wird diese gelöst. Erst
        ein 200-Rumpf ist das Cookie.
        """
        envelope = self._envelope(html)
        for _ in range(4):
            status, body = self._verify(envelope)
            if status == 200 and body:
                self.cookies.set_cookie(
                    http.cookiejar.Cookie(
                        0, "enodia", body, None, False, ".landtag-bw.de", False, False,
                        "/", True, False, None, False, None, None, {},
                    )
                )
                return
            if status == 400 and "." in body:
                envelope = body
                continue
            time.sleep(5)
        raise RuntimeError("Bot-Schranke nach mehreren Versuchen nicht gelöst")

    def get(self, url: str, key: str) -> bytes:
        cached = self.cache / f"{key}.pdf"
        if cached.exists():
            return cached.read_bytes()
        for attempt in range(8):
            body = self._fetch(url)
            if body[:4] == b"%PDF":
                cached.write_bytes(body)
                time.sleep(self.delay)
                return body
            html = body.decode("utf-8", "replace")
            if "enodia" not in html.lower():
                # Manche Drucksachen sind nicht als PDF abrufbar. Das ist kein
                # Rate-Limit: sofort melden, damit der Lauf weiterläuft.
                detail = " ".join(html.split())[:120]
                raise RuntimeError(f"kein PDF ({len(body)} Byte): {detail}")
            try:
                self._solve(html)
            except RuntimeError:
                # Rate-Limit: abwarten statt den Lauf zu verlieren.
                time.sleep(20 * (attempt + 1))
            else:
                time.sleep(2)
        raise RuntimeError(f"Download fehlgeschlagen: {url}")


# --------------------------------------------------------------------------- Rotation


def rotated_text_share(page) -> float:
    """Anteil der Textoperationen, die um 90/270 Grad gedreht gesetzt werden.

    Ausgewertet wird die Textmatrix (Tm): bei gedrehtem Text sind b und c
    ungleich null. Das erkennt quer gedruckte Tabellenseiten, ohne die Seite
    vorher rendern zu müssen.
    """
    total = rotated = 0
    try:
        for operands, operation in page.get_contents().operations:
            if operation != b"Tm" or len(operands) < 6:
                continue
            a, b, c, d = (float(x) for x in operands[:4])
            total += 1
            # b/c ungleich null = um 90/270 Grad gesetzter Text
            if abs(b) > 0.01 or abs(c) > 0.01:
                rotated += 1
    except Exception:  # beschädigte Streams dürfen den Lauf nicht abbrechen
        return 0.0
    return rotated / total if total else 0.0


# --------------------------------------------------------------------------- Aufbereitung


def iso(day: str, month: str, year: str) -> str:
    return f"{year}-{int(month):02d}-{int(day):02d}"


def join_hyphen(previous: str, following: str) -> str:
    """Trennstrich am Zeilenende entfernen, echte Bindestriche behalten."""
    return previous + ("-" if following[:1].isupper() else "") + following


def normalized(text: str) -> str:
    return re.sub(r"[\s\-–]+", "", text).lower()


def is_item(line: str) -> bool:
    match = ITEM_RE.match(line)
    return bool(match) and int(match.group(1)) <= 20


def read_blocks(pdf: bytes) -> tuple[list[str], dict, int, list[int]]:
    reader = PdfReader(io.BytesIO(pdf))
    meta: dict = {}
    raw: list[str] = []
    rotated_pages: list[int] = []
    for number, page in enumerate(reader.pages, start=1):
        if rotated_text_share(page) >= 0.3:
            rotated_pages.append(number)
        for line in (page.extract_text() or "").replace("\r", "").split("\n"):
            line = line.strip()
            if not line:
                continue
            match = re.match(
                r"^Eingegangen: (\d{1,2})\.(\d{1,2})\.(\d{4}) / "
                r"Ausgegeben: (\d{1,2})\.(\d{1,2})\.(\d{4})$",
                line,
            )
            if match:
                meta["eingegangen"] = iso(*match.group(1, 2, 3))
                meta["ausgegeben"] = iso(*match.group(4, 5, 6))
                continue
            raw.append(line)
    kept = []
    for line in raw:
        if any(pattern.match(line) for pattern in FURNITURE_RE):
            continue
        match = DATE_RE.match(line)
        if match and meta.get("eingegangen") == iso(*match.group(1, 2, 3)):
            continue  # Fußzeilendatum = Eingangsdatum
        kept.append(line)
    blocks: list[str] = []
    modes: list[str] = []
    for line in kept:
        heading = bool(
            HEAD_RE.match(line) or DATE_RE.match(line) or ANCHOR_RE.match(line)
            or MINISTER_RE.match(line)
        )
        if not blocks or heading or is_item(line) or SECTION_RE.match(line):
            blocks.append(line)
            modes.append("heading" if heading else "item")
            continue
        if modes[-1] == "heading":
            blocks.append(line)
            modes.append("item")
            continue
        previous = blocks[-1]
        if previous.endswith(("-", "–")):
            blocks[-1] = join_hyphen(previous[:-1].rstrip(), line)
        elif previous.endswith((".", "!", "?", ":", ";")):
            blocks.append(line)
            modes.append("item")
        else:
            blocks[-1] = previous + " " + line
    cleaned = [re.sub(r"[ \t]{2,}", " ", block).strip() for block in blocks]
    return [block for block in cleaned if block], meta, len(reader.pages), rotated_pages


def parse_name_list(block: str) -> tuple[list[str], str] | None:
    """'A, Dr. B, von C AfD' -> (['A','Dr. B','von C'], 'AfD')."""
    body, party = block, ""
    match = NAME_PARTY_RE.match(block)
    if match:
        body, party = match.group(1), match.group(2)
    parts = [part.strip(" ,") for part in body.split(",") if part.strip(" ,")]
    if not parts or len(parts) > 40:
        return None
    for part in parts:
        if len(part.split()) > 5 or not NAME_ITEM_RE.match(part):
            return None
        if re.search(r"\b(und|der|die|das|für|mit)\s*$", part):
            return None
    return parts, party


def take_signature(lines: list[str]) -> tuple[list[str], dict]:
    signature = {
        "names": [], "party": "", "whole_faction": False, "raw": "",
    }
    while lines and DATE_RE.match(lines[-1].strip()):
        lines.pop()
    if lines and re.fullmatch(r"und (die )?Fraktion", lines[-1].strip()):
        signature["whole_faction"] = True
        lines.pop()
    elif lines and re.search(r"\s+und\s+(?:die\s+)?Fraktion$", lines[-1].strip()):
        signature["whole_faction"] = True
        lines[-1] = re.sub(r"\s+und\s+(?:die\s+)?Fraktion$", "", lines[-1].strip())
    if lines:
        parsed = parse_name_list(lines[-1].strip())
        if parsed:
            signature["names"], signature["party"] = parsed
            signature["raw"] = lines[-1].strip()
            lines.pop()
    return lines, signature


def take_answer_signature(lines: list[str]) -> tuple[list[str], dict]:
    """Zieht Name und Amtsbezeichnung der antwortenden Person ab (z. B. 'Hagel
    Minister des Inneren, für Digitalisierung und Europa')."""
    while lines and DATE_RE.match(lines[-1].strip()):
        lines.pop()
    if lines:
        match = MINISTER_RE.match(lines[-1].strip())
        if match:
            lines.pop()
            return lines, {"name": match.group(1), "role": (match.group(2) + match.group(3)).strip(" ,")}
    return lines, {}


def resolve_signer(name: str, party: str, roster: list[dict]) -> tuple[str, str]:
    """Löst einen Nachnamen gegen die Abgeordneten der Wahlperiode auf.

    Es wird nur gegen Amtsinhaber verglichen. Bleiben mehrere Kandidaten übrig,
    bleibt der Rohname stehen - eine falsche Zuordnung ist schlimmer als keine.
    """
    base = re.sub(r"^(?:Dr\.|Prof\.)\s+", "", name).strip()
    tokens = [token.lower() for token in base.split()]
    candidates = [
        entry for entry in roster
        if entry["name"].lower().split()[-len(tokens):] == tokens
    ]
    if party:
        candidates = [c for c in candidates if c["partei"] == party] or candidates
    unique = {entry["name"] for entry in candidates}
    if len(unique) == 1:
        return candidates[0]["name"], "sicher"
    return name, ("mehrdeutig" if unique else "unbekannt")


def parse_document(pdf: bytes, row: dict, roster: list[dict]) -> dict:
    blocks, meta, pages, rotated_pages = read_blocks(pdf)
    start = next((i for i, block in enumerate(blocks) if ANCHOR_RE.match(block)), 0)
    body = blocks[start:]
    begin = next((i for i, block in enumerate(body) if block == "Begründung"), None)
    answer_heading = "Stellungnahme" if row["vorgangstyp"] == "Antrag" else "Antwort"
    occurrences = [i for i, block in enumerate(body) if block == answer_heading]
    # Eine "Antwort"-Überschrift vor der Begründung gehört zur Titelseite; die
    # inhaltliche Antwort steht immer nach der Begründung.
    after_reasoning = [i for i in occurrences if begin is None or i > begin]
    answer_start = after_reasoning[0] if after_reasoning else (occurrences[0] if occurrences else None)
    question_end = (
        begin if begin is not None
        else answer_start if answer_start is not None
        else len(body)
    )
    question, signature = take_signature(body[:question_end].copy())
    reasoning = body[begin + 1 : answer_start] if (begin is not None and answer_start is not None) else []
    answer, answer_signature = take_answer_signature(
        body[answer_start + 1 :] if answer_start is not None else []
    )
    repeated = {normalized(block) for block in question}
    answer = [block for block in answer if normalized(block) not in repeated]

    main_name = row["urheber"].split("(")[0].strip()
    main_surname = re.sub(r"^(?:Dr\.|Prof\.)\s+", "", main_name).split()[-1] if main_name else ""
    party_hint = signature["party"]
    if not party_hint:
        match = re.match(r"Fraktion der (\w+)", row["urheber"])
        party_hint = match.group(1) if match else ""

    signers, statuses = [], []
    for name in signature["names"]:
        full_name, status = resolve_signer(name, party_hint, roster)
        statuses.append(status)
        if name.split()[-1].lower() == main_surname.lower():
            continue  # Haupteinbringer steht bereits in urheber
        signers.append(full_name)

    full_text = "\n".join(blocks)
    result = {
        **row,
        **meta,
        "wahlperiode": row["legislature"],
        "drucksache_nr": (re.search(r"(\d+/\d+)", row["drucksache"]) or [None, ""])[1],
        "pdf_seiten": pages,
        "pdf_bytes": len(pdf),
        "rotated_pages": ";".join(str(page) for page in rotated_pages),
        "signers": "; ".join(signers),
        "signer_count": len(signers),
        "signer_party": signature["party"] or party_hint,
        "signers_raw": signature["raw"],
        "faction_co_signed": signature["whole_faction"],
        "signer_resolution": ", ".join(sorted(set(statuses))) if statuses else "",
        "answer_signatory": answer_signature.get("name", ""),
        "answer_signatory_role": answer_signature.get("role", ""),
        "question_count": 0,
        "question_text": "\n".join(question).strip(),
        "reasoning_text": "\n".join(reasoning).strip(),
        "answer_text": "\n".join(answer).strip(),
    }

    match = re.search(
        r"Mit Schreiben vom (\d{1,2})\. (\w+) (\d{4}) Nr\. ([\w.\-/]+)", full_text
    )
    if match:
        result["answer_letter_date"] = iso(
            match.group(1), MONTHS.index(match.group(2)) + 1, match.group(3)
        )
        result["answer_file_reference"] = match.group(4)
    match = re.search(
        r"im Einvernehmen mit dem (.+?) die (?:Kleine|Große) Anfrage", full_text, re.S
    )
    if match:
        result["answer_co_ministries"] = "; ".join(
            part.strip(" ,.")
            for part in re.split(r",\s*dem\s+|\s+und\s+dem\s+", match.group(1))
        )
    result["answer_references"] = "; ".join(
        dict.fromkeys(re.findall(r"auf die Drucksache (\d+/\d+)", full_text))
    )
    grouped = re.search(
        r"(?:Die )?Ziffer(?:n)? ([\d][\d,\s]*(?:bis\s+\d+|und\s+\d+)?) "
        r"(?:wird|werden) aufgrund des Sachzusammenhangs gemeinsam",
        full_text,
    )
    result["answer_mode"] = (
        f"gebündelt: {re.sub(r'\s+', ' ', grouped.group(1)).strip()}"
        if grouped
        else ("gebündelt" if "Stellung genommen" in full_text else "einzeln")
    )

    count, expected = 0, 1
    for block in question:
        if SECTION_RE.match(block):
            expected = 1
            continue
        match = ITEM_RE.match(block)
        if match and int(match.group(1)) == expected:
            count += 1
            expected += 1
    result["question_count"] = count

    try:
        result["processing_days"] = (
            date.fromisoformat(result["ausgegeben"])
            - date.fromisoformat(result["eingegangen"])
        ).days
    except (KeyError, ValueError):
        result["processing_days"] = ""
    return result


# --------------------------------------------------------------------------- Ausgabe

CSV_COLUMNS = [
    "vorgangs_id", "drucksache", "drucksache_nr", "vorgangstyp", "wahlperiode",
    "datum", "eingegangen", "ausgegeben", "processing_days", "urheber",
    "signers", "signer_count", "signer_party", "signers_raw", "faction_co_signed",
    "signer_resolution", "ressort", "answer_signatory", "answer_signatory_role",
    "answer_letter_date", "answer_file_reference", "answer_co_ministries",
    "answer_references", "answer_mode", "question_count", "titel", "deskriptoren",
    "pdf_seiten", "pdf_bytes", "rotated_pages", "question_text", "reasoning_text",
    "answer_text", "pdf_url",
]


def sql_literal(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def details_payload(row: dict) -> dict:
    """JSON, das die App beim Öffnen eines Vorgangs nachlädt.

    Der Volltext bleibt bewusst außerhalb der Datenbank: 730 Dokumente mit
    zusammen mehreren Megabyte Text gehören nicht in Zeilen, die bei jeder
    Listenabfrage mitgelesen werden.
    """
    return {
        "schemaVersion": 1,
        "vorgangsId": row["vorgangs_id"],
        "drucksache": row["drucksache_nr"],
        "vorgangstyp": row["vorgangstyp"],
        "titel": row["titel"],
        "eingegangen": row.get("eingegangen", ""),
        "ausgegeben": row.get("ausgegeben", ""),
        "signers": [name.strip() for name in row["signers"].split(";") if name.strip()],
        "signerParty": row["signer_party"],
        "wholeFaction": bool(row["faction_co_signed"]),
        "signersRaw": row["signers_raw"],
        "signerResolution": row["signer_resolution"],
        "answer": {
            "signatory": row.get("answer_signatory", ""),
            "role": row.get("answer_signatory_role", ""),
            "letterDate": row.get("answer_letter_date", ""),
            "fileReference": row.get("answer_file_reference", ""),
            "coMinistries": [
                part.strip()
                for part in (row.get("answer_co_ministries") or "").split(";")
                if part.strip()
            ],
            "references": [
                part.strip()
                for part in (row.get("answer_references") or "").split(";")
                if part.strip()
            ],
            "mode": row.get("answer_mode", ""),
        },
        "questionCount": row["question_count"],
        "questionText": row["question_text"],
        "reasoningText": row["reasoning_text"],
        "answerText": row["answer_text"],
        "rotatedPages": [int(page) for page in (row["rotated_pages"] or "").split(";") if page],
        "pdfUrl": row["pdf_url"],
    }


def write_details(directory: Path, row: dict) -> None:
    """Schreibt die Detaildatei eines Vorgangs sofort.

    Damit überlebt ein langer Lauf einen Abbruch: bereits ausgelesene Vorgänge
    liegen als JSON vor, der Rest wird beim nächsten Start nachgeholt.
    """
    directory.mkdir(parents=True, exist_ok=True)
    (directory / f"{row['vorgangs_id']}.json").write_text(
        json.dumps(details_payload(row), ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def sql_updates(rows: list[dict]) -> str:
    lines = ["-- Unterzeichner und Extraktionsmetadaten je Vorgang.", "BEGIN;"]
    for row in rows:
        lines.append(
            "UPDATE public.parlis_proceedings SET "
            f"signers = {sql_literal(row['signers'])}, "
            f"signer_count = {sql_literal(row['signer_count'])}, "
            f"signer_party = {sql_literal(row['signer_party'])}, "
            f"signers_raw = {sql_literal(row['signers_raw'])}, "
            f"faction_co_signed = {sql_literal(row['faction_co_signed'])} "
            f"WHERE legislature = {row['legislature']} "
            f"AND vorgangs_id = {sql_literal(row['vorgangs_id'])};"
        )
    lines.append("COMMIT;")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input-sql", type=Path, default=DEFAULT_INPUT_SQL)
    parser.add_argument("--roster", type=Path, default=DEFAULT_ROSTER,
                        help="Mitglieder-Workbook (JSON) oder CSV mit name;partei")
    parser.add_argument("--ids", default="", help="Kommagetrennte vorgangs_id-Liste")
    parser.add_argument("--types", default="Kleine Anfrage,Große Anfrage,Antrag")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--sql", type=Path)
    parser.add_argument(
        "--json-dir", type=Path,
        help="Ein JSON je Vorgang ablegen (z. B. public/parlis)",
    )
    parser.add_argument("--cache", type=Path, default=REPO / ".cache/parlis-pdf")
    parser.add_argument("--delay", type=float, default=1.0, help="Pause zwischen Downloads")
    args = parser.parse_args()

    rows = parse_input_rows(args.input_sql)
    roster = load_roster(args.roster)
    if not roster:
        print("Kein Abgeordnetenregister geladen - Abbruch.", file=sys.stderr)
        return 1
    wanted_types = {value.strip() for value in args.types.split(",") if value.strip()}
    selected = [row for row in rows if row["vorgangstyp"] in wanted_types]
    if args.ids:
        ids = {value.strip() for value in args.ids.split(",") if value.strip()}
        selected = [row for row in selected if row["vorgangs_id"] in ids]
    if args.limit:
        selected = selected[: args.limit]
    if not selected:
        print("Keine Vorgänge ausgewählt.", file=sys.stderr)
        return 1

    downloader = Downloader(args.cache, delay=args.delay)
    results = []
    skipped = []
    for index, row in enumerate(selected, start=1):
        try:
            pdf = downloader.get(row["pdf_url"], row["vorgangs_id"])
        except RuntimeError as error:
            skipped.append((row["vorgangs_id"], str(error)))
            print(f"[{index}/{len(selected)}] {row['vorgangs_id']} FEHLER: {error}", flush=True)
            continue
        parsed = parse_document(pdf, row, roster)
        results.append(parsed)
        print(
            f"[{index}/{len(selected)}] {parsed['drucksache_nr']:>7} "
            f"{parsed['vorgangstyp']:<15} Unterzeichner: {parsed['signer_count']:>2} "
            f"({parsed['signer_resolution'] or '-'}) "
            f"rotierte Seiten: {parsed['rotated_pages'] or '-'}",
            flush=True,
        )
        if args.json_dir:
            write_details(args.json_dir, parsed)

    with args.out.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=CSV_COLUMNS, quoting=csv.QUOTE_ALL, extrasaction="ignore"
        )
        writer.writeheader()
        writer.writerows(results)
    print(f"CSV: {args.out} ({len(results)} Dokumente)")
    if skipped:
        print(f"Nicht abrufbar ({len(skipped)}): " + ", ".join(entry[0] for entry in skipped))

    if args.sql:
        args.sql.write_text(sql_updates(results), encoding="utf-8")
        print(f"SQL: {args.sql}")

    if args.json_dir:
        print(f"JSON: {args.json_dir} ({len(results)} Dateien)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
