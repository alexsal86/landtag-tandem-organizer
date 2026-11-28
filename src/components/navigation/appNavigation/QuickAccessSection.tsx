import { useState, type ReactNode } from "react";
import { ArrowLeft, Briefcase, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock3, FileText, Plus, Star, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildCaseItemHref, buildDocumentHref } from "@/lib/appTargets";
import type { QuickAccessPage } from "@/hooks/useQuickAccessPages";
import type { RecentlyVisitedPage } from "@/hooks/useRecentlyVisited";
import type { QuickAccessAddCategory } from "./types";
import type { useNavPanelData } from "./useNavPanelData";
import { SidebarIconButton } from "./SidebarControls";
import { resolveSavedNavigationHref, targetsSamePage } from "@/lib/quickAccessTargets";
import { Link, useLocation } from "react-router-dom";

const pageSize = 8;
const categories = [
  ["pages", "Seite hinzufügen"],
  ["case-items", "Vorgang hinzufügen"],
  ["documents", "Dokument hinzufügen"],
  ["event-plannings", "Veranstaltungs-/Terminplanung hinzufügen"],
] as const;

interface QuickAccessProps {
  compact: boolean;
  pages: QuickAccessPage[];
  options: QuickAccessPage[];
  addPage: (page: QuickAccessPage) => void;
  removePage: (id: string) => void;
  onNavigate: () => void;
  onVisitPage: (event: React.MouseEvent, route: string) => void;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  category: QuickAccessAddCategory | null;
  setCategory: (category: QuickAccessAddCategory | null) => void;
  data: ReturnType<typeof useNavPanelData>;
}

