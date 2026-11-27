#!/usr/bin/env python3
"""Erzeugt aus den PARLIS-CSV je Wahlperiode eine SQL-Importdatei.

Die Dateien schreiben in public.parlis_proceedings und aktualisieren bereits
vorhandene Zeilen derselben Wahlperiode (Upsert über legislature + vorgangs_id).
Abweichende PDF- und Dokumentlinks in der Datenbank bleiben erhalten, damit
redaktionelle Korrekturen nicht überschrieben werden.

Aufruf:
    python3 scripts/generate_parlis_import_sql.py \
        --csv-dir exports --out-dir supabase/migrations \
        --first-timestamp 20261128031000
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
from pathlib import Path

COLUMNS = [
    "vorgangs_id",
    "dokumentnummer_intern",
    "drucksache",
    "vorgangstyp",
    "datum",
    "urheber",
    "ressort",
    "titel",
    "deskriptoren",
    "pdf_url",
    "dokument_url",
    "vorgang_text",
    "id",
]
CHUNK = 200

UPDATE_COLUMNS = [
    "dokumentnummer_intern",
    "drucksache",
    "vorgangstyp",
    "datum",
    "urheber",
    "ressort",
    "titel",
    "deskriptoren",
    "vorgang_text",
    "id",
]


def literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def date_literal(value: str) -> str:
    value = value.strip()
    if not value:
        return "NULL"
    dt.date.fromisoformat(value)
    return literal(value)


def read_rows(path: Path, period: int) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        missing = set(COLUMNS) - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{path.name}: Spalten fehlen: {sorted(missing)}")
        rows = [{column: (row[column] or "") for column in COLUMNS} for row in reader]
    if not rows:
        raise ValueError(f"{path.name}: keine Zeilen")
    ids = [row["vorgangs_id"] for row in rows]
    if len(ids) != len(set(ids)):
        raise ValueError(f"{path.name}: vorgangs_id ist nicht eindeutig")
    for row in rows:
        if not row["vorgangs_id"].strip():
            raise ValueError(f"{path.name}: Zeile ohne vorgangs_id")
        date_literal(row["datum"])
    print(f"WP{period}: {len(rows):,} Zeilen".replace(",", "."))
    return rows


def statement(period: int, rows: list[dict[str, str]]) -> str:
    values = ",\n".join(
        "  ("
        + ", ".join(
            [
                str(period),
                literal(row["vorgangs_id"]),
                literal(row["dokumentnummer_intern"]),
                literal(row["drucksache"]),
                literal(row["vorgangstyp"]),
                date_literal(row["datum"]),
                literal(row["urheber"]),
                literal(row["ressort"]),
                literal(row["titel"]),
                literal(row["deskriptoren"]),
                literal(row["pdf_url"]),
                literal(row["dokument_url"]),
                literal(row["vorgang_text"]),
                literal(row["id"]),
            ]
        )
        + ")"
        for row in rows
    )
    updates = ",\n  ".join(
        f"{column} = EXCLUDED.{column}" for column in UPDATE_COLUMNS
    )
    updates += (
        ",\n  pdf_url = COALESCE(NULLIF(public.parlis_proceedings.pdf_url, ''), EXCLUDED.pdf_url)"
        ",\n  dokument_url = COALESCE(NULLIF(public.parlis_proceedings.dokument_url, ''), EXCLUDED.dokument_url)"
    )
    return (
        "INSERT INTO public.parlis_proceedings (legislature, "
        + ", ".join(COLUMNS)
        + ") VALUES\n"
        + values
        + f"\nON CONFLICT (legislature, vorgangs_id) DO UPDATE SET\n  {updates};\n"
    )


def build(period: int, rows: list[dict[str, str]], source: str) -> str:
    header = (
        f"-- Quelle: {source}, {len(rows)} Vorgänge der {period}. Wahlperiode.\n"
        "-- Vorhandene Zeilen derselben Wahlperiode werden aktualisiert; abweichende\n"
        "-- PDF- und Dokumentlinks in der Datenbank bleiben erhalten.\n"
        "BEGIN;\n"
        "SET LOCAL standard_conforming_strings = on;\n"
        "ALTER TABLE public.parlis_proceedings ALTER COLUMN datum DROP NOT NULL;\n\n"
    )
    body = "\n".join(
        statement(period, rows[offset : offset + CHUNK])
        for offset in range(0, len(rows), CHUNK)
    )
    return header + body + "\nCOMMIT;\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv-dir", default="exports", type=Path)
    parser.add_argument("--out-dir", default="supabase/migrations", type=Path)
    parser.add_argument("--first-timestamp", default="20261128031000")
    parser.add_argument("--last-period", default=18, type=int)
    parser.add_argument("--first-period", default=9, type=int)
    args = parser.parse_args()

    timestamp = dt.datetime.strptime(args.first_timestamp, "%Y%m%d%H%M%S")
    for period in range(args.first_period, args.last_period + 1):
        source = args.csv_dir / f"parlis-wp{period}.csv"
        if not source.exists():
            raise SystemExit(f"{source} fehlt")
        rows = read_rows(source, period)
        target = args.out_dir / (
            timestamp.strftime("%Y%m%d%H%M%S") + f"_import_parlis_wp{period}.sql"
        )
        target.write_text(build(period, rows, source.name), encoding="utf-8")
        print(f"  -> {target} ({target.stat().st_size / 1024 / 1024:.1f} MB)")
        timestamp += dt.timedelta(minutes=1)


if __name__ == "__main__":
    main()
