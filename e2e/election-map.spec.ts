import { expect, test } from '@playwright/test';

// Synthetic records and identity only; no live service receives test requests.
test.use({ viewport: { width: 1400, height: 1000 }, serviceWorkers: 'block' });
test('BW polygons, independent layers, search, data gaps and mobile sidebar', async ({ page, context }) => {
  const user = { id: '33333333-3333-4333-8333-333333333333', email: 'map@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Map Test' } };
  const tenant = { id: '11111111-1111-4111-8111-111111111111', name: 'Testbüro', settings: {}, is_active: true, created_at: '2026-01-01T00:00:00Z' };
  const boundary = { type: 'Polygon', coordinates: [[[8.5, 48.5], [9, 48.5], [9, 49], [8.5, 49], [8.5, 48.5]]] };
  const base = { region: 'BW', district_type: 'wahlkreis', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', population: 100000, area_km2: 100 };
  const districts = [
    { ...base, id: 'district-a', district_number: 1, district_name: 'Stuttgart I', boundaries: boundary, center_coordinates: { lat: 48.75, lng: 8.75 }, representatives: [{ id: 'rep-a', name: 'Test Person', party: 'SPD', mandate_type: 'direct', order_index: 0 }] },
    { ...base, id: 'district-b', district_number: 11, district_name: 'Geislingen', boundaries: null, center_coordinates: { lat: 48.6, lng: 9.4 }, representatives: [] },
    { ...base, id: 'admin-a', district_number: 1, district_name: 'Verwaltungsgebiet', district_type: 'verwaltungsgrenze', boundaries: boundary, center_coordinates: { lat: 48.75, lng: 8.75 } },
    { ...base, id: 'broken', district_number: 12, district_name: 'Defektes Gebiet', boundaries: { type: 'Polygon', coordinates: [] }, center_coordinates: null, representatives: [] },
  ];
  let includeNewDistrict = false;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('https://**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith('tile.openstreetmap.org')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eee"/></svg>' });
    if (url.hostname !== 'wawofclbehbkebjivdte.supabase.co') return route.abort();
    const path = url.pathname;
    const single = route.request().headers()['accept']?.includes('object+json');
    let data: unknown = single ? null : [];
    if (path.endsWith('/auth/v1/user')) data = user;
    else if (path.endsWith('/election_districts')) {
      if (url.searchParams.has('id')) {
        expect(url.searchParams.get('select')).toContain('boundaries');
        expect(url.searchParams.get('select')).toContain('center_coordinates');
        expect(url.searchParams.get('select')).toContain('district_number');
      }
      data = url.searchParams.has('id') ? districts.filter(d => d.id === 'admin-a') : [...districts, ...(includeNewDistrict ? [{ ...districts[0], id: 'new', district_number: 3, district_name: 'Neu', center_coordinates: { lat: 48.9, lng: 8.9 } }] : [])];
    } else if (path.endsWith('/party_associations')) data = [{ id: 'association', tenant_id: tenant.id, name: 'Test-Kreisverband', party_name: 'Grüne', party_type: 'kreisverband', administrative_boundaries: ['admin-a'], created_at: base.created_at, updated_at: base.updated_at }];
    else if (path.endsWith('/user_tenant_memberships')) {
      const membership = { id: 'membership', user_id: user.id, tenant_id: tenant.id, role: 'abgeordneter', is_active: true, tenant };
      data = single ? membership : [membership];
    } else if (path.endsWith('/tenants')) data = single ? tenant : [tenant];
    else if (path.endsWith('/user_onboarding_state')) data = { completed_at: base.created_at };
    else if (path.endsWith('/profiles')) {
      const profile = { id: 'profile', user_id: user.id, display_name: 'Map Test', tenant_id: tenant.id, avatar_url: null };
      data = single ? profile : [profile];
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await context.addInitScript(({ user }) => {
    const payload = btoa(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('sb-wawofclbehbkebjivdte-auth-token', JSON.stringify({ access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.synthetic`, refresh_token: 'synthetic', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
  }, { user });

  await page.goto('/karten');
  const search = page.getByRole('searchbox', { name: 'Wahlkreis suchen' });
  await expect(search).toBeVisible();
  const polygons = page.locator('.leaflet-overlay-pane path');
  const markers = page.locator('.custom-district-marker');
  await expect(polygons).toHaveCount(1);
  await expect(markers).toHaveCount(2);
  await expect(page.locator('summary')).toContainText('2 angezeigten Gebieten');
  const z = await page.locator('.leaflet-container').evaluate(el => Object.fromEntries(['tile', 'overlay', 'marker', 'tooltip', 'popup'].map(name => [name, Number(getComputedStyle(el.querySelector(`.leaflet-${name}-pane`)!).zIndex)])));
  expect(z.tile).toBeLessThan(z.overlay);
  expect(z.overlay).toBeLessThan(z.marker);
  expect(z.marker).toBeLessThan(z.tooltip);
  expect(z.tooltip).toBeLessThan(z.popup);
  await markers.filter({ hasText: '1' }).first().hover();
  await expect(page.locator('.leaflet-tooltip')).toContainText('Test Person');

  const initialMarkerWidth = await markers.first().locator('div').evaluate(el => el.getBoundingClientRect().width);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect.poll(() => markers.first().locator('div').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(initialMarkerWidth);

  await page.getByLabel('Farbige Flächen', { exact: true }).uncheck();
  await expect(polygons).toHaveCount(0);
  await expect(markers).toHaveCount(2);
  await page.getByLabel('Nummernkreise', { exact: true }).uncheck();
  await expect(markers).toHaveCount(0);
  await page.getByLabel('Farbige Flächen', { exact: true }).check();
  await expect(polygons).toHaveCount(1);
  await page.getByLabel('Nummernkreise', { exact: true }).check();
  await page.getByLabel('Verwaltungsgrenzen (1)', { exact: true }).check();
  await expect(polygons).toHaveCount(2);
  expect(await polygons.nth(0).getAttribute('fill')).toBe('#dc2626');
  expect(await polygons.nth(1).getAttribute('fill')).toBe('#8B5CF6');
  await page.getByLabel('Verwaltungsgrenzen (1)', { exact: true }).uncheck();
  await page.getByLabel('Grüne Kreisverbände', { exact: true }).check();
  await expect(polygons).toHaveCount(2);
  await expect(page.locator('.party-association-marker')).toHaveCount(1);
  await page.getByLabel('Grüne Kreisverbände', { exact: true }).uncheck();

  await search.fill(' unbekannt ');
  await expect(page.getByRole('status').filter({ hasText: '0 Treffer' })).toBeVisible();
  await search.fill('1');
  await expect(page.locator('#district-search-results button')).toHaveCount(1);
  await search.press('Enter');
  await expect(page.locator('#district-sidebar')).toContainText('Stuttgart I');
  await search.fill('geislingen');
  await page.getByRole('button', { name: 'WK 11: Geislingen', exact: true }).click();
  await expect(page.locator('#district-sidebar')).toContainText('Für dieses Gebiet fehlen nutzbare Grenzdaten.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => {
    const marker = await markers.filter({ hasText: /^11$/ }).boundingBox();
    const map = await page.locator('.leaflet-container').boundingBox();
    return marker && map ? Math.hypot(marker.x + marker.width / 2 - map.x - map.width / 2,
      marker.y + marker.height / 2 - map.y - map.height / 2) : Infinity;
  }).toBeLessThan(10);

  // Newly available geometry must render after the next data load.
  includeNewDistrict = true;
  await page.reload();
  await expect(polygons).toHaveCount(2);
  await expect(markers).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#district-sidebar')).toBeHidden();
  await expect(search).toBeVisible();
  await page.getByRole('button', { name: 'Ebenen & Infos' }).click();
  await expect(page.getByLabel('Farbige Flächen', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Optionen schließen' }).click();
  await expect(page.locator('#district-sidebar')).toBeHidden();
  const mapBox = await page.locator('.leaflet-container').boundingBox();
  expect(mapBox!.width).toBeGreaterThan(300);
  expect(mapBox!.x + mapBox!.width).toBeLessThanOrEqual(391);
  expect(errors).toEqual([]);
});
