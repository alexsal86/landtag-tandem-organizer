# Election geometry: shared district forms and selected-year manifests

The public map no longer downloads one archive containing all election years.
Each distinct district shape has a SHA-256 identity. A small manifest per boundary
year maps district numbers/properties to shape identities and their package URLs.
2026 resolves to the 2021 manifest, as confirmed by the user. District properties
remain year-specific; names/numbers are not inferred from another year's shape.

The packer compares exact coordinates, canonicalizing only ring start/direction,
hole order and polygon order. No rounding, quantization, simplification, point
thinning or approximate matching occurs. Stored forms retain an original source's coordinates and topology. For each
package the packer chooses the smallest serialized representation among sources
with exactly identical forms; it does not reproject or change coordinates. Polygon/MultiPolygon wrappers with
identical polygon coordinates can share a form. Comparison keys omit only the
repeated closing point; stored rings retain it.

Unique forms are grouped by the set of boundary years which need them. This
keeps requests bounded without fetching other years' unused forms. Shared arcs
within each package are deduplicated as well. There are now 261 distinct forms
across twelve boundary datasets (844 district entries: 74 in 1952, 70 in each
other dataset). Explicit aliases: 1956 → 1960, 1964 → 1968,
1976/1980/1984 → 1988, and 2026 → 2021.

| Package usage | Distinct forms | Gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| 1952 | 25 | 2,332,732 | 1,638,793 |
| 1952,1960,1968 | 18 | 1,734,314 | 1,287,082 |
| 1952,1960,1968,1972 | 31 | 2,029,335 | 1,508,934 |
| 1960,1968 | 11 | 1,277,698 | 963,056 |
| 1960,1968,1972 | 10 | 854,206 | 639,380 |
| 1972 | 29 | 2,665,592 | 1,952,632 |
| 1988 | 17 | 1,053,298 | 785,391 |
| 1988,1992,1996,2001 | 10 | 630,055 | 477,771 |
| 1988,1992,1996,2001,2006 | 17 | 826,199 | 624,370 |
| 1988,1992,1996,2001,2006,2011,2016,2021 | 26 | 1,329,926 | 1,004,923 |
| 1992,1996,2001 | 1 | 64,490 | 48,946 |
| 1992,1996,2001,2006 | 9 | 664,320 | 501,930 |
| 1992,1996,2001,2006,2011,2016,2021 | 7 | 159,452 | 120,776 |
| 2006 | 11 | 695,709 | 527,205 |
| 2011,2016 | 2 | 106,409 | 80,372 |
| 2011,2016,2021 | 35 | 1,663,006 | 1,251,662 |
| 2021 | 2 | 115,519 | 87,298 |

1952 reuses 49 forms and adds 25 distinct shapes. This does not associate
people or mandates across elections: its regions and historical numbers are
handled separately from technical IDs.

1960 and 1968 share all 70 coordinate shapes; their metadata/source dates remain
independent. 1968 shares 41 exact forms with 1972, with 29 differing forms per
source. 1992/1996/2001 share all 70 shapes. No approximate equality is used.

| Selected year | Cold requests (manifest + packages) | Gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| 1952 | 4 | 6,101,414 | 4,439,111 |
| 1956 / 1960 | 5 | 5,899,357 | 4,401,880 |
| 1964 / 1968 | 5 | 5,899,366 | 4,401,867 |
| 1972 | 4 | 5,552,936 | 4,104,340 |
| 1976 / 1980 / 1984 / 1988 | 5 | 3,843,172 | 2,895,829 |
| 1992 | 7 | 3,678,214 | 2,782,168 |
| 1996 | 7 | 3,678,214 | 2,782,168 |
| 2001 | 7 | 3,678,214 | 2,782,173 |
| 2006 | 6 | 3,679,347 | 2,782,631 |
| 2011 | 5 | 3,262,496 | 2,461,132 |
| 2016 | 5 | 3,262,496 | 2,461,135 |
| 2021 / 2026 | 5 | 3,271,642 | 2,468,017 |

These are generated compressed transfer sizes, excluding HTTP overhead, not
browser timings. Splitting shared boundaries across reuse groups can increase
a cold download relative to earlier builds. Only the selected year's required
forms are fetched; cached geometry is reused on year switches.

## Retrieval and cache

`loadElectoralTopology(year)` preserves the public loader interface. It loads
only the selected manifest, computes the missing forms, deduplicates package
requests and assembles that year's GeoJSON for Leaflet. Compressed packages and
manifests are shared across historical member maps and the analysis maps.
Concurrent consumers share in-flight requests; decoded forms are also reused.
Failed requests can be retried. No private result data enters this cache.

