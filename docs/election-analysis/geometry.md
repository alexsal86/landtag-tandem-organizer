# Shared election topology

The supplied unquantized 2006, 2011, 2016 and cleaned 2021 TopoJSON files are packed into
one topology. 2026 selects the 2021 object (user-confirmed identical boundaries).
No rounding, quantization, simplification or approximate matching takes place.
Only byte-identical coordinate arrays, including reversed arcs, are shared.
Both years retain their original geometry references and properties.

Regenerate from the archived source files:

```sh
node scripts/geometry/pack-election-topology.mjs 2006=path/to/2006.topojson 2011=path/to/2011.topojson 2016=path/to/2016.topojson 2021=path/to/2021.topojson
```

The resulting topology has 3,447 arcs instead of 4,202 across the input files.
The canonical JSON is 13,388,651 bytes; gzip level 9 is 5,330,486 bytes;
Brotli quality 11 is 3,981,882 bytes. SHA-256 in the filename identifies the
uncompressed content. Never replace a published asset in place.

The browser fetches the explicit `.gz` representation so compression also works
on static hosting without content negotiation, then decodes it with the browser's
DecompressionStream. The public compressed response is cached in Cache Storage
for at most 1,825 days; failed cache access falls back to network. This is a
best-effort cache: browsers can evict stored data earlier. Changing the content
hash immediately selects a fresh asset. Shared in-memory loading avoids downloading
again when switching between 2006, 2011, 2016, 2021 and 2026. No election results or private
data enter this cache.

`public/_headers` sets a five-year immutable HTTP policy on hosts that support
this file. Other production hosts must configure the equivalent policy. The
repository's deployment workflow is a placeholder, so live server headers cannot
be configured or verified here. Brotli and gzip sidecars are provided for servers
supporting precompressed content negotiation, for example Nginx:

```nginx
location /data/geometry/ {
    gzip_static on;
    # Requires the ngx_brotli module:
    brotli_static on;
    add_header Cache-Control "public, max-age=157680000, immutable";
    add_header Vary Accept-Encoding;
}
```

To prefer negotiated Brotli on such a host, request the canonical `.topojson`
URL in `fetchTopology`; the browser handles Content-Encoding automatically.
Keep the explicit gzip route on hosts without that capability. Do not set
Content-Encoding on a gzip sidecar unless the server actually sends gzip bytes.

The existing verified district-identity rules remain independent of rendering:
using a supplied boundary asset does not automatically attest cross-year result
comparability. Unknown or unverified comparisons remain unknown.

## Historical member map: enable a legislature

Deploy migration `20261115010000_election_history_shared_geometry.sql` before the
updated frontend. No existing legislature is automatically assigned or confirmed.
As superadmin, open **Administration → Wahldaten & Mandatshistorie →
Legislaturperioden**, edit the desired period and choose **Historischer Grenzstand
für die Karte**. Select the matching boundary year (2006, 2011, 2016), or 2021 for 2021/2026. Confirm
that the boundary version and district-number assignments have been checked, then
save. **Für alle Tenants freigeben** remains the separate legislature publication
switch. Use **Periode prüfen** to see the confirmed version and remaining gaps.

The selected legislature is loaded through the existing scoped RPC. Only after
confirmation does the browser load its shared topology object and attach shapes
in memory by the explicitly confirmed district numbers. Existing individual
historical shapes take precedence. No geometry is copied into district rows, no
mandates or analysis identities are changed. Changing the year/version in the
editor clears confirmation. Adding/removing districts or changing their number
assignments clears confirmation in the database. Existing superadmin RLS and the
history audit cover these updates. Published periods expose the confirmed map to
tenants; drafts remain restricted by the existing policies.

## Corrected 2021/2026 source (2026-11-15)

Replaced `LTWahlkreise2021_korrigiert (1).topojson` with the user-supplied
`LTWahlkreise2021_bereinigt.topojson.json`. The supplied cleanup removes the
fragmented areas near Hirrlingen/Starzach: district 62 now has one polygon and
one interior ring; district 63 has one polygon without interior rings. All 70
districts are present. The original 2016 source is unchanged. No additional
quantization, rounding, simplification or geometry repair was applied.

That release of the shared asset used SHA-256
`e4c714578b5f621b3c5c17b9f35d159d1e4ab3260c5960e1d4edd2c88b4b8da2`.
The frontend now requests that new URL; older cache entries are retired by the
existing loader. The superseded defective asset and sidecars were removed from
the current source tree; they remain available in Git history.

## Added 2006 and 2011 sources (2026-11-15)

Added the supplied `LTWahlkreise2006-BW.topojson` and
`LTWahlkreise2011-BW.topojson.json` as separate objects in the same shared
unquantized topology, with 70 uniquely numbered districts per year. The 2016 and
cleaned 2021 source files are unchanged. 2026 continues to use the 2021 object.
No comparison identities or historical data are inferred or written.

The current content hash is
`dd98696d3be3b563545e70812c573ae8bf80552d8cbe4910365f0a271972ae4f`.
Deploy `20261115080000_election_history_2006_2011_geometry.sql` after the original
shared-geometry migration to allow 2006 and 2011 in the database constraint.
Then select and confirm the corresponding boundary year in each legislature's
editor. Existing confirmations remain untouched; new periods are not automatically
confirmed. The five-year cache policy is unchanged and the new content hash
selects the updated file on reload. Superseded sidecars are removed from the
current source tree and remain in Git history.
