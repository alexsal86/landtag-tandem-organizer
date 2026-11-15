#!/usr/bin/env python3
"""Generate the additive state-history migration from the supplied workbook.
No historical minor-party results, mandate data or inferred zeroes are imported.
Existing rows are compared under a write lock and never overwritten.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import openpyxl

FOCUS = {'CDU', 'SPD', 'FDP', 'GRÜNE', 'AfD'}
NAMES = {'Grüne': 'GRÜNE', 'Andere': 'SONSTIGE', 'Linke': 'DIE LINKE',
         'Nichtwähler': 'NICHTWÄHLENDE', 'Erstwähler/Verstorbene': 'ERSTWÄHLENDE/VERSTORBENE',
         'Zu-/Fortgezogene': 'ZU-/FORTGEZOGENE'}
HISTORY_SOURCE = 'https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistische_Berichte/423525001.pdf'
FINAL_SOURCE = 'https://www.baden-wuerttemberg.de/de/service/presse/pressemitteilung/pid/endgueltiges-ergebnis-der-landtagswahl-2026'
MATRIX_SOURCE = 'https://www.infratest-dimap.de/fileadmin/_migrated/content_uploads/BW_0603_Wahlreport_II.pdf'

def norm(name):
    return NAMES.get(name, name)

def literal(value):
    return "'" + str(value).replace("'", "''") + "'"

def records(rows):
    return '$workbook$' + json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + '$workbook$::jsonb'

SCHEMA = '''-- Additive workbook import; source documents have NOT been independently verified.
-- The SHA-256 below identifies the uploaded workbook, never a linked PDF.
BEGIN;
CREATE TABLE public.election_analysis_state_totals (
 year integer NOT NULL REFERENCES public.election_analysis_years(year),
 ballot text NOT NULL CHECK(ballot IN ('single','first','second')),
 election_date date NOT NULL, eligible bigint NOT NULL CHECK(eligible>0),
 voters bigint NOT NULL CHECK(voters>=0 AND voters<=eligible),
 valid_votes bigint NOT NULL CHECK(valid_votes>=0 AND valid_votes<=voters),
 invalid_votes bigint NOT NULL CHECK(invalid_votes>=0),
 source_url text NOT NULL CHECK(source_url LIKE 'https://%'),
 source_sheet text NOT NULL, source_row integer NOT NULL CHECK(source_row>0),
 workbook_sha256 text NOT NULL CHECK(workbook_sha256 ~ '^[a-f0-9]{64}$'),
 source_verified boolean NOT NULL DEFAULT false,
 PRIMARY KEY(year,ballot), CHECK(valid_votes+invalid_votes=voters)
);
CREATE TABLE public.election_analysis_flow_matrix (
 year integer NOT NULL REFERENCES public.election_analysis_years(year),
 previous_year integer NOT NULL CHECK(previous_year<year),
 origin text NOT NULL, destination text NOT NULL,
 persons bigint NOT NULL CHECK(persons>=0),
 source_url text NOT NULL CHECK(source_url LIKE 'https://%'),
 source_sheet text NOT NULL, source_row integer NOT NULL CHECK(source_row>0),
 workbook_sha256 text NOT NULL CHECK(workbook_sha256 ~ '^[a-f0-9]{64}$'),
 source_verified boolean NOT NULL DEFAULT false,
 PRIMARY KEY(year,previous_year,origin,destination)
);
CREATE TABLE public.election_analysis_workbook_audit (
 id text PRIMARY KEY, year integer NOT NULL REFERENCES public.election_analysis_years(year),
 section text NOT NULL CHECK(section IN ('state','totals','flows','matrix')),
 record_key text NOT NULL, source_url text NOT NULL CHECK(source_url LIKE 'https://%'),
 source_sheet text NOT NULL, source_row integer NOT NULL CHECK(source_row>0),
 workbook_sha256 text NOT NULL CHECK(workbook_sha256 ~ '^[a-f0-9]{64}$'),
 compared_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL CHECK(status IN ('added','matched','conflict')),
 incoming jsonb NOT NULL, existing jsonb,
 notes text NOT NULL DEFAULT 'Arbeitsmappe als Abgleichquelle erfasst; verlinktes Original nicht unabhängig geprüft.',
 UNIQUE(workbook_sha256,section,record_key)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['election_analysis_state_totals','election_analysis_flow_matrix','election_analysis_workbook_audit'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY superadmin_write ON public.%I FOR ALL TO authenticated USING(public.is_superadmin(auth.uid())) WITH CHECK(public.is_superadmin(auth.uid()))',t);
  EXECUTE format('CREATE POLICY published_read ON public.%I FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.election_analysis_years y WHERE y.year=%I.year AND y.is_published))',t,t);
 END LOOP;
END $$;
-- Protect comparisons and inserts against concurrent manual changes.
LOCK TABLE public.election_analysis_years, public.election_analysis_state,
 public.election_analysis_flows, public.election_analysis_state_totals,
 public.election_analysis_flow_matrix IN SHARE ROW EXCLUSIVE MODE;
'''

def generate(path):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    w = openpyxl.load_workbook(path, data_only=True)
    totals, states, flows, cells = [], [], [], []
    years = []
    for rownum, row in enumerate(list(w['Wahlgesamt'].values)[1:], 2):
        y, date, eligible, voters, _, _, valid, invalid, *_ = row
        ballot = 'second' if y == 2026 else 'single'
        years.append(y)
        if eligible < voters or voters != valid + invalid:
            raise ValueError(f'Inkonsistente Bezugsgrößen {y}')
        totals.append(dict(year=y, ballot=ballot, election_date=dt.datetime.strptime(date, '%d.%m.%Y').date().isoformat(),
                           eligible=eligible, voters=voters, valid_votes=valid, invalid_votes=invalid,
                           source_url=FINAL_SOURCE if y == 2026 else HISTORY_SOURCE,
                           source_sheet='Wahlgesamt', source_row=rownum, workbook_sha256=digest))
    for rownum, row in enumerate(list(w['Parteistimmen'].values)[1:], 2):
        y, party, votes, _, valid, url, *_ = row
        party = norm(party)
        if party not in FOCUS:
            continue
        # Missing historical parties stay missing; no synthetic zero rows.
        states.append(dict(year=y, ballot='second' if y == 2026 else 'single', party=party,
                           votes=votes, valid_votes=valid, source_url=url,
                           source_sheet='Parteistimmen', source_row=rownum, workbook_sha256=digest))
    for sheet in ['Wanderung Brutto', 'Wanderung 2026 Salden']:
        for rownum, row in enumerate(list(w[sheet].values)[1:], 2):
            if sheet == 'Wanderung Brutto':
                y, party, partner, inflow, outflow, balance, _, url, _ = row
                if inflow - outflow != balance:
                    raise ValueError(f'Inkonsistenter Saldo {sheet}:{rownum}')
            else:
                y, party, partner, balance, _, url, _ = row
                inflow = outflow = None
            party = norm(party)
            if party not in FOCUS:
                continue
            flows.append(dict(year=y, previous_year=years[years.index(y)-1], target_party=party,
                              partner=norm(partner), inflow=inflow, outflow=outflow, balance=balance,
                              source_url=url, source_sheet=sheet, source_row=rownum, workbook_sha256=digest))
    matrix = list(w['Matrix 2006 komplett'].values)
    for rownum, row in enumerate(matrix[2:10], 3):
        if sum(row[1:9]) != row[9]:
            raise ValueError(f'Inkonsistente Matrix-Zeilensumme {rownum}')
        for col, origin in enumerate(matrix[1][1:9], 1):
            cells.append(dict(year=2006, previous_year=2001, origin=norm(origin), destination=norm(row[0]),
                              persons=row[col], source_url=MATRIX_SOURCE, source_sheet='Matrix 2006 komplett',
                              source_row=rownum, workbook_sha256=digest))
    output = [SCHEMA, f'-- Workbook: {path.name}\n-- SHA-256: {digest}\n']
    output.append('INSERT INTO public.election_analysis_years(year,period_number,is_published,notes) VALUES\n' + ',\n'.join(
        f"({y},{i},true,'Landesdaten aus Arbeitsmappe; keine zusätzlichen Wahlkreis- oder Mandatsdaten. Originalquelle noch nicht unabhängig geprüft.')"
        for i, y in enumerate(years, 1)) + '\nON CONFLICT DO NOTHING;\n')
    for section, data, relation, key, columns, equal, insert in [
        ('state', states, 'election_analysis_state', "x.year||':'||x.ballot||':'||x.party",
         'year integer,ballot text,party text,votes bigint,valid_votes bigint',
         's.votes IS NOT DISTINCT FROM x.votes AND s.valid_votes IS NOT DISTINCT FROM x.valid_votes AND s.share IS NOT NULL AND abs(s.share-round(x.votes::numeric/x.valid_votes*100,5))<=0.051',
         "INSERT INTO public.election_analysis_state(year,ballot,party,votes,share,valid_votes,notes,data_release) SELECT x.year,x.ballot,x.party,x.votes,round(x.votes::numeric/x.valid_votes*100,5),x.valid_votes,'Arbeitsmappe, Blatt '||x.source_sheet||', Zeile '||x.source_row||'; Original nicht unabhängig geprüft. '||x.source_url,'workbook-history-'||x.year FROM input x WHERE true ON CONFLICT DO NOTHING;"),
        ('totals', totals, 'election_analysis_state_totals', "x.year||':'||x.ballot",
         'year integer,ballot text,election_date date,eligible bigint,voters bigint,valid_votes bigint,invalid_votes bigint',
         's.election_date=x.election_date AND s.eligible=x.eligible AND s.voters=x.voters AND s.valid_votes=x.valid_votes AND s.invalid_votes=x.invalid_votes',
         'INSERT INTO public.election_analysis_state_totals SELECT x.*,false FROM input x WHERE true ON CONFLICT DO NOTHING;'),
        ('flows', flows, 'election_analysis_flows', "x.year||':'||x.previous_year||':'||x.target_party||':'||x.partner",
         'year integer,previous_year integer,target_party text,partner text,inflow bigint,outflow bigint,balance bigint',
         's.inflow IS NOT DISTINCT FROM x.inflow AND s.outflow IS NOT DISTINCT FROM x.outflow AND s.balance IS NOT DISTINCT FROM x.balance',
         "INSERT INTO public.election_analysis_flows(year,previous_year,target_party,partner,inflow,outflow,balance,notes) SELECT x.year,x.previous_year,x.target_party,x.partner,x.inflow,x.outflow,x.balance,'Gerundete landesweite Modellschätzung; Arbeitsmappe, Blatt '||x.source_sheet||', Zeile '||x.source_row||'; Original nicht unabhängig geprüft. '||x.source_url FROM input x WHERE true ON CONFLICT DO NOTHING;"),
        ('matrix', cells, 'election_analysis_flow_matrix', "x.year||':'||x.previous_year||':'||x.origin||':'||x.destination",
         'year integer,previous_year integer,origin text,destination text,persons bigint',
         's.persons=x.persons',
         'INSERT INTO public.election_analysis_flow_matrix SELECT x.*,false FROM input x WHERE true ON CONFLICT DO NOTHING;'),
    ]:
        join = {'state':'s.year=x.year AND s.ballot=x.ballot AND s.party=x.party',
                'totals':'s.year=x.year AND s.ballot=x.ballot',
                'flows':'s.year=x.year AND s.previous_year=x.previous_year AND s.target_party=x.target_party AND s.partner=x.partner',
                'matrix':'s.year=x.year AND s.previous_year=x.previous_year AND s.origin=x.origin AND s.destination=x.destination'}[section]
        declaration = columns + ',source_url text,source_sheet text,source_row integer,workbook_sha256 text'
        cte = f'WITH input AS (SELECT * FROM jsonb_to_recordset({records(data)}) AS x({declaration}))\n'
        output.append(cte + f'''INSERT INTO public.election_analysis_workbook_audit(id,year,section,record_key,source_url,source_sheet,source_row,workbook_sha256,status,incoming,existing)
SELECT x.workbook_sha256||':{section}:'||({key}),x.year,'{section}',{key},x.source_url,x.source_sheet,x.source_row,x.workbook_sha256,
 CASE WHEN s.year IS NULL THEN 'added' WHEN {equal} THEN 'matched' ELSE 'conflict' END,to_jsonb(x),to_jsonb(s)
FROM input x LEFT JOIN public.{relation} s ON {join}
WHERE true ON CONFLICT DO NOTHING;\n''')
        output.append(cte + insert + '\n')
    output.append('COMMIT;\n')
    return ''.join(output)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.write_text(generate(args.workbook))
    print(f'Migration geschrieben: {args.output}')
