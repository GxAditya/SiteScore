/**
 * Dot matrix math, following the technique used by dotmatrix.zzzzshawn.cloud:
 * a grid of round dots where each dot carries its own geometry as CSS custom
 * properties and a resolver maps (time, geometry) to opacity every frame.
 * Opacity-only animation keeps it cheap and safe for reduced-motion users.
 */

export type DotMatrixVariant = "radar" | "sweep" | "ripple";

export interface DotGeometry {
  row: number;
  col: number;
  /** Euclidean distance from the grid centre, normalised to 0..1. */
  path: number;
  /** Radians from the grid centre, -PI..PI. */
  angle: number;
}

export interface DotMatrixLayout {
  cells: DotGeometry[];
  size: number;
}

const TAU = Math.PI * 2;

export function buildLayout(size: number, rows = size): DotMatrixLayout {
  const centreCol = (size - 1) / 2;
  const centreRow = (rows - 1) / 2;
  const maxDistance = Math.hypot(centreCol, centreRow) || 1;
  const cells: DotGeometry[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const dx = col - centreCol;
      const dy = row - centreRow;
      cells.push({
        row,
        col,
        path: Math.hypot(dx, dy) / maxDistance,
        angle: Math.atan2(dy, dx),
      });
    }
  }

  return { cells, size };
}

/** Brightness 0..1 for one dot at time `t` (seconds). */
export function resolveDot(
  variant: DotMatrixVariant,
  dot: DotGeometry,
  t: number,
): number {
  if (variant === "radar") {
    // Comet tail trailing a rotating sweep arm.
    const head = t % TAU;
    const behind = (head - dot.angle + TAU) % TAU;
    return Math.exp(-behind * 2.4) * (0.55 + 0.45 * dot.path);
  }

  if (variant === "sweep") {
    // Head travels across the columns, one full pass per cycle.
    const head = (Math.sin(t * 0.5) * 0.5 + 0.5) * 8;
    const distance = Math.abs(dot.col - head + dot.row * 0.35);
    return Math.exp(-distance * 0.85);
  }

  // ripple: rings blooming outward from the centre.
  const phase = t * 1.6 - dot.path * 2.6;
  return Math.pow(Math.max(0, Math.sin(phase)), 3);
}

/** Map a resolved value into the dim..lit range the grid renders with. */
export function dotOpacity(value: number, min = 0.07, max = 1): number {
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round((min + (max - min) * clamped) * 100) / 100;
}
