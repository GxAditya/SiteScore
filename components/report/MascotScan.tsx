"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { useReducedMotion } from "motion/react";
import {
  buildLayout,
  dotOpacity,
  resolveDot,
  type DotMatrixVariant,
} from "@/lib/dotmatrix";

const COLS = 7;
const ROWS = 4;
/** The visor screen inside the mascot head, in the 64px mascot grid. */
const SCREEN = { x: 15.5, y: 24.5, w: 33, h: 24 };

interface MascotScanProps {
  size?: number;
  variant?: DotMatrixVariant;
  className?: string;
  label?: string;
}

/**
 * The SiteScore mascot mid-scan: same head as the logo, but its face screen
 * shows a live dot matrix instead of eyes.
 */
export function MascotScan({
  size = 120,
  variant = "sweep",
  className,
  label,
}: MascotScanProps) {
  const uid = useId().replace(/:/g, "");
  const body = `scan-body-${uid}`;
  const screen = `scan-screen-${uid}`;
  const cells = useMemo(() => buildLayout(COLS, ROWS).cells, []);
  const refs = useRef<Array<SVGCircleElement | null>>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    const nodes = refs.current;

    const paint = (t: number) => {
      for (let i = 0; i < cells.length; i += 1) {
        const el = nodes[i];
        if (el) {
          el.style.opacity = String(dotOpacity(resolveDot(variant, cells[i], t), 0.1));
        }
      }
    };

    if (reduce) {
      paint(1.1);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      paint(((now - start) / 1000) * 1.9);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cells, variant, reduce]);

  const stepX = SCREEN.w / COLS;
  const stepY = SCREEN.h / ROWS;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={body} x1="12" y1="16" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9ABC8F" />
          <stop offset="0.55" stopColor="#6E8B64" />
          <stop offset="1" stopColor="#4A6344" />
        </linearGradient>
        <linearGradient id={screen} x1="20" y1="26" x2="44" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1B2718" />
          <stop offset="1" stopColor="#0B120A" />
        </linearGradient>
      </defs>

      <path d="M32 17.5v-5" stroke="#4A6344" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="32" cy="8.6" r="6" fill="#D9B56F" opacity="0.16" />
      <circle className="mascot-orb" cx="32" cy="8.6" r="3.2" fill="#D9B56F" />

      <rect x="3.5" y="29.5" width="5" height="11.5" rx="2.5" fill="#4A6344" />
      <rect x="55.5" y="29.5" width="5" height="11.5" rx="2.5" fill="#4A6344" />

      <rect x="8.5" y="15" width="47" height="43" rx="13.5" fill={`url(#${body})`} />
      <path
        d="M14.5 23.5c2.6-3.7 6.6-5.5 11.4-5.5h12.2c4.8 0 8.8 1.8 11.4 5.5"
        stroke="#E8F3E1"
        strokeOpacity="0.5"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} rx="8.5" fill={`url(#${screen})`} />
      <g>
        {cells.map((cell, i) => (
          <circle
            key={`${cell.row}-${cell.col}`}
            ref={(el) => {
              refs.current[i] = el;
            }}
            cx={SCREEN.x + stepX * (cell.col + 0.5)}
            cy={SCREEN.y + stepY * (cell.row + 0.5)}
            r="1.5"
            fill="#9ED99A"
            opacity="0.1"
          />
        ))}
      </g>
      <path
        d="M19.5 29c1.8-1.8 4.2-2.6 7-2.6"
        stroke="#FFFFFF"
        strokeOpacity="0.14"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      <circle cx="16.5" cy="52.5" r="1.15" fill="#374B32" opacity="0.7" />
      <circle cx="47.5" cy="52.5" r="1.15" fill="#374B32" opacity="0.7" />
    </svg>
  );
}
