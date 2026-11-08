import { useId, type CSSProperties } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import "./sunflower-theme-toggle.css";

const stars = [[14, 18, 2], [35, 12, 1.5], [60, 20, 2], [79, 10, 1.5], [128, 37, 2], [110, 61, 1.5], [23, 59, 1.5]];

/** Uses the existing provider for system preference, persistence and app-wide theme. */
export function SunflowerThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const id = useId();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dunkelmodus"
      title={isDark ? "Zum hellen Design wechseln" : "Zum dunklen Design wechseln"}
      className={cn("sunflower-toggle", className)}
      data-theme={isDark ? "dark" : "light"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <svg viewBox="0 0 144 88" fill="none" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={`${id}-clip`}><rect width="144" height="88" rx="30" /></clipPath>
          <radialGradient id={`${id}-core`}>
            <stop stopColor="#9b6430" /><stop offset="1" stopColor="#50301d" />
          </radialGradient>
        </defs>
        <g clipPath={`url(#${id}-clip)`}>
          <rect className="sunflower-sky" width="144" height="88" />
          <g className="sunflower-day">
            <circle cx="112" cy="22" r="11" fill="#ffe795" />
            <path d="M7 30h28c8 0 8-10 0-10-1-9-14-10-17-2-10-3-17 10-11 12ZM92 47h31c7 0 8-9 0-10-3-10-17-9-19-1-9-3-17 8-12 11Z" fill="#f4fbff" opacity=".85" />
          </g>
          <g className="sunflower-night">
            <g fill="#ffe6a0">
              {stars.map(([x, y, r]) => <path key={`${x}-${y}`} d={`M${x} ${y-r*2}l${r*.65} ${r*1.35}L${x+r*2} ${y}l-${r*1.35} ${r*.65}L${x} ${y+r*2}l-${r*.65}-${r*1.35}L${x-r*2} ${y}l${r*1.35}-${r*.65}Z`} />)}
            </g>
            {/* The crescent and stars occupy disjoint regions in both themes. */}
            <path d="M118 10a13 13 0 1 0 10 21 13 13 0 0 1-10-21Z" fill="#ffe8ae" />
            <path d="M-8 49C18 27 30 66 57 47s35-14 48-3 24 5 45-3M-8 56C18 34 30 73 57 54s35-14 48-3 24 5 45-3" stroke="#8da6cb" strokeWidth="2" opacity=".2" />
          </g>
          <path className="sunflower-ground" d="M0 80Q35 63 75 78T144 74V88H0Z" />
          <g className="sunflower-plant">
            <path d="M70 90Q77 65 70 43" stroke="#3d743e" strokeWidth="5" strokeLinecap="round" />
            <path d="M73 75Q47 76 45 59Q65 56 73 75ZM74 68Q94 69 100 53Q81 51 74 68Z" fill="#4f914b" stroke="#396739" strokeWidth="1.5" />
            <g transform="translate(70 39)">
              {Array.from({ length: 14 }, (_, index) => (
                <g key={index} transform={`rotate(${index * 360 / 14})`}>
                  <ellipse className="sunflower-petal" cx="0" cy="-16" rx="7" ry="14" style={{ "--petal-delay": `${index * 12}ms`, "--petal-turn": `${index % 2 ? 3 : -3}deg` } as CSSProperties} />
                </g>
              ))}
              <circle r="12" fill={`url(#${id}-core)`} stroke="#b67e31" strokeWidth="1.5" />
              <path d="M-5-5h.1M2-7h.1M6-2h.1M-1 0h.1M-6 3h.1M2 5h.1M7 4h.1" stroke="#e3b15b" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          </g>
        </g>
      </svg>
    </button>
  );
}
