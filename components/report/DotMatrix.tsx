"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import { buildLayout, dotOpacity, resolveDot, type DotMatrixVariant } from "@/lib/dotmatrix";

interface DotMatrixProps {
  /** Dots per column. */
  size?: number;
  /** Dots per row. Defaults to a square grid. */
  rows?: number;
  /** Dot edge length in px. */
  dot?: number;
  gap?: number;
  variant?: DotMatrixVariant;
  /** Radians of progress per second. */
  speed?: number;
  /** Floor brightness for unlit dots. */
  min?: number;
  className?: string;
  /** When set the grid is exposed to assistive tech; otherwise decorative. */
  label?: string;
}

/**
 * A dot matrix loader in the style of dotmatrix.zzzzshawn.cloud: a grid of
 * round dots, each carrying its own geometry, with brightness resolved per
 * frame. Only opacity changes, so it stays cheap and reduced-motion friendly.
 */
export function DotMatrix({
  size = 5,
  rows,
  dot = 5,
  gap = 2,
  variant = "radar",
  speed = 2.4,
  min = 0.07,
  className,
  label,
}: DotMatrixProps) {
  const reduce = useReducedMotion();
  const cells = useMemo(
    () => buildLayout(size, rows ?? size).cells,
    [size, rows],
  );
  const refs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const nodes = refs.current;

    const paint = (t: number) => {
      for (let i = 0; i < cells.length; i += 1) {
        const el = nodes[i];
        if (el) {
          el.style.opacity = String(dotOpacity(resolveDot(variant, cells[i], t), min));
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
      paint(((now - start) / 1000) * speed);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cells, variant, speed, min, reduce]);

  return (
    <div
      className={`dmx-grid ${className ?? ""}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ gap: `${gap}px`, gridTemplateColumns: `repeat(${size}, ${dot}px)` }}
    >
      {cells.map((cell, i) => (
        <span
          key={`${cell.row}-${cell.col}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="dmx-dot"
          style={
            {
              width: `${dot}px`,
              height: `${dot}px`,
              "--dmx-row": cell.row,
              "--dmx-col": cell.col,
              "--dmx-path": cell.path,
              "--dmx-angle": cell.angle,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
