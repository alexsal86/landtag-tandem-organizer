#!/usr/bin/env python3
"""Generate an idempotent SQL import from the supplied member workbook.
No per-row provenance, inferred identities, electoral results or dates are stored.
Requires openpyxl. Usage: python scripts/import-election-history.py input.xlsx output.sql
"""
import collections
import json
from pathlib import Path
import re
import sys
import uuid
import openpyxl

NAMESPACE = uuid.UUID('b8bcb073-e7c1-49ce-b11a-115c44f77bf0')
def identifier(*parts):
    return str(uuid.uuid5(NAMESPACE, json.dumps(parts, ensure_ascii=False)))
def text(value):
    return str(value).strip() if value is not None else None

def generate(input_path, output_path):
    workbook = openpyxl.load_workbook(input_path, read_only=True, data_only=True)
    sheet = workbook['Abgeordnete je Wahlkreis']
    rows = [row for row in sheet.values if len(row) >= 12 and isinstance(row[3], int)]
    if not rows:
        raise ValueError('Keine Mandatseinträge gefunden')
    periods = {}
    numbered_names = collections.defaultdict(set)
    for row in rows:
        name, number, year, period = text(row[0]), text(row[1]), int(row[2]), int(row[3])
        if number:
            numbered_names[(period, int(number))].add(name)
        if period in periods and periods[period]['election_year'] != year:
            raise ValueError('Widersprüchliche Wahljahre')
        periods[period] = dict(id=identifier('period', period), number=period, name=f'{period}. Legislaturperiode', election_year=year)
    districts, mandates = {}, []
    seen = set()
    for row in rows:
        name, number, _, period, person, raw_party, group, original, successor, left_early, note, _ = row
        period, person, name, number = int(period), text(person), text(name), text(number)
        key = (period, person)
        if key in seen:
            raise ValueError(f'Doppelte Person innerhalb einer Periode: {key}')
        seen.add(key)
        district_id = None
        if name not in ('Landesliste (landesweit)', 'Ohne Wahlkreis (Landesliste)'):
            district_id = identifier('district', period, name, number)
            conflict = bool(number and len(numbered_names[(period, int(number))]) > 1)
            districts[district_id] = dict(id=district_id, period_id=identifier('period', period),
                district_number=int(number) if number and not conflict else None,
                number_label=number, name=name,
                boundary_note=('Wahlkreisnummer in dieser Periode mit unterschiedlichen Namen belegt; Zuordnung noch zu prüfen.' if conflict
                    else None))
        raw_party = text(raw_party)
        party = re.split(r',|\s*\(', raw_party)[0].strip()
        if party.lower() == 'grüne':
            party = 'GRÜNE'
        mandates.append(dict(id=identifier('mandate', period, person), period_id=identifier('period', period),
            person_name=person, party=party, party_label=raw_party, district_id=district_id,
            mandate_type='direct' if group == 'Wahlkreisgewinner' else 'list',
            original_mandate=text(original), entry_type='succession' if successor == 'Ja' or re.match(r'Nach(rück|folg)', text(original) or '') else 'election',
            left_early=left_early == 'Ja', notes=text(note)))
    def payload(value):
        encoded = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
        tag = '$election_data$'
        while tag in encoded:
            tag = tag[:-1] + '_$'
        return tag + encoded + tag + '::jsonb'
    sql = ["-- Historical member data: drafts, unknown dates and no inferred person identities.", 'BEGIN;']
    sql.append('''INSERT INTO public.election_history_periods(id,number,name,election_year)
SELECT id,number,name,election_year FROM jsonb_to_recordset(''' + payload(list(periods.values())) + ''') AS x(id uuid,number integer,name text,election_year integer)
ON CONFLICT (number) DO NOTHING;''')
    # Resolve the natural period number, so existing manually created periods keep their IDs.
    p_numbers = {p['id']: p['number'] for p in periods.values()}
    for d in districts.values():
        d['period_number'] = p_numbers[d.pop('period_id')]
    for m in mandates:
        m['period_number'] = p_numbers[m.pop('period_id')]
    sql.append('''INSERT INTO public.election_history_districts(id,period_id,district_number,number_label,name,boundary_note)
SELECT x.id,p.id,CASE WHEN EXISTS (SELECT 1 FROM public.election_history_districts existing WHERE existing.period_id=p.id AND existing.district_number=x.district_number AND existing.id<>x.id) THEN NULL ELSE x.district_number END,x.number_label,x.name,x.boundary_note FROM jsonb_to_recordset(''' + payload(list(districts.values())) + ''') AS x(id uuid,period_number integer,district_number integer,number_label text,name text,boundary_note text)
JOIN public.election_history_periods p ON p.number=x.period_number
ON CONFLICT (id) DO NOTHING;''')
    sql.append('''INSERT INTO public.election_history_mandates(id,period_id,person_name,party,party_label,district_id,mandate_type,original_mandate,entry_type,left_early,notes)
SELECT x.id,p.id,x.person_name,x.party,x.party_label,x.district_id,x.mandate_type,x.original_mandate,x.entry_type,x.left_early,x.notes FROM jsonb_to_recordset(''' + payload(mandates) + ''') AS x(id uuid,period_number integer,person_name text,party text,party_label text,district_id uuid,mandate_type text,original_mandate text,entry_type text,left_early boolean,notes text)
JOIN public.election_history_periods p ON p.number=x.period_number
ON CONFLICT (id) DO NOTHING;''')
    sql.append('COMMIT;')
    Path(output_path).write_text('\n'.join(sql) + '\n')
    print(json.dumps(dict(periods=len(periods), districts=len(districts), mandates=len(mandates), numbered_conflicts=sum(len(v)>1 for v in numbered_names.values()), sql_bytes=Path(output_path).stat().st_size)))

if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    generate(sys.argv[1], sys.argv[2])
