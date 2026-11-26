import { sectionLabels } from './model';

export type AnalysisView = keyof typeof sectionLabels;
export type AnalysisCheck = 'quality' | 'sources';
export type DataTab = 'land' | 'wahlkreise' | 'parlament' | 'simulation';
export type PrimaryView = Exclude<AnalysisView, AnalysisCheck | 'turnout-trend'>;

export const dataPillars: ReadonlyArray<{
  id: DataTab;
  label: string;
  sections: readonly PrimaryView[];
}> = [
  { id: 'land', label: 'Landesdaten & Trends', sections: ['state', 'history', 'demographics', 'flows'] },
  { id: 'wahlkreise', label: 'Wahlkreise & Regionen', sections: ['profile', 'districts', 'swing', 'split'] },
  { id: 'parlament', label: 'Parlament & Mandate', sections: ['deputies', 'mandates'] },
  { id: 'simulation', label: 'Rechner & Wahlforschung', sections: ['seats', 'research'] },
];

function isView(value: string | null): value is AnalysisView {
  return value !== null && Object.prototype.hasOwnProperty.call(sectionLabels, value);
}
function isCheck(value: string | null): value is AnalysisCheck {
  return value === 'quality' || value === 'sources';
}
function pillarFor(section: PrimaryView) {
  return dataPillars.find(pillar => pillar.sections.includes(section)) || dataPillars[0];
}

/** Canonical sub wins; legacy section/tool URLs remain readable without preloading views. */
export function resolveAnalysisNavigation(params: URLSearchParams) {
  const requestedTab = dataPillars.find(pillar => pillar.id === params.get('dataTab'));
  const raw = params.get('sub') || params.get('analysisSection');
  let view: AnalysisView | undefined;
  let researchTool = params.get('researchTool') || 'typology';
  let showTurnout = params.get('historyDetails') === 'turnout';
  let flowMatrix = false;
  const check: AnalysisCheck | null = null;
  if (raw === 'turnout') { view = 'history'; showTurnout = true; }
  else if (raw === 'flow-matrix') { view = 'flows'; flowMatrix = true; }
  else if (isView(raw)) view = raw;
  if (view && isCheck(view)) view = undefined;
  if (view === 'turnout-trend') { view = 'research'; researchTool = 'turnout'; }
  if (view === 'research' && researchTool === 'seats') view = 'seats';
  // Old calculator bookmarks now reach the statutory model.
  if (!view && !requestedTab && params.get('dataTool') === 'rechner') view = 'seats';
  const section: PrimaryView = view || requestedTab?.sections[0] || 'state';
  const pillar = pillarFor(section);
  return { section, pillar, researchTool, check, showTurnout, flowMatrix };
}

/** Write both names together so legacy link producers and canonical bookmarks agree. */
export function analysisDestination(previous: URLSearchParams, section: PrimaryView): URLSearchParams {
  const next = new URLSearchParams(previous);
  next.set('dataTab', pillarFor(section).id);
  next.set('sub', section);
  next.set('analysisSection', section);
  next.delete('dataTool');
  next.delete('analysisCheck');
  if (section === 'seats') next.set('researchTool', 'seats');
  else if (section === 'research' && next.get('researchTool') === 'seats') next.delete('researchTool');
  return next;
}

export function normalizeAnalysisParams(params: URLSearchParams): URLSearchParams {
  const route = resolveAnalysisNavigation(params);
  const next = analysisDestination(params, route.section);
  next.delete('analysisCheckYear');
  if (route.showTurnout) next.set('historyDetails', 'turnout');
  if (route.section === 'research') next.set('researchTool', route.researchTool);
  if (route.flowMatrix && !params.has('analysisYear')) next.set('analysisYear', '2006');
  return next;
}

/** Same-election numeric labels only; never infer a historical cross-year identity. */
export function districtProfileUrl(year: number | null, districtLabel: string | null): string | null {
  if (year === null || year < 1956 || !districtLabel || !/^\d+$/.test(districtLabel)) return null;
  const district = Number(districtLabel);
  if (district < 1 || district > 70) return null;
  const params = analysisDestination(new URLSearchParams(), 'profile');
  params.set('analysisYear', String(year));
  params.set('analysisDistrict', String(district));
  return `/daten?${params}`;
}

export function deputyProfileUrl(profileKey: string) {
  const params = analysisDestination(new URLSearchParams(), 'deputies');
  params.set('abgeordneter', profileKey);
  return `/daten?${params}`;
}