The browser requests explicit `.gz` files and uses DecompressionStream, so gzip
works on static hosts without special content negotiation. Brotli quality 11 and
gzip level 9 sidecars are generated for every package/manifest. On a host with
precompressed negotiation, the canonical URL can instead negotiate Brotli; that
requires actual server support, not just a sidecar file.

Every URL includes its content hash. The five-year immutable HTTP rule remains
in `public/_headers` for hosts supporting that format. Other hosts must set the
equivalent server/CDN headers. Cache Storage (`public-election-shapes-v2`) keeps
public compressed assets for up to 1,825 days; browsers may evict them earlier.
Reading one package never deletes the cached packages of another year. The old
all-years cache is retired. New frontend versions include a manifest-set version
in React Query keys, while unchanged package URLs remain reusable.

The superseded all-years archive was removed from the current tree; Git history
retains it. Published existing frontend sessions should reload after deployment.

## Regeneration

Use the original unquantized sources, including the cleaned 2021 replacement:

```sh
node scripts/geometry/pack-election-topology.mjs 1952=path/to/LTWahlkreise1952-BW_konsistent.topojson 1960=path/to/LTWahlkreise1960-BW_konsistent.topojson 1968=path/to/LTWahlkreise1968-BW_konsistent.topojson 1972=path/to/LTWahlkreise1972-BW_konsistent.topojson 1988=path/to/LTWahlkreise1988-BW_konsistent.topojson 1992=path/to/LTWahlkreise1992-BW_konsistent.topojson 1996=path/to/LTWahlkreise1996-BW_konsistent.topojson 2001=path/to/LTWahlkreise2001-BW_konsistent.topojson 2006=path/to/LTWahlkreise2006-BW_konsistent.topojson 2011=path/to/LTWahlkreise2011-BW.topojson.json 2016=path/to/LTWahlkreise2016-BW.topojson 2021=path/to/LTWahlkreise2021_bereinigt.topojson.json
```

The script writes hashed packages/manifests with gzip/Brotli representations and
generates `src/utils/electoralTopologyAsset.ts`. Future additions recompute exact
shape sharing; package addresses change only when their serialized contents
change. Remove superseded generated assets from the current tree when publishing.
The Tailwind scanner excludes `public/data` to avoid scanning large geometry JSON.

## Historical member map: confirmation

Existing database migrations remain necessary for period-specific selection:
`20261115010000_election_history_shared_geometry.sql`, then
`20261115080000_election_history_2006_2011_geometry.sql`, followed by
`20261115090000_election_history_1992_2001_geometry.sql` to permit the additional
1992/1996/2001 selections. `20261115100000_election_history_1988_geometry.sql`
adds 1988 and corrects its district-37 name.
`20261115110000_election_history_1972_1984_geometry.sql` permits 1972 and the
1976/1980/1984 → 1988 aliases, supplies the pre-reform name registry, and resets
any 1972 geometry attestation pending explicit review.
`20261115120000_election_history_1964_1968_geometry.sql` adds 1968 and its 1964
alias, fills missing registry entries using their source-local numbering and
requires explicit confirmation for these reconstructed elections.
`20261115130000_election_history_1956_1960_geometry.sql` permits the shared 1960
source for 1956/1960, maintains their historical registry and requires explicit
confirmation for these additional reconstructed elections.
`20261115150000_election_history_1952_regional_geometry.sql` enables 1952, adds
the explicit regional source-key field/registry and leaves legacy associations
unresolved rather than matching technical integers. Other existing selections
and confirmations are preserved;
no new legislature is assigned or confirmed automatically.

As superadmin, open **Administration → Wahldaten & Mandatshistorie →
Legislaturperioden**, edit the desired period, select **Historischer Grenzstand
für die Karte**, confirm the checked boundary/district-number assignment, then
save. Choose 1952 for its regional reconstruction, 1960 for 1956/1960, 1968 for 1964/1968, 1972 for its separate pre-reform reconstruction, 1988 for 1976/1980/1984/1988,
the matching year for 1992/1996/2001/2006/2011/2016, or 2021 for 2021/2026.
The editor derives its options from the generated manifest catalog.
**Für alle Tenants freigeben** remains the separate publication switch.

Only that selected legislature is loaded by the existing scoped RPC. Its confirmed
shapes are attached in browser memory; individual historical shapes retain
precedence. No geometry is copied into district rows. Year/version edits clear
the editor confirmation; district-number assignment changes invalidate it in
PostgreSQL. Existing superadmin RLS and history auditing apply. Packaging changes
do not create historical result identities or attest source correctness.

## Consistent 1992–2006 archive (2026-11-15)

The uploaded `LTWahlkreise1992-2006-konsistent.zip` supplies the three additional
election years and replaces the earlier 2006 source with its consistent version.
Its accompanying report describes coordinate alignment for historically unchanged
constituencies. [Supplied source notes](sources/1992-2006-konsistent.md) are retained
as provenance; the bundled Python reconstruction script was not executed. The
packer independently matches only exact coordinate structures after canonical
ring/order normalization. No additional simplification, quantization or repair
was applied, and source-result metadata are not treated as a new attestation.

