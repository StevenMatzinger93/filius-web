import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import type { DeviceType } from '../../engine/model/project.ts';
import { DeviceIcon } from '../icons/DeviceIcon.tsx';

export interface DeviceNodeData extends Record<string, unknown> {
  deviceType: DeviceType;
  name: string;
  /** Kurzinfo unter dem Namen (z. B. IP/Präfix). */
  detail: string;
  /** Tooltip mit allen Adressen (wie im Original beim Überfahren). */
  tooltip: string;
  typeLabel: string;
  cableSource: boolean;
}

export type DeviceNodeType = Node<DeviceNodeData, 'device'>;

export const DEVICE_NODE_WIDTH = 128;
export const DEVICE_NODE_HEIGHT = 92;

function DeviceNodeComponent({ data }: NodeProps<DeviceNodeType>) {
  return (
    <div
      className="device-node-frame flex flex-col items-center rounded-lg px-1 pt-1 pb-0.5"
      style={{ width: DEVICE_NODE_WIDTH, minHeight: DEVICE_NODE_HEIGHT }}
      title={data.tooltip}
      aria-label={`${data.typeLabel} ${data.name}`}
    >
      <Handle
        type="source"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white !bg-accent"
        aria-label={`Kabel von ${data.name} ziehen`}
      />
      <div className={data.cableSource ? 'rounded-md ring-2 ring-cable-active' : undefined}>
        <DeviceIcon type={data.deviceType} size={52} />
      </div>
      <div className="max-w-full truncate text-center text-xs leading-tight font-semibold text-ink dark:text-gray-100">
        {data.name}
      </div>
      {data.detail && (
        <div className="max-w-full truncate text-center font-mono text-xxs leading-tight text-ink-soft dark:text-gray-400">
          {data.detail}
        </div>
      )}
    </div>
  );
}

export const DeviceNode = memo(DeviceNodeComponent);
