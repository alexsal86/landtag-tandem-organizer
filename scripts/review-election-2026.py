#!/usr/bin/env python3
"""Fetch final official 2026 HTML, reconcile all 70 districts, generate review + CAS SQL.
No database connection or automatic writes. Uses only Python's standard library.
Example: python scripts/review-election-2026.py --output work/official-2026
A live --baseline JSON export is preferable to the explicitly labelled repository seed.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://wahlen.statistik-bw.de/ltw26/'
PARTIES = ['GRÜNE', 'CDU', 'SPD', 'FDP', 'AfD']
KEYS = {'state':['year','ballot','party'], 'districts':['year','ballot','district_number','party'], 'turnout':['year','ballot','district_number']}

class Tables(HTMLParser):
    def __init__(self):
        super().__init__(); self.tables=[]; self.table=None; self.row=None; self.cell=None; self.text=[]
    def handle_starttag(self, tag, attrs):
        if tag=='table': self.table=[]
        elif tag=='tr' and self.table is not None: self.row=[]
        elif tag in ('td','th') and self.row is not None: self.cell=[]
    def handle_data(self, value):
        self.text.append(value)
        if self.cell is not None: self.cell.append(value)
    def handle_endtag(self, tag):
        if tag in ('td','th') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split())); self.cell=None
        elif tag=='tr' and self.row is not None:
            self.table.append(self.row); self.row=None
        elif tag=='table' and self.table is not None:
            self.tables.append(self.table); self.table=None

def integer(cell):
    value=re.sub(r'[\s.\u202f\xa0]', '', cell)
    return int(value) if re.fullmatch(r'\d+',value) else None

def counts(row): return [value for cell in row[1:] if (value:=integer(cell)) is not None]
def normalized(value): return {'FDP/DVP':'FDP','AFD':'AfD'}.get(value.upper(),value.upper() if value.upper() in ('GRÜNE','CDU','SPD','FDP') else value)
def parse_page(raw):
    parser=Tables();parser.feed(raw.decode('utf-8-sig'))
    if not re.search(r'Endgültige[rs]?\s+Ergebnis', ' '.join(parser.text),re.I):
        raise ValueError('Official page is not explicitly final')
    tables=[t for t in parser.tables if any(r and normalized(r[0])=='GRÜNE' for r in t)]
    # Fail closed when the official format changes instead of selecting another table.
    if len(tables)!=1: raise ValueError(f'Expected one result table, got {len(tables)}')
    table=tables[0]
    def one(label):
        found=[r for r in table if r and r[0].rstrip(':').casefold()==label.casefold()]
        if len(found)!=1: raise ValueError(f'Missing/ambiguous official row {label}')
        return found[0]
    def common(label):
        values=counts(one(label))
        if not values or len(set(values))!=1: raise ValueError(f'Inconsistent common denominator: {label}')
        return values[0]
    valid=counts(one('Gültige'))
    if len(valid)!=2 or min(valid)<=0: raise ValueError('Expected separate first/second valid votes')
    results={}; candidates={}
    for party in PARTIES:
        rows=[r for r in table if r and normalized(r[0])==party]
        if len(rows)!=1 or len(counts(rows[0]))!=2: raise ValueError(f'Unknown party row layout: {party}')
        results[party]=counts(rows[0])
        if len(rows[0])>1 and integer(rows[0][1]) is None and ',' in rows[0][1]: candidates[party]=rows[0][1]
    eligible=common('Wahlberechtigte'); voters=common('Wählende')
    if not 0<max(valid)<=voters<=eligible: raise ValueError('Invalid denominators')
    if any(sum(v[i] for v in results.values())>valid[i] for i in range(2)): raise ValueError('Selected parties exceed valid votes')
    return dict(eligible=eligible,voters=voters,valid=valid,parties=results,candidates=candidates)

def baseline(path):
    if path: return json.loads(path.read_text()),str(path)
    sql=(ROOT/'supabase/migrations/20261114131000_election_analysis_data.sql').read_text()
    data={}
    for name in KEYS:
        match=re.search(r'INSERT INTO public\.election_analysis_'+name+r'\([^\n]+\)\nSELECT .*?\$analysis_data\$(.*?)\$analysis_data\$',sql,re.S)
        if not match: raise ValueError('Repository seed format changed')
        data[name]=json.loads(match[1])
        for row in data[name]: row['data_release']='legacy-'+('preliminary-' if row.get('preliminary') else 'final-')+str(row['year'])
    return data,'repository seed (NOT live database)'

def quote(value): return "'"+value.replace("'","''")+"'"
def jsonsql(value): return quote(json.dumps(value,ensure_ascii=False,separators=(',',':')))+'::jsonb'

def main():
    cli=argparse.ArgumentParser(description=__doc__);cli.add_argument('--output',type=Path,required=True);cli.add_argument('--baseline',type=Path);cli.add_argument('--archive',type=Path,help='Previously downloaded original HTML archive, no network')
    args=cli.parse_args(); old,baseline_name=baseline(args.baseline);out=args.output;out.mkdir(parents=True,exist_ok=True)
    archive=out/'originals';archive.mkdir(exist_ok=True)
    def fetch(n):
        file='index.html' if n==0 else f'ergebnispraesentation_wahlkreis_{n}.html';url=BASE+('' if n==0 else file)
        if args.archive: raw=(args.archive/file).read_bytes()
        else:
            request=urllib.request.Request(url,headers={'User-Agent':'ElectionAnalysisReview/1.0'})
            with urllib.request.urlopen(request,timeout=45) as response: raw=response.read()
        parsed=parse_page(raw);(archive/file).write_bytes(raw)
        return n,parsed,dict(url=url,sha256=hashlib.sha256(raw).hexdigest(),file=file)
    with ThreadPoolExecutor(max_workers=4) as pool: pages=list(pool.map(fetch,range(71)))
    state=pages[0][1];districts=pages[1:]
    for field in ('eligible','voters'):
        if sum(p[field] for _,p,_ in districts)!=state[field]: raise ValueError(f'70-district sum mismatch: {field}')
    for i in range(2):
        if sum(p['valid'][i] for _,p,_ in districts)!=state['valid'][i]: raise ValueError('Valid-vote sum mismatch')
        for party in PARTIES:
            if sum(p['parties'][party][i] for _,p,_ in districts)!=state['parties'][party][i]: raise ValueError(f'Party sum mismatch {party}')
    sources=[s for _,_,s in pages];release='official-final-2026-'+hashlib.sha256(json.dumps(sources,sort_keys=True).encode()).hexdigest()[:16]
    new={k:[] for k in KEYS};candidate_rows=[]
    names={r['district_number']:r['district_name'] for r in old['districts'] if r['year']==2026}
    for n,p,source in pages:
        for i,ballot in enumerate(('first','second')):
            for party in PARTIES:
                row=dict(year=2026,ballot=ballot,party=party,votes=p['parties'][party][i],share=round(p['parties'][party][i]/p['valid'][i]*100,5),data_release=release)
                if n: row.update(district_number=n,preliminary=False);new['districts'].append(row)
                else: row['valid_votes']=p['valid'][i];new['state'].append(row)
            if n: new['turnout'].append(dict(year=2026,ballot=ballot,district_number=n,eligible=p['eligible'],voters=p['voters'],valid_votes=p['valid'][i],turnout=round(p['voters']/p['eligible']*100,5),preliminary=False,data_release=release))
        if n:
            for party,name in p['candidates'].items(): candidate_rows.append(dict(year=2026,district_number=n,party=party,candidate_name=name,votes=p['parties'][party][0],share=round(p['parties'][party][0]/p['valid'][0]*100,5),source_url=source['url'],verified=True,person_id=None))
    changes=[];sql=['BEGIN;','-- Optimistic full-row checks protect manual corrections; an unexpected row aborts all updates.']
    sql.append('LOCK TABLE public.election_analysis_state,public.election_analysis_districts,public.election_analysis_turnout IN SHARE ROW EXCLUSIVE MODE;')
    updates=[]
    for table,rows in new.items():
        def key(r): return tuple(r[k] for k in KEYS[table])
        existing={key(r):r for r in old[table]}
        for row in rows:
            previous=existing.get(key(row))
            if previous is None: raise ValueError(f'Baseline row missing {table}: {key(row)}')
            expected={**previous,**row};where=' AND '.join(f'{k}={quote(str(row[k]))}' for k in KEYS[table])
            changed={k:dict(before=previous.get(k),after=v) for k,v in row.items() if previous.get(k)!=v}
            changes.append(dict(table=table,key=key(row),changes=changed))
            sql.append('DO $check$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.election_analysis_'+table+' t WHERE '+where+' AND (to_jsonb(t) @> '+jsonsql(previous)+' OR to_jsonb(t) @> '+jsonsql(expected)+")) THEN RAISE EXCEPTION 'Manual change / baseline conflict: "+table+" "+str(key(row)).replace("'",'')+"'; END IF; END $check$;")
            assignments=','.join(k+'='+('false' if v is False else str(v) if isinstance(v,(int,float)) else quote(v)) for k,v in row.items() if k not in KEYS[table])
            updates.append('UPDATE public.election_analysis_'+table+' SET '+assignments+' WHERE '+where+';')
    sql+=updates
    # New candidate records never overwrite an administrator's existing record.
    for c in candidate_rows:
        columns=','.join(c);values=','.join('NULL' if v is None else 'true' if v is True else str(v) if isinstance(v,(int,float)) else quote(v) for v in c.values())
        sql.append(f'INSERT INTO public.election_analysis_candidates({columns}) VALUES({values}) ON CONFLICT DO NOTHING;')
    review=dict(baseline=baseline_name,release=release,source_count=len(sources),sources=sources,changes=changes,candidates=len(candidate_rows),totals=state)
    retrieved=datetime.now(timezone.utc).isoformat()
    sql.append("INSERT INTO public.election_analysis_source_reviews(id,kind,source_url,sha256,retrieved_at,status,summary) VALUES("+','.join([quote(release),quote('official-results'),quote(BASE),quote(hashlib.sha256(json.dumps(sources,sort_keys=True).encode()).hexdigest()),quote(retrieved),quote('verified'),jsonsql(review)])+") ON CONFLICT DO NOTHING;")
    sql.append('COMMIT;')
    (out/'review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2))
    (out/'apply.sql').write_text('\n'.join(sql)+'\n')
    (out/'normalized.json').write_text(json.dumps(new,ensure_ascii=False,indent=2))
    print(f'Reconciled 70 districts; {len(changes)} row comparisons. Review {out}/review.json before applying SQL. Baseline: {baseline_name}')
if __name__=='__main__': main()
