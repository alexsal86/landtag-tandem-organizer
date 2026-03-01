import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Link2, Network, Orbit, Save, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type LayoutMode = "radial" | "cluster";

interface StakeholderContact {
  id: string;
  name: string;
  tags: string[] | null;
}

interface NetworkNode {
  id: string;
  label: string;
  x: number;
  y: number;
  degree: number;
  dominantTag: string;
}

interface NetworkEdge {
  source: string;
  target: string;
  weight: number;
  sharedTags: string[];
}

interface NormalizedContact {
  id: string;
  name: string;
  normalizedTags: string[];
}

interface NetworkPreset {
  id: string;
  name: string;
  layoutMode: LayoutMode;
}

const MAX_NODES = 14;
const SVG_SIZE = 500;
const CENTER = SVG_SIZE / 2;
const BASE_RADIUS = 150;
const TAG_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const DEFAULT_TAG_SYNONYMS: Record<string, string> = {
  "verkehrspolitik": "verkehr",
  "verkehrs-politik": "verkehr",
  "mobilitaet": "verkehr",
  "wirtschaftspolitik": "wirtschaft",
  "wirtschafts-politik": "wirtschaft",
  "bildungs-politik": "bildung",
  "schule": "bildung",
  "schulen": "bildung",
};

const DEFAULT_PRESETS: NetworkPreset[] = [
  { id: "overview-radial", name: "Übersicht (Kreis)", layoutMode: "radial" },
  { id: "themen-cluster", name: "Themen-Cluster", layoutMode: "cluster" },
];

