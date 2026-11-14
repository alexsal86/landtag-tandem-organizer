#!/usr/bin/env python3
"""Build the independent election-analysis seed, leaving mandates untouched.
Usage: python scripts/import-election-analysis.py workbook.xlsx output.sql
Requires openpyxl. Provenance URLs are deliberately not imported.
"""
from pathlib import Path
import json
import sys
import openpyxl

BALLOT = {'Einzelstimme': 'single', 'Erststimme': 'first', 'Zweitstimme': 'second'}
PARTIES = ['GRÜNE', 'CDU', 'SPD', 'FDP', 'AfD']
PERIODS = {2006: 14, 2011: 15, 2016: 16, 2021: 17, 2026: 18}
def percentage(value):
    if value is None: return None
    if not 0 <= float(value) <= 1: raise ValueError(f'Ungültiger Anteil {value}')
    return round(float(value) * 100, 5)
def party(value):
    normalized = str(value).strip().upper()
    return {'FDP/DVP':'FDP','FDP':'FDP','AFD':'AfD','GRÜNE':'GRÜNE','CDU':'CDU','SPD':'SPD'}.get(normalized, value)

def rows(sheet):
    return [r for i, r in enumerate(sheet.values, 1) if i >= 5 and any(v is not None for v in r)]
def generate(input_path, output_path):
    w = openpyxl.load_workbook(input_path, read_only=True, data_only=True)
    tables = {}
    tables['years'] = [dict(year=year, period_number=period, is_published=True,
        notes='Fünf ausgewählte Parteien; keine vollständige Parteienliste.') for year, period in PERIODS.items()]
    state = []
    for year, period, ballot, name, votes, share, seats, valid, _, note in rows(w['Landesergebnisse 2006-2026']):
        if year not in PERIODS or period != PERIODS[year]: raise ValueError('Unbekannte Wahlperiode')
        state.append(dict(year=year, ballot=BALLOT[ballot], party=party(name), votes=votes, share=percentage(share), seats=seats, valid_votes=valid, notes=note))
    tables['state'] = state
    shares = {}
    for number, name, year, ballot, *rest in rows(w['Wahlergebnisse 2006-2026']):
        key = (year, BALLOT[ballot], int(number))
        if key in shares: raise ValueError('Doppelte Wahlkreisanteile')
        shares[key] = dict(name=name, values=rest[:5], note=rest[6])
    districts, turnout = [], []
    for r in rows(w['Wahlbeteiligung und Stimmen']):
        number, name, year, ballot, eligible, voters, participation, valid = r[:8]
        key = (year, BALLOT[ballot], int(number))
        share = shares.pop(key)
        if name != share['name']: raise ValueError('Widersprüchlicher Wahlkreisname')
        preliminary = 'vorläufig' in str(r[14]).lower()
        note = '; '.join(dict.fromkeys(str(value) for value in (r[14], share['note']) if value)) or None
        if year == 2006 and int(number) == 59:
            note = (note or '') + '; Vergleich auf Wahlkreiszuschnitt 2011; Wert aus Landesgesamtzahl und 69 übrigen Wahlkreisen ermittelt.'
        turnout.append(dict(year=year, ballot=key[1], district_number=int(number), district_name=name,
            eligible=eligible, voters=voters, valid_votes=valid, turnout=percentage(participation), preliminary=preliminary, notes=note))
        for index, p in enumerate(PARTIES):
            districts.append(dict(year=year, ballot=key[1], district_number=int(number), district_name=name,
                party=p, votes=r[8+index], share=percentage(share['values'][index]), preliminary=preliminary, notes=note))
    if shares: raise ValueError('Wahlkreisanteile ohne absolute Stimmenzeile')
    tables['districts'], tables['turnout'] = districts, turnout
    flows = []
    for year, previous, target, partner, inflow, outflow, balance, note, _ in rows(w['Wählerwanderungen']):
        if inflow is not None and outflow is not None and balance is not None and inflow-outflow != balance:
            raise ValueError('Widersprüchlicher Wanderungssaldo')
        flows.append(dict(year=year, previous_year=previous, target_party=party(target), partner=party(partner), inflow=inflow, outflow=outflow, balance=balance, notes=note))
    tables['flows'] = flows
    tables['demographics'] = [dict(year=r[0], ballot=BALLOT[r[1]], party=party(r[2]), gender=r[3], age_group=r[4], share=percentage(r[5]), notes=r[7]) for r in rows(w['Alter und Geschlecht'])]
    types = {'year':'integer','period_number':'integer','is_published':'boolean','votes':'bigint','share':'numeric','seats':'integer','valid_votes':'bigint','district_number':'integer',
        'preliminary':'boolean','eligible':'bigint','voters':'bigint','turnout':'numeric','previous_year':'integer','inflow':'bigint','outflow':'bigint','balance':'bigint'}
    sql = ['-- Independent analysis only: no mandate/person/legislature updates.', 'BEGIN;']
    natural_keys = {
        'years': ['year'], 'state': ['year','ballot','party'],
        'districts': ['year','ballot','district_number','party'], 'turnout': ['year','ballot','district_number'],
        'flows': ['year','previous_year','target_party','partner'], 'demographics': ['year','ballot','party','gender','age_group'],
    }
    for name, data in tables.items():
        if len({tuple(row[key] for key in natural_keys[name]) for row in data}) != len(data):
            raise ValueError(f'Doppelte Analyseschlüssel in {name}')
        keys = list(data[0])
        encoded = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
        tag = '$analysis_data$'
        while tag in encoded: tag = tag[:-1] + '_$'
        definitions = ','.join(f'{key} {types.get(key,"text")}' for key in keys)
        columns = ','.join(keys)
        sql.append(f'INSERT INTO public.election_analysis_{name}({columns})\nSELECT {columns} FROM jsonb_to_recordset({tag}{encoded}{tag}::jsonb) AS x({definitions})\nON CONFLICT DO NOTHING;')
    sql.append('COMMIT;')
    Path(output_path).write_text('\n'.join(sql)+'\n')
    print(json.dumps({name:len(data) for name,data in tables.items()}))
if __name__ == '__main__':
    if len(sys.argv)!=3: raise SystemExit(__doc__)
    generate(sys.argv[1],sys.argv[2])