export function QuickAccessSection({
  compact, pages, options, addPage, removePage, onNavigate, onVisitPage, pickerOpen, setPickerOpen, category, setCategory, data,
}: QuickAccessProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [railOpen, setRailOpen] = useState(false);
  const pageCount = Math.max(1, Math.ceil(pages.length / pageSize));
  const index = Math.min(pageIndex, pageCount - 1);
  const closePicker = (open: boolean) => {
    setPickerOpen(open);
    if (!open) setCategory(null);
  };

  const itemOptions: Record<Exclude<QuickAccessAddCategory, "pages">, { pages: QuickAccessPage[]; loading: boolean }> = {
    "case-items": { pages: data.quickAccessCaseItems.map(item => ({
      id: `case-item-${item.id}`, label: item.label, icon: "Briefcase", route: buildCaseItemHref(item.id), type: "item",
    })), loading: data.isCaseItemsLoading },
    documents: { pages: data.quickAccessDocuments.map(item => ({
      id: `document-${item.id}`, label: item.label, icon: "FileText", route: buildDocumentHref(item.id), type: "item",
    })), loading: data.isDocumentsLoading },
    "event-plannings": { pages: data.quickAccessEventPlannings.map(item => ({
      id: `event-planning-${item.id}`, label: item.label, icon: "CalendarPlus", route: `/eventplanning/${item.id}?highlight=${item.id}`, type: "item",
    })), loading: data.isEventPlanningsLoading },
  };

  const picked = category === "pages" ? { pages: options, loading: false } : category ? itemOptions[category] : null;
  const picker = (
    <Popover open={pickerOpen} onOpenChange={closePicker}>
      <PopoverTrigger asChild>
        <button type="button" className="mission-icon" aria-label="Zum Schnellzugriff hinzufügen" title="Zum Schnellzugriff hinzufügen">
          <Plus aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent side={compact ? "bottom" : "right"} align="start" className="max-h-[min(420px,65dvh)] w-64 overflow-y-auto p-2">
        {!picked ? categories.map(([id, label]) => (
          <button key={id} type="button" className="mission-preview-link flex items-center justify-between gap-2" onClick={() => setCategory(id)}>
            {label}<ChevronRight className="size-4 shrink-0" aria-hidden="true" />
          </button>
        )) : (
          <>
            <button type="button" className="mission-preview-link flex items-center gap-2" onClick={() => setCategory(null)}>
              <ArrowLeft className="size-4" aria-hidden="true" /> Zurück
            </button>
            <h3 className="px-2 py-1 text-xs font-semibold">{categories.find(([id]) => id === category)?.[1]}</h3>
            {picked.loading ? <p role="status" className="p-2 text-xs">Wird geladen …</p>
              : !picked.pages.length ? <p className="p-2 text-xs">Keine Einträge gefunden</p>
              : picked.pages.map(page => {
                const added = pages.some(pin => targetsSamePage(pin, page));
                const Icon = added ? Check : Star;
                return (
                  <button key={page.id} type="button" disabled={added} className="mission-preview-link flex items-center gap-2 disabled:opacity-60"
                    onClick={() => { addPage(page); closePicker(false); }}>
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{page.label}</span>
                  </button>
                );
              })}
          </>
        )}
      </PopoverContent>
    </Popover>
  );

  const contents = (
    <>
      <div className="mission-section-heading">
        <h2>Schnellzugriff</h2>
        <div className="flex items-center">
          {pageCount > 1 && (
            <>
              <SidebarIconButton label="Vorherige Schnellzugriffe" disabled={index === 0} onClick={() => setPageIndex(index - 1)}><ChevronLeft /></SidebarIconButton>
              <SidebarIconButton label="Nächste Schnellzugriffe" disabled={index === pageCount - 1} onClick={() => setPageIndex(index + 1)}><ChevronRight /></SidebarIconButton>
            </>
          )}
          {picker}
        </div>
      </div>
      {pages.slice(index * pageSize, (index + 1) * pageSize).map(page => (
        <SavedRow key={page.id} page={page} onNavigate={event => { setRailOpen(false); onNavigate(); onVisitPage(event, page.route); }}
          action={<SidebarIconButton label={`${page.label} aus Schnellzugriff entfernen`} onClick={() => removePage(page.id)}><X /></SidebarIconButton>} />
      ))}
      {pageCount > 1 && <p className="mission-meta px-2" aria-live="polite">Seite {index + 1} von {pageCount}</p>}
    </>
  );

  if (!compact) return <section aria-label="Schnellzugriff">{contents}</section>;
  return (
    <Popover open={railOpen} onOpenChange={setRailOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="mission-icon" aria-label="Schnellzugriff" title="Schnellzugriff"><Star aria-hidden="true" /></button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" aria-label="Schnellzugriff" className="mission-popover w-64 max-h-[70dvh] overflow-y-auto p-2">
        {contents}
      </PopoverContent>
    </Popover>
  );
}

function SavedRow({ page, action, onNavigate, recent }: {
  page: QuickAccessPage | RecentlyVisitedPage; action: ReactNode; onNavigate: (event: React.MouseEvent) => void; recent?: boolean;
}) {
  const { pathname, search } = useLocation();
  const href = resolveSavedNavigationHref(page.route);
  const Icon = recent ? Clock3 : ({
    Briefcase, FileText, CalendarPlus,
  }[page.icon] ?? Star);
  return (
    <div className="mission-row mission-saved-row">
      <Link to={href} onClick={onNavigate} aria-current={href === pathname + search ? "page" : undefined} className="mission-link" title={page.label}>
        <Icon aria-hidden="true" />
        <span className="truncate">{page.label}</span>
      </Link>
      <div className="mission-row-actions">{action}</div>
    </div>
  );
}

export function RecentlyVisitedSection({ pages, favorites, onNavigate, onVisitPage, togglePin, compact }: {
  pages: RecentlyVisitedPage[]; favorites: QuickAccessPage[]; onNavigate: () => void;
  togglePin: (page: RecentlyVisitedPage) => void; compact: boolean;
  onVisitPage: QuickAccessProps["onVisitPage"];
}) {
  const [open, setOpen] = useState(false);
  if (!pages.length) return null;
  const contents = (
    <>
      <div className="mission-section-heading"><h2>Kürzlich besucht</h2></div>
      {pages.slice(0, 5).map(page => (
        <SavedRow key={page.id} page={page} recent onNavigate={event => { setOpen(false); onNavigate(); onVisitPage(event, page.route); }}
          action={<SidebarIconButton label={favorites.some(pin => targetsSamePage(pin, page)) ? `${page.label} aus Schnellzugriff entfernen` : `${page.label} anheften`}
            onClick={() => togglePin(page)}><Star /></SidebarIconButton>} />
      ))}
    </>
  );
  return compact ? (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="mission-icon" aria-label="Kürzlich besucht" title="Kürzlich besucht"><Clock3 aria-hidden="true" /></button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" aria-label="Kürzlich besucht" className="mission-popover w-64 p-2">{contents}</PopoverContent>
    </Popover>
  ) : <section aria-label="Kürzlich besucht">{contents}</section>;
}
