#!/usr/bin/env python3
"""Generate scoped CAS corrections from reviewed official numeric excerpts.
Does not claim a full Version-6 workbook import or a 70-district verification.
Run from the repository root; no database access and no tests are performed.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_2016 = 'https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistische_Berichte/423216001.pdf'
SOURCE_2026 = 'https://wahlen.statistik-bw.de/ltw26/ergebnispraesentation_wahlkreis_70.html'
PARTIES = ['CDU', 'GRÜNE', 'SPD', 'FDP', 'AfD']


def generate():
    seed = (ROOT/'supabase/migrations/20261114131000_election_analysis_data.sql').read_text()
    baseline = {}
    for section in ('districts', 'turnout'):
        rows = json.loads(re.search(r'INSERT INTO public.election_analysis_'+section+r'\(.*?\$analysis_data\$(.*?)\$analysis_data\$', seed, re.S)[1])
        baseline[section] = {tuple(row[k] for k in ['year', 'ballot', 'district_number'] + (['party'] if section == 'districts' else [])): row for row in rows}
    # Exact counts transcribed from the official PDF, printed page 20, table 1.
    # These are original 2016 values, not the adjacent 2011 comparison columns.
    facts = [
        dict(year=2016, number=62, name='Tübingen', eligible=134421, voters=100803, valid={'single':100156},
             votes={'single':dict(zip(PARTIES, [23847,37712,12641,6491,10353]))}, rep=247, source=SOURCE_2016),
        dict(year=2016, number=63, name='Balingen', eligible=114805, voters=77834, valid={'single':77131},
             votes={'single':dict(zip(PARTIES, [22675,22365,7660,6267,13961]))}, rep=309, source=SOURCE_2016),
        dict(year=2026, number=70, name='Sigmaringen', eligible=97910, voters=68543, valid={'first':67784,'second':67976},
             votes={'first':dict(zip(PARTIES, [29183,11849,2903,2946,17070])),
                    'second':dict(zip(PARTIES, [24830,15061,2477,2716,16657]))}, source=SOURCE_2026),
    ]
    digest = hashlib.sha256(json.dumps(facts, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    patches = []
    for f in facts:
        release = f"reviewed-{f['year']}-district-correction-{digest[:12]}"
        for ballot, valid in f['valid'].items():
            votes = dict(f['votes'][ballot])
            if 'rep' in f:
                votes['REP'] = f['rep']
            for party, count in votes.items():
                key = (f['year'], ballot, f['number'], party)
                old = baseline['districts'].get(key)
                if old is None:
                    # REP was added by the workbook import, not by the original seed.
                    workbook_sql = (ROOT/'supabase/migrations/20261117100000_workbook_district_history.sql').read_text()
                    incoming = json.loads(workbook_sql.split('$district_rows$')[1])
                    row = next(r for r in incoming if r['section']=='districts' and (r['year'],r['ballot'],r['district_number'],r['party'])==key)
                    old = {k:row[k] for k in ['year','ballot','district_number','district_name','party','share','preliminary','notes','data_release']}
                    old['votes'] = None
                old = dict(old)
                old.setdefault('data_release', f"legacy-{'preliminary' if old['preliminary'] else 'final'}-{old['year']}")
                new = dict(old, votes=count, share=round(count/valid*100,5), preliminary=False, data_release=release,
                           notes=f"Gezielter Originalquellenabgleich 17.11.2026; {f['source']}; ursprünglicher Wahlkreis, absolute Stimmen und Anteil gemeinsam korrigiert.")
                patches.append(dict(section='districts', expected=old, replacement=new, source_url=f['source']))
            key = (f['year'], ballot, f['number'])
            old = dict(baseline['turnout'][key])
            old['data_release'] = f"legacy-{'preliminary' if old['preliminary'] else 'final'}-{old['year']}"
            new = dict(old, eligible=f['eligible'], voters=f['voters'], valid_votes=valid,
                       turnout=round(f['voters']/f['eligible']*100,5), preliminary=False, data_release=release,
                       notes=f"Gezielter Originalquellenabgleich 17.11.2026; {f['source']}; Wahlberechtigte, Wählende und gültige Stimmen gemeinsam korrigiert.")
            patches.append(dict(section='turnout', expected=old, replacement=new, source_url=f['source']))
    report = dict(scope='2016: Wahlkreise 62/63; 2026: Wahlkreis 70, beide Stimmenarten',
                  original_sources_independently_read=True, checksum_scope='Normalized extracted facts, NOT original PDF/HTML bytes',
                  facts_sha256=digest, facts=facts, patches=patches,
                  version6_available=False, full_2006_127_cell_correction_pending=True,
                  known_2006_examples=[dict(number=50,field='turnout',old_excel=58.5,correct=46.8),
                    dict(number=24,party='SPD',field='share',old_excel=39.4,correct=33.7),
                    dict(number=24,field='turnout',old_excel=62.6,correct=53.8),
                    dict(number=56,party='SPD',field='share',old_excel=32.4,correct=21.3),
                    dict(number=56,party='GRÜNE',field='share',old_excel=16.0,correct=18.9)])
    (ROOT/'docs/election-analysis/sources/reviewed-election-corrections.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    sql = '''-- Scoped corrections; exact expected rows protect manual changes.
-- Original sources were read for these districts only, not all 70 districts.
DO $reviewed_district_corrections$
DECLARE x record; old_row jsonb; desired jsonb; audit_status text;
BEGIN
CREATE TABLE IF NOT EXISTS public.election_analysis_correction_audit (
 correction_id text NOT NULL, section text NOT NULL, record_key text NOT NULL,
 year integer NOT NULL REFERENCES public.election_analysis_years(year),
 source_url text NOT NULL, status text NOT NULL CHECK(status IN ('updated','matched','conflict','missing')),
 incoming jsonb NOT NULL, existing jsonb, compared_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(correction_id,section,record_key)
);
ALTER TABLE public.election_analysis_correction_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.election_analysis_correction_audit FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.election_analysis_correction_audit TO authenticated;
IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='election_analysis_correction_audit' AND policyname='superadmin_write') THEN
 CREATE POLICY superadmin_write ON public.election_analysis_correction_audit FOR ALL TO authenticated
 USING(public.is_superadmin(auth.uid())) WITH CHECK(public.is_superadmin(auth.uid()));
END IF;
LOCK TABLE public.election_analysis_districts,public.election_analysis_turnout IN SHARE ROW EXCLUSIVE MODE;
FOR x IN SELECT * FROM jsonb_to_recordset($corrections$'''+json.dumps(patches,ensure_ascii=False,separators=(',',':'))+'''$corrections$::jsonb)
 AS item(section text,expected jsonb,replacement jsonb,source_url text)
LOOP
 desired:=x.replacement; old_row:=NULL;
 IF x.section='districts' THEN
  SELECT to_jsonb(r) INTO old_row FROM public.election_analysis_districts r
   WHERE r.year=(desired->>'year')::integer AND r.ballot=desired->>'ballot'
    AND r.district_number=(desired->>'district_number')::integer AND r.party=desired->>'party';
 ELSE
  SELECT to_jsonb(r) INTO old_row FROM public.election_analysis_turnout r
   WHERE r.year=(desired->>'year')::integer AND r.ballot=desired->>'ballot'
    AND r.district_number=(desired->>'district_number')::integer;
 END IF;
 audit_status:=CASE WHEN old_row IS NULL THEN 'missing'
   WHEN old_row @> desired THEN 'matched'
   WHEN old_row @> x.expected THEN 'updated' ELSE 'conflict' END;
 INSERT INTO public.election_analysis_correction_audit(correction_id,section,record_key,year,source_url,status,incoming,existing)
 VALUES('''+"'reviewed-"+digest[:12]+"'"+''',x.section,concat_ws(':',desired->>'year',desired->>'ballot',desired->>'district_number',desired->>'party'),
  (desired->>'year')::integer,x.source_url,audit_status,desired,old_row) ON CONFLICT DO NOTHING;
 IF audit_status='updated' THEN
  IF x.section='districts' THEN
   UPDATE public.election_analysis_districts SET votes=(desired->>'votes')::bigint,share=(desired->>'share')::numeric,
    preliminary=false,notes=desired->>'notes',data_release=desired->>'data_release'
    WHERE year=(desired->>'year')::integer AND ballot=desired->>'ballot'
     AND district_number=(desired->>'district_number')::integer AND party=desired->>'party';
  ELSE
   UPDATE public.election_analysis_turnout SET eligible=(desired->>'eligible')::bigint,voters=(desired->>'voters')::bigint,
    valid_votes=(desired->>'valid_votes')::bigint,turnout=(desired->>'turnout')::numeric,
    preliminary=false,notes=desired->>'notes',data_release=desired->>'data_release'
    WHERE year=(desired->>'year')::integer AND ballot=desired->>'ballot' AND district_number=(desired->>'district_number')::integer;
  END IF;
 END IF;
END LOOP;
-- Existing assembly triggers refresh only unchanged automatic personal results.
END $reviewed_district_corrections$;
'''
    payload_start = sql.index('$corrections$')
    payload_end = sql.index('$corrections$', payload_start + len('$corrections$')) + len('$corrections$')
    payload = sql[payload_start:payload_end]
    sql = sql[:payload_start] + 'patches' + sql[payload_end:]
    sql = sql.replace('DECLARE x record; old_row jsonb; desired jsonb; audit_status text;',
        'DECLARE x record; old_row jsonb; desired jsonb; audit_status text; blocked_groups text[]:=ARRAY[]::text[];\n patches constant jsonb:=' + payload + '::jsonb;')
    # A district's party numbers and turnout denominators change as one group.
    loop_start = sql.index('FOR x IN SELECT')
    status_start = sql.index(" audit_status:=CASE", loop_start)
    preflight = sql[loop_start:status_start] + """ IF old_row IS NULL OR (NOT (old_row @> desired) AND NOT (old_row @> x.expected)) THEN
  blocked_groups:=array_append(blocked_groups,concat_ws(':',desired->>'year',desired->>'district_number'));
 END IF;
