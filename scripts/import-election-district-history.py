#!/usr/bin/env python3
"""Add historical original-district shares without overwriting existing results.
Usage: python scripts/import-election-district-history.py workbook.xlsx output.sql
Requires openpyxl. Linked original documents are not independently verified.
"""
import hashlib
import json
import sys
from pathlib import Path
import openpyxl


def generate(path, output):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    snapshot = {sheet.title: list(sheet.values) for sheet in workbook}
    archive = Path('docs/election-analysis/sources/district-history-workbook.json')
    archive.write_text(json.dumps(dict(filename=path.name, sha256=digest, sheets=snapshot), ensure_ascii=False, indent=2) + '\n')
    data = []
    deferred = []
    for sheet, first in [('Wahlkreise gesamt 1952–2026', False), ('2026 Erststimmen', True)]:
        for rownum, row in enumerate(snapshot[sheet][5:], 6):
            if not row or not isinstance(row[0], int):
                continue
            if first:
                number, name, valid, turnout = row[:4]
                year, ballot = 2026, 'first'
                values = dict(zip(['CDU', 'SPD', 'FDP', 'GRÜNE', 'AfD', 'SONSTIGE'], row[4:10]))
                source, status, basis, extra = row[11], 'amtlich endgültig', 'Erststimmen', None
            else:
                if len(row) < 22:
                    continue
                year, number, name = row[:3]
                turnout, valid = row[8], None
                ballot = 'second' if year == 2026 else 'single'
                # SONSTIGE includes subsets such as NPD and sometimes REP/AfD.
                # Preserve it in the archive; never treat overlapping groups as parties.
                values = dict(zip(['CDU', 'SPD', 'FDP', 'GRÜNE', 'AfD', 'REP'], row[9:15]))
                values.pop('SONSTIGE', None)
                basis, status, extra, source = row[17], row[18], row[19], row[21]
            values.pop('SONSTIGE', None)
            if number is None:
                deferred.append(dict(sheet=sheet, row=rownum, year=year, name=name, reason='Regionale Originalnummer/geometry_source_key fehlt; keine Namenszuordnung.'))
                continue
            note = f'Arbeitsmappe SHA-256 {digest}; {sheet}, Zeile {rownum}; {status}; {basis}; {extra or ""}; {source}; Originalquelle nicht unabhängig geprüft.'
            common = dict(year=year, ballot=ballot, district_number=number, district_name=name,
                          preliminary='vorläufig' in str(status).lower(), notes=note,
                          data_release=f'workbook-original-{year}-{digest[:12]}', source_sheet=sheet, source_row=rownum)
            for party, share in values.items():
                if share is not None:
                    data.append(dict(common, section='districts', party=party, share=share))
            if turnout is not None or valid is not None:
                data.append(dict(common, section='turnout', party='', turnout=turnout, valid_votes=valid))
    sql = '''-- Additive original-district workbook import. No votes inferred from rounded shares.
-- No mandates, people, geometry identities or existing results are overwritten.
DO $district_workbook_import$
DECLARE x record; old_row jsonb; incoming jsonb; result_status text;
BEGIN
CREATE TABLE IF NOT EXISTS public.election_analysis_district_workbook_audit (
 workbook_sha256 text NOT NULL CHECK(workbook_sha256 ~ '^[a-f0-9]{64}$'),
 source_sheet text NOT NULL, source_row integer NOT NULL,
 year integer NOT NULL REFERENCES public.election_analysis_years(year),
 section text NOT NULL CHECK(section IN ('districts','turnout')),
 ballot text NOT NULL, district_number integer NOT NULL, party text NOT NULL,
 status text NOT NULL CHECK(status IN ('added','matched','conflict')),
 incoming jsonb NOT NULL, existing jsonb, source_verified boolean NOT NULL DEFAULT false,
 PRIMARY KEY(workbook_sha256,source_sheet,source_row,section,party)
);
ALTER TABLE public.election_analysis_district_workbook_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.election_analysis_district_workbook_audit FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.election_analysis_district_workbook_audit TO authenticated;
IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='election_analysis_district_workbook_audit' AND policyname='superadmin_write') THEN
 CREATE POLICY superadmin_write ON public.election_analysis_district_workbook_audit FOR ALL TO authenticated USING(public.is_superadmin(auth.uid())) WITH CHECK(public.is_superadmin(auth.uid()));
 CREATE POLICY published_read ON public.election_analysis_district_workbook_audit FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.election_analysis_years y WHERE y.year=election_analysis_district_workbook_audit.year AND y.is_published));
END IF;
LOCK TABLE public.election_analysis_years,public.election_analysis_versions,public.election_analysis_districts,public.election_analysis_turnout IN SHARE ROW EXCLUSIVE MODE;
'''
    years = sorted({r['year'] for r in data})
    all_years = sorted({r[0] for r in snapshot['Wahlkreise gesamt 1952–2026'][5:] if r and isinstance(r[0], int)})
    for y in years:
        sql += f"INSERT INTO public.election_analysis_years(year,period_number,is_published,notes) VALUES({y},{all_years.index(y)+1},true,'Historische Originalwahlkreise aus Arbeitsmappe; Quellenprüfung offen.') ON CONFLICT DO NOTHING;\n"
    sql += '''FOR x IN SELECT * FROM jsonb_to_recordset($district_rows$''' + '[' + ',\n'.join(json.dumps(row, ensure_ascii=False, separators=(',', ':')) for row in data) + ']' + '''$district_rows$::jsonb)
 AS r(year integer,ballot text,district_number integer,district_name text,preliminary boolean,notes text,data_release text,source_sheet text,source_row integer,section text,party text,share numeric,turnout numeric,valid_votes bigint)
LOOP
 old_row:=NULL;
 IF x.section='districts' THEN
  incoming:=jsonb_build_object('share',x.share,'votes',NULL,'preliminary',x.preliminary,'district_name',x.district_name,'notes',x.notes);
  SELECT to_jsonb(d) INTO old_row FROM public.election_analysis_districts d WHERE d.year=x.year AND d.ballot=x.ballot AND d.district_number=x.district_number AND d.party=x.party;
 ELSE
  incoming:=jsonb_build_object('turnout',x.turnout,'valid_votes',x.valid_votes,'preliminary',x.preliminary,'district_name',x.district_name,'notes',x.notes);
  SELECT to_jsonb(d) INTO old_row FROM public.election_analysis_turnout d WHERE d.year=x.year AND d.ballot=x.ballot AND d.district_number=x.district_number;
 END IF;
 result_status:=CASE WHEN old_row IS NULL THEN 'added'
  WHEN old_row->>'district_name'=x.district_name AND (old_row->>'preliminary')::boolean=x.preliminary AND
   CASE WHEN x.section='districts' THEN abs((old_row->>'share')::numeric-x.share)<=0.00001
   ELSE abs((old_row->>'turnout')::numeric-x.turnout)<=0.00001 AND (x.valid_votes IS NULL OR (old_row->>'valid_votes')::bigint=x.valid_votes) END
  THEN 'matched' ELSE 'conflict' END;
 INSERT INTO public.election_analysis_district_workbook_audit(workbook_sha256,source_sheet,source_row,year,section,ballot,district_number,party,status,incoming,existing)
 VALUES(''' + "'" + digest + "'" + ''',x.source_sheet,x.source_row,x.year,x.section,x.ballot,x.district_number,x.party,result_status,incoming,old_row) ON CONFLICT DO NOTHING;
 IF old_row IS NULL THEN
  INSERT INTO public.election_analysis_versions(year,district_number,district_name,notes)
  VALUES(x.year,x.district_number,x.district_name,'Originalwahlkreis laut Arbeitsmappe; keine bestätigte grenzüberschreitende Identität.') ON CONFLICT DO NOTHING;
  IF x.section='districts' THEN
   INSERT INTO public.election_analysis_districts(year,ballot,district_number,district_name,party,share,preliminary,notes,data_release)
   VALUES(x.year,x.ballot,x.district_number,x.district_name,x.party,x.share,x.preliminary,x.notes,x.data_release) ON CONFLICT DO NOTHING;
  ELSE
   INSERT INTO public.election_analysis_turnout(year,ballot,district_number,district_name,turnout,valid_votes,preliminary,notes,data_release)
   VALUES(x.year,x.ballot,x.district_number,x.district_name,x.turnout,x.valid_votes,x.preliminary,x.notes,x.data_release) ON CONFLICT DO NOTHING;
  END IF;
 END IF;
END LOOP;
END $district_workbook_import$;
'''
    output.write_text(sql)
    report = dict(workbook_sha256=digest, rows_by_sheet={s:len(r) for s,r in snapshot.items()}, import_candidates=len(data), deferred=deferred,
                  notes='Additiv; Konfliktabgleich erfolgt gegen die tatsächlichen Daten erst beim Einspielen. Keine Tests ausgeführt. Kein Originalquellenabgleich.')
    Path('docs/election-analysis/sources/district-history-workbook-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(import_candidates=len(data),deferred=len(deferred),years=years)))

if __name__ == '__main__':
    generate(Path(sys.argv[1]), Path(sys.argv[2]))
