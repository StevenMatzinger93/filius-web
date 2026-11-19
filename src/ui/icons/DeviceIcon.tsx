import type { ReactElement } from 'react';
import type { DeviceType } from '../../engine/model/project.ts';

/**
 * Eigene, schlichte Gerätesymbole (Neuzeichnung, keine Grafiken aus Filius).
 * Rollenfarben: Endgeräte grau, Switches blau, Router grün, Sicherheit rot, Rechenzentrum violett/türkis.
 */
/** Umrisse folgen der Textfarbe, damit sie im Dunkelmodus sichtbar bleiben. */
const STROKE = 'currentColor';

function Frame({ children, size }: { children: ReactElement | ReactElement[]; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className="text-ink dark:text-gray-300"
    >
      {children}
    </svg>
  );
}

const arrowsH = (y: number, color: string) => (
  <g stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={`M14 ${y - 3}h18m-4-3 4 3-4 3`} />
    <path d={`M34 ${y + 3}H16m4-3-4 3 4 3`} />
  </g>
);

const icons: Record<DeviceType, ReactElement[]> = {
  pc: [
    <rect
      key="s"
      x="6"
      y="8"
      width="36"
      height="24"
      rx="2.5"
      fill="#e5e7eb"
      stroke={STROKE}
      strokeWidth="2"
    />,
    <rect key="d" x="10" y="12" width="28" height="16" rx="1" fill="#93c5fd" />,
    <path
      key="f"
      d="M18 32v5h12v-5M13 40h22"
      stroke={STROKE}
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />,
  ],
  notebook: [
    <rect
      key="s"
      x="10"
      y="10"
      width="28"
      height="20"
      rx="2"
      fill="#e5e7eb"
      stroke={STROKE}
      strokeWidth="2"
    />,
    <rect key="d" x="13" y="13" width="22" height="14" rx="1" fill="#93c5fd" />,
    <path
      key="b"
      d="M5 34h38l-3 5H8z"
      fill="#d1d5db"
      stroke={STROKE}
      strokeWidth="2"
      strokeLinejoin="round"
    />,
  ],
  switch: [
    <rect
      key="b"
      x="4"
      y="14"
      width="40"
      height="20"
      rx="3"
      fill="#3b82f6"
      stroke={STROKE}
      strokeWidth="2"
    />,
    <g key="a">{arrowsH(24, '#ffffff')}</g>,
  ],
  router: [
    <ellipse key="b" cx="24" cy="24" rx="19" ry="15" fill="#16a34a" stroke={STROKE} strokeWidth="2" />,
    <g key="a" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 12v9m-3-3 3 3 3-3M24 36v-9m-3 3 3-3 3 3M10 24h9m-3-3 3 3-3 3M38 24h-9m3-3-3 3 3 3" />
    </g>,
  ],
  gateway: [
    <path
      key="h"
      d="M6 22 24 8l18 14v18H6z"
      fill="#f59e0b"
      stroke={STROKE}
      strokeWidth="2"
      strokeLinejoin="round"
    />,
    <circle key="g" cx="24" cy="29" r="7" fill="#fff" stroke={STROKE} strokeWidth="1.5" />,
    <path
      key="m"
      d="M17 29h14M24 22c-3 4-3 10 0 14m0-14c3 4 3 10 0 14"
      stroke={STROKE}
      strokeWidth="1.2"
      fill="none"
    />,
  ],
  server: [
    <rect key="b" x="6" y="9" width="36" height="30" rx="2" fill="#4b5563" stroke={STROKE} strokeWidth="2" />,
    <g key="u" fill="#9ca3af">
      <rect x="10" y="13" width="28" height="6" rx="1" />
      <rect x="10" y="21" width="28" height="6" rx="1" />
      <rect x="10" y="29" width="28" height="6" rx="1" />
    </g>,
    <g key="l" fill="#22c55e">
      <circle cx="34" cy="16" r="1.5" />
      <circle cx="34" cy="24" r="1.5" />
      <circle cx="34" cy="32" r="1.5" />
    </g>,
  ],
  l3switch: [
    <rect
      key="b"
      x="4"
      y="12"
      width="40"
      height="24"
      rx="3"
      fill="#7c3aed"
      stroke={STROKE}
      strokeWidth="2"
    />,
    <g key="a">{arrowsH(20, '#ffffff')}</g>,
    <text key="t" x="24" y="34" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">
      L3
    </text>,
  ],
  tor: [
    <rect
      key="b"
      x="4"
      y="15"
      width="40"
      height="18"
      rx="2"
      fill="#0891b2"
      stroke={STROKE}
      strokeWidth="2"
    />,
    <g key="p" fill="#cffafe">
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={8 + i * 4.2} y="19" width="3" height="4" />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={`b${i}`} x={8 + i * 4.2} y="25" width="3" height="4" />
      ))}
    </g>,
  ],
  spine: [
    <rect
      key="b"
      x="4"
      y="15"
      width="40"
      height="18"
      rx="2"
      fill="#4338ca"
      stroke={STROKE}
      strokeWidth="2"
    />,
    <path key="s" d="M12 30 24 18l12 12M18 30l6-6 6 6" stroke="#e0e7ff" strokeWidth="2" fill="none" />,
  ],
  firewall: [
    <rect key="b" x="5" y="9" width="38" height="30" rx="2" fill="#dc2626" stroke={STROKE} strokeWidth="2" />,
    <path
      key="w"
      d="M5 19h38M5 29h38M17 9v10M31 9v10M11 19v10M24 19v10M37 19v10M17 29v10M31 29v10"
      stroke="#fecaca"
      strokeWidth="1.6"
    />,
  ],
  loadbalancer: [
    <rect
      key="b"
      x="4"
      y="12"
      width="40"
      height="24"
      rx="12"
      fill="#0d9488"
      stroke={STROKE}
      strokeWidth="2"
    />,
    <path
      key="a"
      d="M10 24h10m0 0 8-6h8m-16 6h16m-16 0 8 6h8m-3-15 3 3-3 3m0 3 3 3-3 3m0 3 3 3-3 3"
      stroke="#fff"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
  ],
  nas: [
    <rect key="b" x="9" y="6" width="30" height="36" rx="3" fill="#6b7280" stroke={STROKE} strokeWidth="2" />,
    <g key="d" fill="#e5e7eb" stroke={STROKE} strokeWidth="1">
      <rect x="13" y="10" width="22" height="6" rx="1" />
      <rect x="13" y="18" width="22" height="6" rx="1" />
      <rect x="13" y="26" width="22" height="6" rx="1" />
    </g>,
    <circle key="l" cx="24" cy="37" r="1.8" fill="#22c55e" />,
  ],
  vmhost: [
    <rect key="b" x="5" y="8" width="38" height="32" rx="3" fill="#475569" stroke={STROKE} strokeWidth="2" />,
    <g key="v" fill="#a5b4fc" stroke="#1e1b4b" strokeWidth="1">
      <rect x="9" y="12" width="13" height="10" rx="1.5" />
      <rect x="26" y="12" width="13" height="10" rx="1.5" />
      <rect x="9" y="26" width="13" height="10" rx="1.5" />
      <rect x="26" y="26" width="13" height="10" rx="1.5" />
    </g>,
  ],
};

export function DeviceIcon({ type, size = 48 }: { type: DeviceType; size?: number }) {
  return <Frame size={size}>{icons[type]}</Frame>;
}
