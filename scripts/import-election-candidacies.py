#!/usr/bin/env python3
"""Emit the reviewed candidate workbook payload for the election-history migration."""
import csv
import hashlib
import json
import re
import sys
import uuid
from collections import defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'docs/election-analysis/sources'
PARTIES = ['CDU', 'SPD', 'Grüne', 'FDP/DVP', 'AfD']
DUAL_2016 = {
    (30, 'AfD', 'jörg meuthen'): ('af1a55a7-f0e7-5385-8006-12c2c3b53d7b', 17),
    (44, 'FDP/DVP', 'hans-ulrich rülke'): ('ac2e31b0-366e-5c61-b516-e7e3c8c8e464', 42),
}
DUAL_SOURCE = 'https://www.statistik-bw.de/presse/pressemitteilungen/pressemitteilung/baden-wuerttemberg-hat-gewaehlt/'
MEMBERS = ROOT / 'supabase/migrations/20261114110000_historical_election_members.sql'


def name_key(name):
    return ' '.join(re.sub(r'\b(?:dr|prof)\.\s*', '', name.casefold()).split())


def district_key(name):
    value = re.sub(r'[^\w]', '', name.casefold().replace('-stadt ', ' ').replace('ß', 'ss'))
    return {'kirchheimunterteck': 'kirchheim', 'esslingenamneckar': 'esslingen',
            'vaihingenenz': 'vaihingen', 'heichingenmünsingen': 'hechingenmünsingen'}.get(value, value)


def party_key(party):
    return {'fdp': 'FDP/DVP', 'grüne': 'Grüne', 'afd': 'AfD'}.get(party.casefold(), party)


