# Election geometry: shared district forms and selected-year manifests

The public map no longer downloads one archive containing all election years.
Each distinct district shape has a SHA-256 identity. A small manifest per boundary
year maps district numbers/properties to shape identities and their package URLs.
2026 resolves to the 2021 manifest, as confirmed by the user. District properties
remain year-specific; names/numbers are not inferred from another year's shape.

The packer compares exact coordinates, canonicalizing only ring start/direction,
hole order and polygon order. No rounding, quantization, simplification, point
thinning or approximate matching occurs. Stored forms retain the first matching
source's original coordinates and topology. Polygon/MultiPolygon wrappers with
identical polygon coordinates can share a form. Comparison keys omit only the
repeated closing point; stored rings retain it.

Unique forms are grouped by the set of boundary years which need them. This
keeps requests bounded without fetching other years' unused forms. Shared arcs
within each package are deduplicated as well. Currently there are 142 distinct
forms across four boundary years (280 district entries):

| Package usage | Distinct forms | Gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| 2011, 2016, 2021 | 68 | 2,583,423 | 1,945,288 |
| 2011, 2016 | 2 | 106,409 | 80,372 |
| 2021 | 2 | 115,519 | 87,298 |
| 2006 | 70 | 2,693,055 | 2,015,259 |

The supplied 2006 coordinates do not exactly match the later shapes, so they
remain distinct. No tolerance is used to declare them identical.

| Selected year | Cold requests (manifest + packages) | Gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| 2006 | 2 | 2,696,609 | 2,018,506 |
| 2011 | 3 | 2,693,446 | 2,028,957 |
| 2016 | 3 | 2,693,446 | 2,028,960 |
| 2021 / 2026 | 3 | 2,702,560 | 2,035,856 |

The previous cold gzip download was 5,330,486 bytes regardless of year. A switch
from 2021 to 2011 now needs just 110,023 gzip bytes: the new manifest and two
changed forms. A switch from 2011 to 2016 needs only the 3,614-byte manifest;
2021 to 2026 needs no additional geometry. These are generated transfer sizes,
excluding HTTP overhead, not browser timing measurements.

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
node scripts/geometry/pack-election-topology.mjs 2006=path/to/LTWahlkreise2006-BW.topojson 2011=path/to/LTWahlkreise2011-BW.topojson.json 2016=path/to/LTWahlkreise2016-BW.topojson 2021=path/to/LTWahlkreise2021_bereinigt.topojson.json
```

The script writes hashed packages/manifests with gzip/Brotli representations and
generates `src/utils/electoralTopologyAsset.ts`. Future additions recompute exact
shape sharing; package addresses change only when their serialized contents
change. Remove superseded generated assets from the current tree when publishing.
The Tailwind scanner excludes `public/data` to avoid scanning large geometry JSON.

## Historical member map: confirmation

Existing database migrations remain necessary for period-specific selection:
`20261115010000_election_history_shared_geometry.sql`, then
`20261115080000_election_history_2006_2011_geometry.sql`. This packaging change
needs no new database migration and preserves existing selections/confirmations.

As superadmin, open **Administration → Wahldaten & Mandatshistorie →
Legislaturperioden**, edit the desired period, select **Historischer Grenzstand
für die Karte**, confirm the checked boundary/district-number assignment, then
save. Choose the matching year (2006, 2011, 2016), or 2021 for 2021/2026.
**Für alle Tenants freigeben** remains the separate publication switch.

Only that selected legislature is loaded by the existing scoped RPC. Its confirmed
shapes are attached in browser memory; individual historical shapes retain
precedence. No geometry is copied into district rows. Year/version edits clear
the editor confirmation; district-number assignment changes invalidate it in
PostgreSQL. Existing superadmin RLS and history auditing apply. Packaging changes
do not create historical result identities or attest source correctness.
