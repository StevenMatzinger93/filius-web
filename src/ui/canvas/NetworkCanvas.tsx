import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type EdgeChangeset,
  type NodeChangeset,
  type OnNodeDrag,
} from '@xyflow/react';
import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { DEVICE_TYPES, type DeviceType } from '../../engine/model/project.ts';
import { useT } from '../../i18n/index.ts';
import { useProjectStore } from '../../store/projectStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { deviceDetail, deviceTooltip } from '../format.ts';
import { DEVICE_NODE_HEIGHT, DEVICE_NODE_WIDTH, DeviceNode, type DeviceNodeType } from './DeviceNode.tsx';
import { LinkEdge, type LinkEdgeType } from './LinkEdge.tsx';

export const DEVICE_DRAG_MIME = 'application/x-filius-device';

const nodeTypes = { device: DeviceNode };
const edgeTypes = { link: LinkEdge };
const GRID = 20;

function isDeviceType(value: string): value is DeviceType {
  return (DEVICE_TYPES as readonly string[]).includes(value);
}

export function NetworkCanvas() {
  const t = useT();
  const project = useProjectStore((s) => s.project);
  const selection = useProjectStore((s) => s.selection);
  const setSelection = useProjectStore((s) => s.setSelection);
  const moveDevices = useProjectStore((s) => s.moveDevices);
  const addDevice = useProjectStore((s) => s.addDevice);
  const connectDevices = useProjectStore((s) => s.connectDevices);
  const theme = useUiStore((s) => s.theme);
  const cableTool = useUiStore((s) => s.cableTool);
  const cableFrom = useUiStore((s) => s.cableFrom);
  const setCableFrom = useUiStore((s) => s.setCableFrom);
  const { screenToFlowPosition } = useReactFlow();

  const derivedNodes = useMemo<DeviceNodeType[]>(() => {
    const selected = new Set(selection.deviceIds);
    return project.devices.map((device) => ({
      id: device.id,
      type: 'device',
      position: device.position,
      selected: selected.has(device.id),
      data: {
        deviceType: device.type,
        name: device.name,
        detail: deviceDetail(device, project),
        tooltip: deviceTooltip(device),
        typeLabel: t(`device.${device.type}`),
        cableSource: cableFrom === device.id,
      },
    }));
  }, [project, selection.deviceIds, cableFrom, t]);

  // Lokale Kopie für flüssiges Ziehen; React Flow trägt hier gemessene Grössen ein.
  // Ändert sich das Projekt, wird sie während des Renderns abgeglichen (kein Effekt nötig).
  const [nodes, setNodes] = useState<DeviceNodeType[]>(derivedNodes);
  const [syncedFrom, setSyncedFrom] = useState(derivedNodes);
  if (syncedFrom !== derivedNodes) {
    setSyncedFrom(derivedNodes);
    const measured = new Map(nodes.map((n) => [n.id, n.measured]));
    setNodes(derivedNodes.map((n) => ({ ...n, measured: measured.get(n.id) })));
  }

  const edges = useMemo<LinkEdgeType[]>(() => {
    const selected = new Set(selection.linkIds);
    const portName = new Map(
      project.devices.flatMap((d) => d.interfaces.map((i) => [i.id, i.name] as const)),
    );
    return project.links.map((link) => ({
      id: link.id,
      type: 'link',
      source: link.a.deviceId,
      target: link.b.deviceId,
      selected: selected.has(link.id),
      data: { aPort: portName.get(link.a.interfaceId) ?? '', bPort: portName.get(link.b.interfaceId) ?? '' },
    }));
  }, [project.links, project.devices, selection.linkIds]);

  const applySelectChanges = useCallback(
    (kind: 'deviceIds' | 'linkIds', changes: Iterable<{ type: string; id?: string; selected?: boolean }>) => {
      const current = useProjectStore.getState().selection;
      const next = new Set(current[kind]);
      let touched = false;
      for (const change of changes) {
        if (change.type !== 'select' || !change.id) continue;
        touched = true;
        if (change.selected) next.add(change.id);
        else next.delete(change.id);
      }
      if (touched) setSelection({ ...current, [kind]: [...next] });
    },
    [setSelection],
  );

  const onNodesChange = useCallback(
    (changes: NodeChangeset<DeviceNodeType>) => {
      setNodes((current) => changes.applyTo(current));
      applySelectChanges('deviceIds', changes);
    },
    [applySelectChanges],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChangeset<LinkEdgeType>) => applySelectChanges('linkIds', changes),
    [applySelectChanges],
  );

  const onNodeDragStop: OnNodeDrag<DeviceNodeType> = useCallback(
    (_event, _node, dragged) => moveDevices(dragged.map((n) => ({ id: n.id, position: n.position }))),
    [moveDevices],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      connectDevices({ a: { deviceId: connection.source }, b: { deviceId: connection.target } });
    },
    [connectDevices],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: DeviceNodeType) => {
      if (!cableTool) return;
      if (!cableFrom) {
        setCableFrom(node.id);
        return;
      }
      if (cableFrom !== node.id) connectDevices({ a: { deviceId: cableFrom }, b: { deviceId: node.id } });
      setCableFrom(null);
    },
    [cableTool, cableFrom, setCableFrom, connectDevices],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    if (event.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      const type = event.dataTransfer.getData(DEVICE_DRAG_MIME);
      if (!isDeviceType(type)) return;
      event.preventDefault();
      const p = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const snap = (v: number) => Math.round(v / GRID) * GRID;
      addDevice(type, { x: snap(p.x - DEVICE_NODE_WIDTH / 2), y: snap(p.y - DEVICE_NODE_HEIGHT / 2) });
    },
    [screenToFlowPosition, addDevice],
  );

  const fromName = cableFrom ? project.devices.find((d) => d.id === cableFrom)?.name : undefined;

  return (
    <div className="relative h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow<DeviceNodeType, LinkEdgeType>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        connectionMode={ConnectionMode.Loose}
        snapToGrid
        snapGrid={[GRID, GRID]}
        deleteKeyCode={null}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={['Control', 'Meta']}
        onlyRenderVisibleElements
        forceColorMode={theme}
        fitView
        fitViewOptions={{ maxZoom: 1.2, padding: 0.2 }}
        minZoom={0.1}
        maxZoom={3}
        aria-label={t('canvas.label')}
        className={cableTool ? 'cursor-crosshair' : undefined}
      >
        <Background variant={BackgroundVariant.Dots} gap={GRID} size={1.4} color="#c4c8cf" />
        <MiniMap pannable zoomable nodeStrokeWidth={3} ariaLabel="Übersichtskarte" />
        <Controls showInteractive={false} />
      </ReactFlow>
      {project.devices.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-10">
          <p className="max-w-md rounded-lg border border-dashed border-gray-300 bg-white/80 p-5 text-center text-sm text-ink-soft dark:border-gray-600 dark:bg-gray-900/80 dark:text-gray-300">
            {t('canvas.empty')}
          </p>
        </div>
      )}
      {cableTool && (
        <div
          role="status"
          className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-1.5 text-sm text-white shadow-lg"
        >
          {fromName ? t('canvas.cableFrom', { name: fromName }) : t('canvas.cableActive')}
        </div>
      )}
    </div>
  );
}
