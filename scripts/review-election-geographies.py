#!/usr/bin/env python3
"""Archive/compare the two official GeoJSON datasets. No DB writes, no fallback maps.
Exact canonical geometry equality is sufficient; differences remain unverified
(they can also result from changed digitisation and require human GIS review).
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

BASE='https://www.statistik-bw.de/fileadmin/user_upload/medien/bilder/Karten_und_Geometrien_der_Wahlkreise/'
def quote(value): return "'"+value.replace("'","''")+"'"
def ring(points):
    points=[tuple(p) for p in points]
    if points[0]==points[-1]: points.pop()
    if not points: raise ValueError('Empty ring')
    # Rotation and orientation do not change a boundary.
    def rotate(p):
        m=min(p);return min(tuple(p[i:]+p[:i]) for i,v in enumerate(p) if v==m)
    return min(rotate(points),rotate(list(reversed(points))))
def polygon(rings):return (ring(rings[0]),tuple(sorted(ring(r) for r in rings[1:])))
def geometry(g):
    if g['type']=='Polygon': return (polygon(g['coordinates']),)
    if g['type']=='MultiPolygon': return tuple(sorted(polygon(p) for p in g['coordinates']))
    raise ValueError('Expected Polygon or MultiPolygon')
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--archive',type=Path);args=parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=True);datasets={};reviews={};sql=['BEGIN;']
    for year in (2021,2026):
        name=f'LTWahlkreise{year}-BW_GEOJSON.zip';url=BASE+name
        if args.archive: raw=(args.archive/name).read_bytes()
        else:
            with urllib.request.urlopen(url,timeout=60) as response: raw=response.read()
        (args.output/name).write_bytes(raw)
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            names=[n for n in z.namelist() if n.lower().endswith(('.json','.geojson')) and not n.startswith('__MACOSX/')]
            if len(names)!=1: raise ValueError('Ambiguous GeoJSON archive')
            geo=json.loads(z.read(names[0]).decode('utf-8-sig'))
        if geo.get('type')!='FeatureCollection' or len(geo['features'])!=70: raise ValueError('Expected 70 official districts')
        crs=geo.get('crs')
        if crs is None:
            # RFC7946 permits omitted CRS only for WGS84. Never assume a projected source is WGS84.
            def pairs(c):
                if isinstance(c[0],(int,float)): yield c
                else:
                    for child in c: yield from pairs(child)
            if any(not(-180<=p[0]<=180 and -90<=p[1]<=90) for f in geo['features'] for p in pairs(f['geometry']['coordinates'])): raise ValueError('Projected coordinates without CRS')
        versions={}
        for feature in geo['features']:
            p=feature['properties'];n=next((int(p[k]) for k in ('Nummer','WKR_NR','WKRNR','NR') if k in p),None)
            if n is None or n in versions: raise ValueError('Unknown or duplicate official district number')
            versions[n]=geometry(feature['geometry'])
        if set(versions)!=set(range(1,71)): raise ValueError('Incomplete district set')
        encoded=json.dumps(geo,ensure_ascii=False,separators=(',',':')).encode();asset=f'official-{year}.geojson';(args.output/asset).write_bytes(encoded)
        sha=hashlib.sha256(raw).hexdigest();identifier=f'official-{year}-{sha[:16]}'
        datasets[year]=(versions,crs,identifier)
        reviews[year]=dict(source_url=url,sha256=sha,id=identifier,asset=asset)
        sql.append("DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.election_analysis_geographies WHERE id="+quote(identifier)+" AND sha256<>"+quote(sha)+") THEN RAISE EXCEPTION 'Geometry metadata conflict'; END IF; END $$;")
        sql.append('INSERT INTO public.election_analysis_geographies(id,year,source_url,sha256,asset_path,verified,notes) VALUES('+','.join([quote(identifier),str(year),quote(url),quote(sha),quote('/data/election-analysis/'+asset),'true',quote('Amtliche Originalgeometrie; periodenspezifisch, keine historischen Grenzen daraus abgeleitet.')])+') ON CONFLICT DO NOTHING;')
    same_crs=datasets[2021][1]==datasets[2026][1];equal=[]
    for year in (2021,2026):
        versions,crs,identifier=datasets[year]
        for n in range(1,71):
            same=same_crs and datasets[2021][0][n]==datasets[2026][0][n]
            if year==2021 and same: equal.append(n)
            identity='shape-'+hashlib.sha256(json.dumps([crs,versions[n]],sort_keys=True).encode()).hexdigest() if same else None
            where=f'year={year} AND district_number={n}'
            condition='geography_id IS NOT NULL AND geography_id<>'+quote(identifier)
            if identity: condition+=' OR identity_key IS NOT NULL AND identity_key<>'+quote(identity)
            else: condition+=' OR identity_key IS NOT NULL'
            sql.append('DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.election_analysis_versions WHERE '+where+' AND ('+condition+")) THEN RAISE EXCEPTION 'Manual geography assignment conflict'; END IF; END $$;")
            sql.append('UPDATE public.election_analysis_versions SET geography_id='+quote(identifier)+',identity_key='+('NULL' if identity is None else quote(identity))+' WHERE '+where+';')
    report=dict(sources=reviews,identical_districts=equal,unverified_districts=sorted(set(range(1,71))-set(equal)),method='Exact coordinates, canonical ring orientation/rotation, same declared CRS. Differences are not evidence of changed administrative boundaries.')
    sql.append('COMMIT;');(args.output/'review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));(args.output/'apply.sql').write_text('\n'.join(sql)+'\n')
    print(f'{len(equal)}/70 exact geometry matches. Review report, copy both assets to public/data/election-analysis/, then apply SQL.')
if __name__=='__main__': main()
