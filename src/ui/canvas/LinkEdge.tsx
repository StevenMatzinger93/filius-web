import {
  BaseEdge,
  useInternalNode,
  type Edge,
  type EdgeProps,
  type InternalNode,
  type Node,
} from '@xyflow/react';
import { memo } from 'react';
import { useSimStore } from '../../store/simStore.ts';

export interface LinkEdgeData extends Record<string, unknown> {
  aPort: string;
  bPort: string;
}

export type LinkEdgeType = Edge<LinkEdgeData, 'link'>;

interface Point {
  x: number;
  y: number;
}

function center(node: InternalNode<Node>): Point {
  const { x, y } = node.internals.positionAbsolute;
  return { x: x + (node.measured.width ?? 0) / 2, y: y + (node.measured.height ?? 0) / 2 };
}

/** Schnittpunkt der Linie Mitte→Ziel mit dem Rechteck des Knotens (Kabel enden am Geräterand). */
function borderPoint(node: InternalNode<Node>, toward: Point): Point {
  const c = center(node);
  const hw = (node.measured.width ?? 0) / 2;
  const hh = (node.measured.height ?? 0) / 2;
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const scale = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
  return { x: c.x + dx * Math.min(scale, 1), y: c.y + dy * Math.min(scale, 1) };
}

function LinkEdgeComponent({ id, source, target, data, selected }: EdgeProps<LinkEdgeType>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  // Wie im Original: Das Kabel leuchtet grün (0,255,64), solange ein Frame darauf unterwegs ist.
  const active = useSimStore((s) => (s.activeLinks[id] ?? 0) > 0);
  if (!sourceNode || !targetNode) return null;
  const s = borderPoint(sourceNode, center(targetNode));
  const t = borderPoint(targetNode, center(sourceNode));
  const path = `M ${s.x},${s.y} L ${t.x},${t.y}`;
  // Portnamen etwas neben das Kabel setzen (senkrecht versetzt), damit die Linie frei bleibt.
  const along = (from: Point, to: Point, distance: number): Point => {
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const ux = (to.x - from.x) / len;
    const uy = (to.y - from.y) / len;
    const side = uy > 0 === ux > 0 ? 1 : -1;
    return { x: from.x + ux * distance - uy * 9 * side, y: from.y + uy * distance + ux * 9 * side + 3 };
  };
  const la = along(s, t, 24);
  const lb = along(t, s, 24);
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={14}
        style={{
          stroke: active
            ? 'var(--color-cable-active)'
            : selected
              ? 'var(--color-accent)'
              : 'var(--xy-edge-stroke)',
          strokeWidth: active ? 5 : selected ? 3 : 2,
        }}
      />
      {data && (
        <g className="pointer-events-none fill-ink-soft text-[9px] dark:fill-gray-400" aria-hidden="true">
          <text x={la.x} y={la.y} textAnchor="middle">
            {data.aPort}
          </text>
          <text x={lb.x} y={lb.y} textAnchor="middle">
            {data.bPort}
          </text>
        </g>
      )}
    </>
  );
}

export const LinkEdge = memo(LinkEdgeComponent);
