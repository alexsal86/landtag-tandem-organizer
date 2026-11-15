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
within each package are deduplicated as well. There are now 120 distinct
forms across seven boundary years (490 district entries):

| Package usage | Distinct forms | Gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| 1992,1996,2001 | 11 | 680,162 | 515,836 |
| 1992,1996,2001,2006 | 26 | 1,392,338 | 1,047,972 |
| 1992,1996,2001,2006,2011,2016,2021 | 33 | 1,442,829 | 1,090,476 |
| 2006 | 11 | 695,709 | 527,205 |
| 2011,2016 | 2 | 106,409 | 80,372 |
| 2011,2016,2021 | 35 | 1,663,006 | 1,251,662 |
| 2021 | 2 | 115,519 | 87,298 |

1992, 1996 and 2001 reuse all 70 forms. The consistent 2006 source shares
33 forms with the newer years. The other historical shapes remain independent;
no tolerance is used to declare geometries identical.

| Selected year | Cold requests (manifest + packages) | Gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| 1992 | 4 | 3,518,985 | 2,657,623 |
| 1996 | 4 | 3,518,985 | 2,657,623 |
| 2001 | 4 | 3,518,985 | 2,657,634 |
| 2006 | 4 | 3,534,539 | 2,668,999 |
| 2011 | 4 | 3,215,907 | 2,425,860 |
| 2016 | 4 | 3,215,907 | 2,425,858 |
| 2021 / 2026 | 4 | 3,225,044 | 2,432,764 |

Switching 1992 → 1996 adds only the 3,656-byte gzip manifest;
1996 → 2001 adds only 3,656 bytes. Switching 2001 → 2006
adds 699,372 gzip bytes for its manifest and 11 changed shapes.
Switching 2021 → 2011 adds 110,072 bytes for the manifest and
two changed forms. 2011 → 2016 adds only the 3,663-byte
manifest; 2021 → 2026 needs no additional geometry.

These are generated transfer sizes excluding HTTP overhead, not browser timing
measurements. Splitting shared boundaries between more reuse groups can increase
a cold year's download relative to the earlier four-year build; the loader still
fetches no other year's unused forms and preserves incremental reuse.

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
node scripts/geometry/pack-election-topology.mjs 1992=path/to/LTWahlkreise1992-BW_konsistent.topojson 1996=path/to/LTWahlkreise1996-BW_konsistent.topojson 2001=path/to/LTWahlkreise2001-BW_konsistent.topojson 2006=path/to/LTWahlkreise2006-BW_konsistent.topojson 2011=path/to/LTWahlkreise2011-BW.topojson.json 2016=path/to/LTWahlkreise2016-BW.topojson 2021=path/to/LTWahlkreise2021_bereinigt.topojson.json
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
1992/1996/2001 selections. Existing selections and confirmations are preserved;
no new legislature is assigned or confirmed automatically.

As superadmin, open **Administration → Wahldaten & Mandatshistorie →
Legislaturperioden**, edit the desired period, select **Historischer Grenzstand
für die Karte**, confirm the checked boundary/district-number assignment, then
save. Choose the matching year (1992, 1996, 2001, 2006, 2011, 2016), or 2021 for 2021/2026.
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