## 1988: Mannheim III, not Wiesloch (2026-11-15)

The supplied `LTWahlkreise1988-BW_konsistent.topojson` contains exactly 70
districts. District 37 is **Mannheim III** with its own Mannheim geometry; there
is no separate Wiesloch feature. Starting in 1992, district 37 is **Wiesloch**
with a different shape identity. The 1988 manifest retains its own name even when
other shapes are reused. Never establish identity between the two by number 37.

The 1988 migration updates only the name of existing history district-37 rows in
periods with election_year=1988. It preserves district IDs, mandates, candidacies
and later years, and inserts no additional district. A database trigger also
normalizes future 1988 district-37 writes to Mannheim III and rejects a separate
district named Wiesloch in that year. Apply this migration before using the new
1988 selection. Period confirmation remains explicit.

## 1972 reconstruction and 1976–1984 aliases (2026-11-15)

The user explicitly confirmed that 1976, 1980 and 1984 have the same boundaries
as 1988. This correspondence lives in `electoralGeometryCatalog.ts` and the
period constraint. No extra manifest is necessary; confirmation remains per
legislature. District 37 is Mannheim III for each of these four elections.

The supplied `LTWahlkreise1972-BW_konsistent.zip` is a **historical reconstruction**,
not an official original boundary map. Its stated reference date is 1971-10-01;
modern subdivisions were used to approximate some inner-city and former municipal
boundaries. [Supplied methodology and licenses](sources/1972-source-notes.md) and
[the source name list](sources/1972-district-names.csv) are retained as provenance.
The included Python reconstruction scripts were not executed. No simplification,
quantization, reprojection or further repair was performed during packaging.

The 70 1972 names/numbers are used independently of later years: 37 Bruchsal,
31–33 Mannheim-Stadt I/II/III, and 1–5 Stuttgart I–V. The migration corrects
same-year labels, inserts only missing 1972 registry numbers and preserves
existing IDs, district numbers, individual boundaries, mandates and candidacy
links. It does not map a post-reform district to a 1972 district. The read adapter
also normalizes these explicit source labels so lists, search and map labels
agree. The reconstruction notice asks administrators to review the associations.

Historical map/editor/preview and analysis previews display the reconstruction
status, limitations and source/license credits. Leaflet attribution includes BKG
and LGL for 1972. The confirmed-geometry analysis adapter excludes reconstructed
1972 from automatically deriving verified cross-year identities. Explicitly
assigned analysis geometry keeps precedence; a reconstruction cannot silently
replace it. Displaying a reconstructed map is distinct from confirming official
historical comparability.

After adding 1968, its 41 exactly shared shapes are packaged jointly with 1972;
the other 29 forms per dataset remain separate. Cold transfer sizes are reported
in the current table above. Datasets from 1988 onward retain their package URLs
and transfer sizes. Neither reconstructed dataset is preloaded by other elections.

## 1964/1968 reconstruction (2026-11-15)

The user confirmed identical boundaries for 1964 and 1968. The supplied 1968
TopoJSON is a reconstruction with reference date 1967-10-28; that is the 1968
source's date, not a claimed legal reference date for 1964. The notice makes this
source/alias distinction explicit. [Supplied source notes](sources/1968-source-notes.md),
[historical names](sources/1968-district-names.csv), and the
[geometry-difference list](sources/1968-changes-from-1972.csv) are retained.
The archive's Python scripts were not executed. No additional quantization,
simplification, reprojection or repair was applied.

All 70 source CSV names match the TopoJSON properties. These name/number pairs
also match the supplied 1972 CSV, but 29 of the reconstructed forms differ.
In particular 37 is Bruchsal; Mannheim-Stadt I–III occupy 31–33, and Stuttgart
I–V occupy 1–5. The migration and read adapter use the explicit 1968 labels for
1964/1968 and do not translate post-reform district numbers. Existing IDs,
individual shapes, mandates and candidacies are preserved. Only missing registry
rows are added, and publication/geometry confirmation remain explicit.

Reconstruction notices and BKG/LGL attribution now select the correct source
for both reconstructed families. The analysis adapter's existing reconstruction
guard therefore also excludes 1964/1968 from automatically inferred verified
cross-year identities. Merely sharing a name/number never establishes identity.

## 1956/1960 reconstruction (2026-11-15)

The user confirmed identical boundaries for 1956 and 1960. The supplied
`LTWahlkreise1960-BW_konsistent.zip` contains 70 uniquely numbered districts with
names matching the source CSV. It also contains exactly the same arc arrays,
polygon types and polygon references as the previously supplied 1968 topology.
Consequently all 70 forms reuse existing packages: there are **no new geometry
packages**, only a small 1960 manifest with its own historical properties.
The supplied archive's reconstruction scripts were not executed.

