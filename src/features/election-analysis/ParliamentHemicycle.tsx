import { useId } from "react";
import { getPartyColor } from "@/features/election-districts/partyColors";
import { number } from "./model";
import { compareParliamentParties } from "./seatDistributionModel";

/** Place exactly one dot per recorded seat, with padding on every SVG edge. */
function seatPositions(total: number) {
  const rowCount = Math.max(1, Math.min(8, Math.round(Math.sqrt(total) / 2)));
  const radii = Array.from({ length: rowCount }, (_, row) =>
    rowCount === 1 ? 240 : 110 + (row * 130) / (rowCount - 1),
  );
  const radiusSum = radii.reduce((sum, radius) => sum + radius, 0);
  const allocations = radii.map((radius, row) => {
    const ideal = (total * radius) / radiusSum;
    return { row, count: Math.floor(ideal), remainder: ideal % 1 };
  });
  const remaining =
    total - allocations.reduce((sum, row) => sum + row.count, 0);
  [...allocations]
    .sort((a, b) => b.remainder - a.remainder || a.row - b.row)
    .slice(0, remaining)
    .forEach((row) => {
      row.count += 1;
    });

  return allocations
    .flatMap(({ row, count }) =>
      Array.from({ length: count }, (_, seat) => {
        const angle =
          count === 1 ? Math.PI / 2 : Math.PI * (1 - seat / (count - 1));
        return {
          angle,
          radius: radii[row],
          x: 260 + radii[row] * Math.cos(angle),
          y: 260 - radii[row] * Math.sin(angle),
        };
      }),
    )
    .sort((a, b) => b.angle - a.angle || b.radius - a.radius);
}

export function ParliamentHemicycle({
  groups,
  highlightParty,
}: {
  groups: { id: string; name: string; count: number }[];
  highlightParty?: string;
}) {
  const descriptionId = useId();
  const represented = [...groups].sort((a, b) =>
    compareParliamentParties(a.id, b.id),
  );
  const seatParties = represented.flatMap((group) =>
    Array<typeof group>(group.count).fill(group),
  );
  const total = seatParties.length;
  if (!total) return null;

  return (
    <>
      <svg
        viewBox="0 0 520 280"
        className="mx-auto block h-auto w-full max-w-2xl"
        role="img"
        aria-label="Sitzverteilung im Halbkreis"
        aria-describedby={descriptionId}
      >
        <desc id={descriptionId}>
          {represented
            .map((group) => `${group.name}: ${number(group.count)} Sitze`)
            .join(", ")}
          . Von links nach rechts angeordnet.
        </desc>
        {seatPositions(total).map((position, index) => {
          const group = seatParties[index];
          const highlighted = highlightParty === group.id;
          return (
            <circle
              key={index}
              cx={position.x}
              cy={position.y}
              r={7}
              fill={getPartyColor(group.id)}
              stroke={highlighted ? "#0f172a" : "white"}
              strokeWidth={highlighted ? 1.5 : 0.75}
            >
              <title>{group.name}</title>
            </circle>
          );
        })}
        <text
          x="260"
          y="222"
          textAnchor="middle"
          fill="currentColor"
          fontSize="40"
          fontWeight="700"
        >
          {number(total)}
        </text>
        <text x="260" y="246" textAnchor="middle" fill="#64748b" fontSize="14">
          Sitze dargestellt
        </text>
      </svg>
      <ul
        className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm"
        aria-label="Sitze nach Partei, von links nach rechts"
      >
        {represented.map((group) => (
          <li
            key={group.id}
            className={`flex items-center gap-2 ${highlightParty === group.id ? "font-bold" : ""}`}
          >
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: getPartyColor(group.id) }}
              aria-hidden="true"
            />
            <span>
              {group.name}{" "}
              <strong className="tabular-nums">{number(group.count)}</strong>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
