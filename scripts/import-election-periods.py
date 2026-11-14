#!/usr/bin/env python3
"""Import the workbook's sourced Wahlperioden sheet, preserving existing dates.
Usage: python scripts/import-election-periods.py workbook.xlsx output.sql
Separate from result imports because this explicitly supplements history periods.
"""
from datetime import date, datetime
import json
from pathlib import Path
import sys
import openpyxl


def generate(input_path, output_path):
    workbook = openpyxl.load_workbook(input_path, read_only=True, data_only=True)
    periods = []
    for row in workbook['Wahlperioden'].iter_rows(min_row=5, values_only=True):
        if not any(value is not None for value in row):
            continue
        number, year, election, start, end, note, election_source, term_source = row
        if not isinstance(number, int) or not isinstance(year, int):
            raise ValueError('Ungültige Wahlperiode')
        if not all(isinstance(value, (date, datetime)) for value in (election, start, end)) or not election <= start <= end:
            raise ValueError(f'Ungültige Termine für Wahlperiode {number}')
        if not all(isinstance(url, str) and url.startswith('https://') for url in (election_source, term_source)):
            raise ValueError(f'Quellen fehlen für Wahlperiode {number}')
        expected = 'zukünftig' in (note or '').lower()
        periods.append(dict(period_number=number, election_year=year,
            election_date=election.date().isoformat(), starts_on=start.date().isoformat(),
            ends_on=None if expected else end.date().isoformat(),
            expected_ends_on=end.date().isoformat() if expected else None,
            election_source_url=election_source, term_source_url=term_source, notes=note))
    if len(periods) != 18 or {p['period_number'] for p in periods} != set(range(1, 19)):
        raise ValueError('Erwartet werden alle 18 Wahlperioden ohne Duplikate')
    encoded = json.dumps(periods, ensure_ascii=False, separators=(',', ':'))
    tag = '$period_data$'
    while tag in encoded:
        tag = tag[:-1] + '_$'
    sql = '''-- Source: supplied landtagsabgeordnete_bw_mit_wahlergebnissen_1952_2026.xlsx,
-- sheet Wahlperioden. Explicit period supplement; result imports stay independent.
BEGIN;
INSERT INTO public.election_analysis_period_proposals AS existing
(period_number,election_year,election_date,starts_on,ends_on,expected_ends_on,election_source_url,term_source_url,verified,notes)
SELECT period_number,election_year,election_date,starts_on,ends_on,expected_ends_on,election_source_url,term_source_url,true,notes
FROM jsonb_to_recordset(''' + tag + encoded + tag + '''::jsonb) AS x(
period_number integer,election_year integer,election_date date,starts_on date,ends_on date,
expected_ends_on date,election_source_url text,term_source_url text,notes text)
ON CONFLICT(period_number) DO UPDATE SET
 starts_on=coalesce(existing.starts_on,excluded.starts_on),
 ends_on=coalesce(existing.ends_on,excluded.ends_on),
 expected_ends_on=coalesce(existing.expected_ends_on,excluded.expected_ends_on),
 term_source_url=CASE WHEN existing.starts_on IS NULL AND existing.ends_on IS NULL
 THEN excluded.term_source_url ELSE existing.term_source_url END,
 notes=CASE WHEN existing.starts_on IS NULL AND existing.ends_on IS NULL
 THEN excluded.notes ELSE existing.notes END
WHERE existing.verified AND existing.election_year=excluded.election_year
 AND existing.election_date=excluded.election_date;

-- Fill missing history fields only. Existing inheritance/validation triggers remain active.
UPDATE public.election_history_periods p SET
 election_year=coalesce(p.election_year,s.election_year),
 election_date=coalesce(p.election_date,s.election_date),
 starts_on=coalesce(p.starts_on,s.starts_on),
 ends_on=coalesce(p.ends_on,s.ends_on,s.expected_ends_on),
 expected_ends_on=coalesce(p.expected_ends_on,s.expected_ends_on),
 source_url=coalesce(nullif(p.source_url,''),s.term_source_url)
FROM public.election_analysis_period_proposals s
WHERE p.number=s.period_number AND s.verified
 AND (p.election_year IS NULL OR p.election_year=s.election_year)
 AND (p.election_date IS NULL OR p.election_date=s.election_date)
 AND (p.starts_on IS NULL OR p.starts_on=s.starts_on)
 AND (p.ends_on IS NULL OR p.ends_on=coalesce(s.ends_on,s.expected_ends_on));
COMMIT;
'''
    sql = sql.replace('COMMIT;', '''CREATE OR REPLACE FUNCTION public.apply_verified_election_period(period_number_to_apply integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE proposal public.election_analysis_period_proposals; current_row public.election_history_periods; changed public.election_history_periods;
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins' USING ERRCODE='42501'; END IF;
 SELECT * INTO proposal FROM public.election_analysis_period_proposals WHERE period_number=period_number_to_apply AND verified;
 IF NOT FOUND THEN RAISE EXCEPTION 'Kein amtlich bestätigter Terminvorschlag'; END IF;
 SELECT * INTO current_row FROM public.election_history_periods WHERE number=period_number_to_apply FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Legislaturperiode fehlt'; END IF;
 IF current_row.election_year IS NOT NULL AND current_row.election_year<>proposal.election_year THEN RAISE EXCEPTION 'Vorhandenes Wahljahr widerspricht dem Vorschlag; zuerst manuell prüfen'; END IF;
 -- Fill only missing values; never replace already entered/confirmed dates.
 UPDATE public.election_history_periods SET
  election_year=coalesce(election_year,proposal.election_year),election_date=coalesce(election_date,proposal.election_date),
  starts_on=coalesce(starts_on,proposal.starts_on),ends_on=coalesce(ends_on,proposal.ends_on,proposal.expected_ends_on),
  expected_ends_on=coalesce(expected_ends_on,proposal.expected_ends_on),source_url=coalesce(nullif(source_url,''),nullif(proposal.term_source_url,''),proposal.election_source_url)
 WHERE id=current_row.id RETURNING * INTO changed;
 RETURN jsonb_build_object('before',to_jsonb(current_row),'after',to_jsonb(changed),'existing_dates_preserved',true);
END $$;
COMMIT;''')
    Path(output_path).write_text(sql)
    workbook.close()


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    generate(sys.argv[1], sys.argv[2])
