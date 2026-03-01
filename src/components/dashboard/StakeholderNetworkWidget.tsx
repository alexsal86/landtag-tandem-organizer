import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface StakeholderContact {
  id: string;
  name: string;
  organization: string | null;
  tags: string[] | null;
}

interface NetworkNode {
  id: string;
  label: string;
  group: string;
  x: number;
  y: number;
  degree: number;
}

interface NetworkEdge {
  source: string;
  target: string;
  weight: number;
  sharedTags: string[];
}

const MAX_NODES = 14;
const SVG_SIZE = 500;
const CENTER = SVG_SIZE / 2;
const BASE_RADIUS = 150;

const getGroup = (contact: StakeholderContact) => {
  const primaryTag = contact.tags?.[0];
  if (primaryTag) return primaryTag;
  return contact.organization || "Sonstige";
};

export function StakeholderNetworkWidget() {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["stakeholder-network-widget"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, organization, tags")
        .eq("contact_type", "organization")
        .order("updated_at", { ascending: false })
        .limit(40);

      if (error) throw error;
      return (data || []) as StakeholderContact[];
    },
  });

  const network = useMemo(() => {
    const contacts = (data || []).filter((contact) => contact.name).slice(0, MAX_NODES);

    const edgeMap = new Map<string, NetworkEdge>();
    const degreeCount = new Map<string, number>();

    for (let i = 0; i < contacts.length; i++) {
      for (let j = i + 1; j < contacts.length; j++) {
        const a = contacts[i];
        const b = contacts[j];
        const sharedTags = (a.tags || []).filter((tag) => (b.tags || []).includes(tag));

        if (sharedTags.length === 0) continue;

        const key = [a.id, b.id].sort().join("|");
        edgeMap.set(key, {
          source: a.id,
          target: b.id,
          weight: sharedTags.length,
          sharedTags,
        });

        degreeCount.set(a.id, (degreeCount.get(a.id) || 0) + sharedTags.length);
        degreeCount.set(b.id, (degreeCount.get(b.id) || 0) + sharedTags.length);
      }
    }

    const maxDegree = Math.max(...Array.from(degreeCount.values()), 1);

    const nodes: NetworkNode[] = contacts.map((contact, index) => {
      const angle = (2 * Math.PI * index) / Math.max(contacts.length, 1);
      const degree = degreeCount.get(contact.id) || 0;
      const ring = degree > maxDegree * 0.5 ? BASE_RADIUS - 40 : BASE_RADIUS;

      return {
        id: contact.id,
        label: contact.name,
        group: getGroup(contact),
        x: CENTER + Math.cos(angle) * ring,
        y: CENTER + Math.sin(angle) * ring,
        degree,
      };
    });

    return {
      nodes,
      edges: Array.from(edgeMap.values()),
      density: contacts.length > 1 ? (2 * edgeMap.size) / (contacts.length * (contacts.length - 1)) : 0,
    };
  }, [data]);

  if (isLoading) {
    return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Stakeholder-Netzwerk wird geladen…</div>;
  }

  if (error) {
    return <div className="h-full flex items-center justify-center text-sm text-destructive">Stakeholder-Netzwerk konnte nicht geladen werden.</div>;
  }

  if (network.nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Users className="h-6 w-6" />
        <p className="text-sm">Keine Stakeholder gefunden.</p>
      </div>
    );
  }

  const activeEdges = activeNodeId
    ? network.edges.filter((edge) => edge.source === activeNodeId || edge.target === activeNodeId)
    : network.edges;

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{network.nodes.length} Stakeholder</span>
        <span>{network.edges.length} Verbindungen</span>
        <span>Dichte: {(network.density * 100).toFixed(0)}%</span>
      </div>

      <div className="relative grow min-h-0 rounded-md border bg-card overflow-hidden">
        <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} className="h-full w-full">
          {activeEdges.map((edge) => {
            const source = network.nodes.find((node) => node.id === edge.source);
            const target = network.nodes.find((node) => node.id === edge.target);
            if (!source || !target) return null;

            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="hsl(var(--primary) / 0.4)"
                strokeWidth={Math.min(1 + edge.weight, 4)}
              />
            );
          })}

          {network.nodes.map((node) => {
            const isActive = activeNodeId === node.id;
            const hasActiveConnection =
              activeNodeId && network.edges.some((edge) => (edge.source === node.id && edge.target === activeNodeId) || (edge.target === node.id && edge.source === activeNodeId));

            return (
              <g
                key={node.id}
                onMouseEnter={() => setActiveNodeId(node.id)}
                onMouseLeave={() => setActiveNodeId(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={Math.min(10 + node.degree * 1.5, 22)}
                  className={cn("transition-opacity", activeNodeId && !isActive && !hasActiveConnection ? "opacity-30" : "opacity-100")}
                  fill={isActive ? "hsl(var(--primary))" : "hsl(var(--secondary))"}
                  stroke="hsl(var(--border))"
                />
                <text
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  className="fill-foreground text-[10px] pointer-events-none"
                >
                  {node.label.slice(0, 12)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-xs text-muted-foreground px-1 truncate">
        {activeNodeId
          ? `${network.nodes.find((node) => node.id === activeNodeId)?.label}: ${activeEdges.length} Verbindungen`
          : "Verbindungen entstehen über gemeinsame Tags."}
      </p>
    </div>
  );
}
