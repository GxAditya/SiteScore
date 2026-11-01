import { useId } from "react";

interface MascotMarkProps {
  size?: number;
  className?: string;
}

/**
 * SiteScore mascot: a friendly page scanner with a gauge-light antenna.
 * Drawn on a 64px grid so the face survives down to favicon size.
 */
export function MascotMark({ size = 32, className }: MascotMarkProps) {
  const uid = useId().replace(/:/g, "");
  const body = `mascot-body-${uid}`;
  const screen = `mascot-screen-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={body} x1="12" y1="16" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9ABC8F" />
          <stop offset="0.55" stopColor="#6E8B64" />
          <stop offset="1" stopColor="#4A6344" />
        </linearGradient>
        <linearGradient id={screen} x1="20" y1="26" x2="44" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22311F" />
          <stop offset="1" stopColor="#101A0F" />
        </linearGradient>
      </defs>

      {/* signal antenna */}
      <path d="M32 17.5v-5" stroke="#4A6344" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="32" cy="8.6" r="6" fill="#D9B56F" opacity="0.16" />
      <circle cx="32" cy="8.6" r="3.2" fill="#D9B56F" />

      {/* side sensors */}
      <rect x="3.5" y="29.5" width="5" height="11.5" rx="2.5" fill="#4A6344" />
      <rect x="55.5" y="29.5" width="5" height="11.5" rx="2.5" fill="#4A6344" />

      {/* head */}
      <rect x="8.5" y="15" width="47" height="43" rx="13.5" fill={`url(#${body})`} />
      <path
        d="M14.5 23.5c2.6-3.7 6.6-5.5 11.4-5.5h12.2c4.8 0 8.8 1.8 11.4 5.5"
        stroke="#E8F3E1"
        strokeOpacity="0.5"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* face screen */}
      <rect x="15.5" y="24.5" width="33" height="24" rx="8.5" fill={`url(#${screen})`} />
      <path
        d="M19.5 29c1.8-1.8 4.2-2.6 7-2.6"
        stroke="#FFFFFF"
        strokeOpacity="0.16"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="24.5" cy="34.6" r="2.55" fill="#E8F7DE" />
      <circle cx="39.5" cy="34.6" r="2.55" fill="#E8F7DE" />
      <path
        d="M27.4 41.3c1.7 1.7 7.5 1.7 9.2 0"
        stroke="#CFE9C4"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="20.6" cy="40.2" r="1.15" fill="#D9B56F" opacity="0.55" />
      <circle cx="43.4" cy="40.2" r="1.15" fill="#D9B56F" opacity="0.55" />

      {/* panel fasteners */}
      <circle cx="16.5" cy="52.5" r="1.15" fill="#374B32" opacity="0.7" />
      <circle cx="47.5" cy="52.5" r="1.15" fill="#374B32" opacity="0.7" />
    </svg>
  );
}