def collect(path):
    sheets = {s.title: list(s.values) for s in openpyxl.load_workbook(path, read_only=True, data_only=True)}
    archived = json.loads((SOURCES / 'district-history-workbook.json').read_text())['sheets']
    periods = {int(r[2]): int(r[3]) for r in archived['Abgeordnete 1952–2026'][4:] if len(r) > 3 and str(r[3]).isdigit()}
    registry = {district_key(r['name']): r['key']
                for r in csv.DictReader((SOURCES / '1952-district-registry.csv').read_text().splitlines())}
    _, historical_districts, mandates = [json.loads(p) for p in re.findall(r'\$election_data\$(.*?)\$election_data\$', MEMBERS.read_text(), re.S)]
    district_by_id = {r['id']: r for r in historical_districts}
    mandates_by_name = defaultdict(list)
    for mandate in mandates:
        mandates_by_name[name_key(mandate['person_name'])].append(mandate)

    main = {(r[0], r[1], district_key(r[2])): r for r in sheets['Wahlkreise gesamt 1952–2026'][5:]
            if len(r) >= 29 and isinstance(r[0], int)}
    exact_first = {r[0]: r for r in sheets['2026 Erststimmen'][5:] if r and isinstance(r[0], int)}
    official = json.loads((SOURCES / 'state-lists-2026.json').read_text())
    nominations = {(e['district_number'], party_key(e['party'])): e for e in official['entries'] if e['candidacy_role'] == 'direct'}
    corrected_2006 = defaultdict(dict)
    review = defaultdict(list)
    for new, old in zip(sheets['Wahlkreise gesamt 1952–2026'][5:], archived['Wahlkreise gesamt 1952–2026'][5:], strict=True):
        if not new or new[0] != 2006:
            continue
        for field, value, previous in zip(
                ['Beteiligung','CDU','SPD','FDP/DVP','Grüne','AfD','REP','NPD','Sonstige'],
                new[8:17], old[8:17]):
            if value != previous:
                corrected_2006[new[1]][field] = value
    rows = defaultdict(list)

    def add(year, number, district, party, name, share, votes, status, sheet, line, source, result=None):
        key = (year, number, district_key(district), party_key(party), name_key(name))
        rows[key].append(dict(name=name, district=district, share=share, votes=votes, status=status,
                              sheet=sheet, row=line, source=source, result=result))

    for title, entries in sheets.items():
        if not title.startswith(('Unterlegene ', 'Ohne Mandat ')):
            continue
        for line, row in enumerate(entries[5:], 6):
            if len(row) < 10 or periods.get(row[1]) != row[0] or row[0] is None:
                continue
            _, year, number, district, party, name = row[:6]
            if title.startswith('Unterlegene'):
                votes, share, _, status, source, result = row[6:12]
            else:
                share, status = row[6:8]
                votes = None
                if title == 'Ohne Mandat Archive 1976–88':
                    source, result = row[8], None
                elif title in ('Ohne Mandat FR 1976–1996', 'Ohne Mandat PF 1988–1996', 'Ohne Mandat 1980 Freiburg'):
                    source, result = row[9], None
                else:
                    source, result = row[10:12] if year != 1952 and title != 'Ohne Mandat 1952–64 Einzel' else row[9:11]
            add(year, number, district, party, name, share, votes, status, title, line, source, result)

    for line, row in enumerate(sheets['Wahlkreise gesamt 1952–2026'][5:], 6):
        if len(row) < 29 or not isinstance(row[0], int):
            continue
        for party, name in zip(PARTIES, row[23:28]):
            if name:
                shares = dict(zip(['CDU','SPD','FDP/DVP','Grüne','AfD'], row[9:14]))
                share = exact_first[row[1]][4 + ['CDU','SPD','FDP/DVP','Grüne','AfD'].index(party)] if row[0] == 2026 else shares[party]
                add(*row[:3], party, name, share, None, 'Kein Mandat laut Hauptblatt',
                    'Wahlkreise gesamt 1952–2026', line, None, row[21])

    slots = defaultdict(list)
    for key in rows:
        slots[key[:4]].append(key)
    payload = []
    for (year, number, district, party), keys in sorted(slots.items(), key=lambda pair: str(pair[0])):
        sources = [r for key in keys for r in rows[key]]
        detail = sources[0]
        period = periods[year]
        issues = []
        roster = nominations.get((number, party)) if year == 2026 else None
        if len(keys) != 1:
            if roster and sum(k[4] == name_key(roster['person_name']) for k in keys) == 1:
                key = next(k for k in keys if k[4] == name_key(roster['person_name']))
                review['abweichende Namensformen 2026'].append([year, number, party, [r['name'] for r in sources]])
                sources = rows[key]
                detail = sources[0]
            else:
                issues.append('Abweichende Namen für denselben Wahlvorschlag')
        name = detail['name']
        if roster and name_key(roster['person_name']) != name_key(name):
            issues.append('Name weicht von der amtlichen Nominierung 2026 ab')
        if roster and name_key(roster['person_name']) == name_key(name):
            name = roster['person_name']
        main_row = main.get((year, number, district))
        if main_row and main_row[3] and name_key(main_row[3]) == name_key(name):
            # The historical detail sheets can include a direct winner in error.
            issues.append('Hauptblatt führt die Person als direkt gewählt')
        matches = []
        same_name = mandates_by_name[name_key(name)]
        for m in same_name:
            d = district_by_id.get(m['district_id'])
            if party_key(m['party']) == party and d and district_key(d['name']) == district:
                if m['period_number'] != period or number is None or d['district_number'] == number or d['number_label'] == f'{number:02}':
                    matches.append(m)
            elif roster and m['period_number'] == period and not d and party_key(m['party']) == party:
                matches.append(m)
        current = [m for m in matches if m['period_number'] == period]
        dual = DUAL_2016.get((number, party, name_key(name))) if year == 2016 else None
        if dual:
            mandate_id, other_number = dual
            verified = next(m for m in same_name if m['id'] == mandate_id)
            assert district_by_id[verified['district_id']]['district_number'] == other_number
            matches = [verified]
            sources = [dict(detail, source=DUAL_SOURCE), *sources]
        # Link with a recorded mandate ID supported by the same locality and party.
        # Reuse other periods only through the existing connection/person binding.
        anchors = current or matches
        intended_list = any('Zweitmandat' in r['status'] for r in sources)
        if intended_list and not any(m['entry_type'] == 'election' and m['mandate_type'] == 'list' for m in current):
            issues.append('Zweitmandat ohne übereinstimmenden Mandatsbeleg')
        if any(m['entry_type'] == 'election' and m['mandate_type'] == 'direct' for m in current):
            issues.append('Vorhandenes Direktmandat widerspricht dem Bewerberblatt')
        if current and all(m['entry_type']=='succession' for m in current) and intended_list:
            issues.append('Zweitmandat und Nachrücken widersprechen sich')
        if same_name and not anchors:
            issues.append('Mandat unter gleichem Namen, Identität offen')
        source_key = registry.get(district) if year == 1952 else None
        if year == 1952 and not source_key:
            issues.append('Regionaler Wahlkreisschlüssel 1952 fehlt')
        share = next((r['share'] for r in sources if r['share'] is not None), None)
        if year == 2026:
            share = exact_first[number][4 + ['CDU','SPD','FDP/DVP','Grüne','AfD'].index(party)]
        if year == 2006 and party in corrected_2006[number]:
            # The corrected district sheet supersedes rounded values in the research tab.
            share = corrected_2006[number][party]
        for issue in issues:
            review[issue].append([year, number, party, name])
        stable_key = f'{year}:{number or source_key or district}:{party}:{name_key(name)}'
        payload.append(dict(id=str(uuid.uuid5(uuid.NAMESPACE_URL, f'landtagsos:candidacy:{stable_key}')),
                            new_person=str(uuid.uuid5(uuid.NAMESPACE_URL, f'landtagsos:nominee:{stable_key}')),
                            year=year, period=period, number=number, district=detail['district'], source_key=source_key,
                            party=party, name=name, share=share, votes=next((r['votes'] for r in sources if r['votes'] is not None), None),
                            anchors=[m['id'] for m in anchors], current=[m['id'] for m in current], issues=issues, sources=sources,
                            roster=roster))
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return digest, payload, review


if __name__ == '__main__':
    digest, payload, review = collect(Path(sys.argv[1]))
    print(json.dumps({'sha256': digest, 'rows': payload}, ensure_ascii=False, separators=(',', ':')))
    print(json.dumps({k: len(v) for k, v in review.items()}, ensure_ascii=False), file=sys.stderr)