END LOOP;
"""
    sql = sql[:loop_start] + preflight + sql[loop_start:]
    sql = sql.replace("WHEN old_row @> desired THEN 'matched'\n   WHEN old_row @> x.expected THEN 'updated'",
        "WHEN old_row @> desired THEN 'matched'\n   WHEN concat_ws(':',desired->>'year',desired->>'district_number')=ANY(blocked_groups) THEN 'conflict'\n   WHEN old_row @> x.expected THEN 'updated'")
    sql = sql.replace('incoming jsonb NOT NULL, existing jsonb, compared_at', "incoming jsonb NOT NULL, existing jsonb, notes text NOT NULL DEFAULT '', compared_at")
    sql = sql.replace('status,incoming,existing)', 'status,incoming,existing,notes)')
    sql = sql.replace('x.source_url,audit_status,desired,old_row) ON CONFLICT DO NOTHING;',
        "x.source_url,audit_status,desired,old_row,CASE WHEN concat_ws(':',desired->>'year',desired->>'district_number')=ANY(blocked_groups) THEN 'Keine Teilkorrektur: mindestens ein Altstand dieses Wahlkreises fehlt oder weicht ab.' ELSE '' END) ON CONFLICT DO NOTHING;")
    (ROOT/'supabase/migrations/20261117130000_reviewed_district_corrections.sql').write_text(sql)
    print(f'{len(patches)} scoped row corrections generated. Version 6 not available.')

if __name__ == '__main__':
    generate()