const prettifyTag = (tag: string) =>
  tag
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export function StakeholderNetworkWidget() {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("radial");
  const [activePresetId, setActivePresetId] = useState<string>(DEFAULT_PRESETS[0].id);

  const { currentTenant, loading: tenantLoading } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();

  const userPresetKey = `stakeholder-network-presets-${user?.id || "anonymous"}`;

  const { data: appTagSynonyms } = useQuery({
    queryKey: ["stakeholder-network-tag-synonyms", currentTenant?.id],
    enabled: !!currentTenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("tenant_id", currentTenant?.id || "")
        .eq("setting_key", "stakeholder_network_tag_synonyms")
        .maybeSingle();

      if (error) throw error;
      return safeJsonParse<Record<string, string>>(data?.setting_value || null, {});
    },
  });

  const tagSynonyms = useMemo(
    () => ({ ...DEFAULT_TAG_SYNONYMS, ...(appTagSynonyms || {}) }),
    [appTagSynonyms],
  );

  const normalizeTag = (tag: string) => {
    const normalized = tag
      .toLowerCase()
      .trim()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    return tagSynonyms[normalized] || normalized;
  };

  const presets = useMemo(() => {
    const stored = safeJsonParse<NetworkPreset[]>(localStorage.getItem(userPresetKey), []);
    return [...DEFAULT_PRESETS, ...stored.filter((p) => !DEFAULT_PRESETS.some((d) => d.id === p.id))];
  }, [userPresetKey]);

  const saveCurrentPreset = () => {
    const name = window.prompt("Name für das Preset:", `Preset ${new Date().toLocaleDateString("de-DE")}`);
    if (!name) return;

    const stored = safeJsonParse<NetworkPreset[]>(localStorage.getItem(userPresetKey), []);
    const newPreset: NetworkPreset = {
      id: `custom-${Date.now()}`,
      name,
      layoutMode,
    };
    localStorage.setItem(userPresetKey, JSON.stringify([...stored, newPreset]));
    setActivePresetId(newPreset.id);
  };

  const applyPreset = (presetId: string) => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;

    setLayoutMode(preset.layoutMode);
    setActivePresetId(preset.id);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["stakeholder-network-widget", currentTenant?.id],
    enabled: !!currentTenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, tags")
        .eq("tenant_id", currentTenant?.id || "")
        .eq("contact_type", "organization")
        .order("updated_at", { ascending: false })
        .limit(40);

      if (error) throw error;
      return (data || []) as StakeholderContact[];
    },
  });

  const network = useMemo(() => {
    const contacts: NormalizedContact[] = (data || [])
      .filter((contact) => contact.name)
      .slice(0, MAX_NODES)
      .map((contact) => ({
        id: contact.id,
        name: contact.name,
        normalizedTags: Array.from(new Set((contact.tags || []).map(normalizeTag).filter(Boolean))),
      }));

    const edgeMap = new Map<string, NetworkEdge>();
    const degreeCount = new Map<string, number>();

    for (let i = 0; i < contacts.length; i++) {
      for (let j = i + 1; j < contacts.length; j++) {
        const a = contacts[i];
        const b = contacts[j];
        const sharedTags = a.normalizedTags.filter((tag) => b.normalizedTags.includes(tag));

        if (sharedTags.length === 0) continue;

        const key = [a.id, b.id].sort().join("|");
        edgeMap.set(key, { source: a.id, target: b.id, weight: sharedTags.length, sharedTags });

        degreeCount.set(a.id, (degreeCount.get(a.id) || 0) + sharedTags.length);
        degreeCount.set(b.id, (degreeCount.get(b.id) || 0) + sharedTags.length);
      }
    }

    const maxDegree = Math.max(...Array.from(degreeCount.values()), 1);
    const tagGroups = new Map<string, NormalizedContact[]>();

    contacts.forEach((contact) => {
      const dominantTag = contact.normalizedTags[0] || "ohne-tag";
      const bucket = tagGroups.get(dominantTag) || [];
      bucket.push(contact);
      tagGroups.set(dominantTag, bucket);
    });

    const groups = Array.from(tagGroups.entries());
    const nodes: NetworkNode[] =
      layoutMode === "cluster"
        ? groups.flatMap(([tag, groupContacts], groupIndex) => {
            const clusterAngle = (2 * Math.PI * groupIndex) / Math.max(groups.length, 1);
            const cx = CENTER + Math.cos(clusterAngle) * (BASE_RADIUS - 15);
            const cy = CENTER + Math.sin(clusterAngle) * (BASE_RADIUS - 15);

            return groupContacts.map((contact, index) => {
              const localAngle = (2 * Math.PI * index) / Math.max(groupContacts.length, 1);
              const localRadius = 28 + (index % 3) * 10;
              const degree = degreeCount.get(contact.id) || 0;
              return {
                id: contact.id,
                label: contact.name,
                dominantTag: tag,
                x: cx + Math.cos(localAngle) * localRadius,
                y: cy + Math.sin(localAngle) * localRadius,
                degree,
              };
            });
          })
        : contacts.map((contact, index) => {
            const angle = (2 * Math.PI * index) / Math.max(contacts.length, 1);
            const degree = degreeCount.get(contact.id) || 0;
            const ring = degree > maxDegree * 0.5 ? BASE_RADIUS - 40 : BASE_RADIUS;
            return {
              id: contact.id,
              label: contact.name,
              dominantTag: contact.normalizedTags[0] || "ohne-tag",
              x: CENTER + Math.cos(angle) * ring,
              y: CENTER + Math.sin(angle) * ring,
              degree,
            };
          });

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const uniqueTags = Array.from(new Set(nodes.map((node) => node.dominantTag))).sort();
    const tagColorMap = new Map(uniqueTags.map((tag, index) => [tag, TAG_COLORS[index % TAG_COLORS.length]]));

    return {
      nodes,
      nodeById,
      edges: Array.from(edgeMap.values()),
      uniqueTags,
      tagColorMap,
      density: contacts.length > 1 ? (2 * edgeMap.size) / (contacts.length * (contacts.length - 1)) : 0,
    };
  }, [data, layoutMode]);

  if (tenantLoading || isLoading) return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Stakeholder-Netzwerk wird geladen…</div>;
  if (!currentTenant) return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Kein Mandant zugewiesen.</div>;
  if (error) return <div className="h-full flex items-center justify-center text-sm text-destructive">Stakeholder-Netzwerk konnte nicht geladen werden.</div>;
  if (network.nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Users className="h-6 w-6" />
        <p className="text-sm">Keine Stakeholder gefunden.</p>
      </div>
    );
  }

  const activeEdges = activeNodeId ? network.edges.filter((edge) => edge.source === activeNodeId || edge.target === activeNodeId) : network.edges;
  const activeNode = activeNodeId ? network.nodeById.get(activeNodeId) : null;

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
      <div className="flex flex-col gap-2 min-h-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1 gap-2 flex-wrap">
          <span>{network.nodes.length} Stakeholder</span>
          <span>{network.edges.length} Verbindungen</span>
          <span>Dichte: {(network.density * 100).toFixed(0)}%</span>
          <div className="flex items-center gap-1 flex-wrap">
            <Button variant={layoutMode === "radial" ? "default" : "outline"} size="sm" className="h-7 px-2" onClick={() => setLayoutMode("radial")}>
              <Orbit className="h-3.5 w-3.5 mr-1" />Kreis
            </Button>
            <Button variant={layoutMode === "cluster" ? "default" : "outline"} size="sm" className="h-7 px-2" onClick={() => setLayoutMode("cluster")}>
              <Network className="h-3.5 w-3.5 mr-1" />Cluster
            </Button>
            <select
              className="h-7 rounded-md border bg-background px-2 text-xs"
              value={activePresetId}
              onChange={(e) => applyPreset(e.target.value)}
            >
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.name}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={saveCurrentPreset}>
              <Save className="h-3.5 w-3.5 mr-1" />Preset
            </Button>
          </div>
        </div>

        <div className="relative grow min-h-0 rounded-md border bg-card overflow-hidden">
          <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} className="h-full w-full">
            {activeEdges.map((edge) => {
              const source = network.nodeById.get(edge.source);
              const target = network.nodeById.get(edge.target);
              if (!source || !target) return null;
              return <line key={`${edge.source}-${edge.target}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="hsl(var(--primary) / 0.4)" strokeWidth={Math.min(1 + edge.weight, 4)} />;
            })}
            {network.nodes.map((node) => {
              const isActive = activeNodeId === node.id;
              const hasActiveConnection = !!activeNodeId && network.edges.some((edge) => (edge.source === node.id && edge.target === activeNodeId) || (edge.target === node.id && edge.source === activeNodeId));
              return (
                <g key={node.id} onMouseEnter={() => setActiveNodeId(node.id)} onMouseLeave={() => setActiveNodeId(null)} onClick={() => navigate(`/contacts/${node.id}`)} className="cursor-pointer">
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={Math.min(10 + node.degree * 1.5, 22)}
                    className={cn("transition-opacity", activeNodeId && !isActive && !hasActiveConnection ? "opacity-30" : "opacity-100")}
                    fill={isActive ? "hsl(var(--primary))" : network.tagColorMap.get(node.dominantTag) || "hsl(var(--secondary))"}
                    stroke="hsl(var(--border))"
                  />
                  <text x={node.x} y={node.y + 4} textAnchor="middle" className="fill-foreground text-[10px] pointer-events-none">{node.label.slice(0, 12)}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-1">
          {network.uniqueTags.slice(0, 8).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: network.tagColorMap.get(tag) }} />
              {prettifyTag(tag)}
            </span>
          ))}
        </div>

        <p className="text-xs text-muted-foreground px-1 truncate">
          {activeNodeId ? `${activeNode?.label}: ${activeEdges.length} Verbindungen` : "Verbindungen entstehen über normalisierte gemeinsame Tags. Klick auf einen Knoten öffnet die Kontaktansicht."}
        </p>
      </div>

      <aside className="rounded-md border bg-muted/20 p-3 text-xs space-y-2 overflow-auto">
        <div className="font-medium text-sm">Netzwerk-Details</div>
        {activeNode ? (
          <>
            <div className="font-semibold leading-tight">{activeNode.label}</div>
            <div className="text-muted-foreground">Cluster: {prettifyTag(activeNode.dominantTag)}</div>
            <div className="text-muted-foreground flex items-center gap-1"><Link2 className="h-3.5 w-3.5" />{activeEdges.length} direkte Verbindungen</div>
            <div className="space-y-1">
              {activeEdges.slice(0, 6).map((edge) => {
                const partnerId = edge.source === activeNode.id ? edge.target : edge.source;
                const partner = network.nodeById.get(partnerId);
                return (
                  <div key={`${edge.source}-${edge.target}`} className="rounded border bg-background px-2 py-1">
                    <div className="font-medium truncate">{partner?.label || "Unbekannt"}</div>
                    <div className="text-muted-foreground truncate">Gemeinsame Tags: {edge.sharedTags.slice(0, 3).map(prettifyTag).join(", ") || "-"}</div>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" size="sm" className="w-full justify-between" onClick={() => navigate(`/contacts/${activeNode.id}`)}>
              Kontakt öffnen<ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">Knoten hovern oder klicken, um Details und normalisierte Verbindungen zu sehen.</p>
        )}
      </aside>
    </div>
  );
}