[Source notes](sources/1960-source-notes.md) and the
[historical name list](sources/1960-district-names.csv) are retained. The 1960
source uses 1960-05-15 as reference date and cites the 1955 electoral law. This
is kept separate from the 1968 source's 1967-10-28 reference date. The 1956 alias
reflects the user's confirmation, not a claimed 1960 legal reference date for
1956. Equal reconstructed coordinates are not proof of unchanged original
small-area boundaries. All reconstructed source families retain their notices,
source links and BKG/LGL credits and are excluded from automatically inferred
verified cross-year identities.

The migration corrects same-year source labels and fills missing registry rows
only in existing 1956/1960 periods. It preserves IDs, district numbers,
individual shapes, mandates and candidacy links and never renumbers or reconnects
records by matching later labels. Publication and geometry confirmation remain
explicit. The UI offers the source family as **Grenzen 1956 / 1960 (Rekonstruktion)**.
No additional quantization, simplification, rounding or reprojection is applied.

## 1952: 74 regional constituencies (2026-11-15)

The supplied `LTWahlkreise1952-BW_konsistent.topojson` differs from the later
70-district system. Its metadata give 1952-03-09 as reference date and explicitly
state locally approximated boundaries. The subsequently supplied
[1952 source notes](sources/1952-source-notes.md) document the BKG/LGL basis,
licenses and original election report. The UI now includes these specific
credits and citations. This was the election to the Verfassunggebende
Landesversammlung, not a regular Landtagswahl under the 1955 electoral law.

The [source registry](sources/1952-district-registry.csv) preserves all names,
regional historical numbers and separate technical identifiers:

| Region | District count | Historical numbers | Technical IDs |
| --- | ---: | --- | --- |
| NW | 28 | 1–28 | 1–28 |
| NB | 17 | 29–45 | 29–45 |
| SB | 16 | 1–16 | 46–61 |
| SWH | 13 | 1–13 | 62–74 |

Historical 1 is therefore not globally unique. The source identity combines
1952 + region + historical number, e.g. `1952:SB:1`. Technical 37 is NB 37,
Heidelberg-Land; it is not the later Bruchsal/Mannheim III/Wiesloch.

The migration creates 74 source-bound registry rows per existing 1952 period,
with null `district_number`, a regional `number_label`, and an explicit
`geometry_source_key`. A partial unique index makes these assignments stable.
Source-bound rows are normalized by the existing role-protected write path;
source-key edits invalidate period geometry confirmation. Existing legacy IDs,
numbers, individual boundaries and mandate/candidacy links are not merged,
renumbered or matched automatically. If legacy records exist, they remain marked
as unresolved; administrators can explicitly review their assignments under
**Mandate**. No identity is inferred from identical names or technical integers.

The loader and packer expect exactly 74 technical IDs for 1952, while every other
year continues to require 70. Manifest validation additionally checks each 1952
region/historical-number combination against its source registry. The historical
map attaches shared geometry by source key only, never by the legacy bare number.
Map markers, tooltips, search, lists and fallback views use regional labels such
as NW 1 / SB 1 / SWH 1. The numeric 1–74 remains internal to Leaflet layout only.
Searching SB1 finds SB 1; searching 1 finds the matching historical numbers in
multiple regions, not arbitrary technical IDs.

The analysis preview labels regional areas but never treats 1952 technical IDs
as result-district links or derives verified comparison identities. Reconstruction
notices remain visible. No quantization, rounding, simplification or coordinate
repair is performed during packaging.

## Confirmed 1952 name list and provenance (2026-11-15)

The subsequently supplied [historical name list](sources/1952-district-names.csv)
matches all 74 technical IDs, region codes, historical numbers and names already
extracted from the supplied TopoJSON. No geometry, district ID, number, name or
mandate association needed to change; no package/manifest regeneration or new
database migration is necessary. The CSV's historical eligible-voter counts are
retained as source metadata only, not imported as election-analysis results.

The README provides the election report for the Verfassunggebende Landesversammlung
on 1952-03-09, the 1952 legal notices, BKG VG-Hist provenance/CC BY 4.0 and LGL
ALKIS provenance/Datenlizenz Deutschland – Namensnennung 2.0. These credits now
appear in map attribution and reconstruction notices. Its explicit limitations
are also surfaced: the Freiburg SB 7/8 split is approximated, the historical
Hartheim in Landkreis Stockach cannot be reliably equated with today's Hartheim
near Meßstetten, and Duchtlingen lacks its own polygon in the modern input.
The source's reported checks are retained as supplied provenance; their scripts
were not run during this update. Original geometric accuracy remains qualified.
