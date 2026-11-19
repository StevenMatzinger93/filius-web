import { useReactFlow } from '@xyflow/react';
import type { DragEvent, KeyboardEvent } from 'react';
import { DEVICE_CATALOG, type PaletteGroup } from '../../engine/model/catalog.ts';
import { DEVICE_TYPES, type DeviceType } from '../../engine/model/project.ts';
import { useT } from '../../i18n/index.ts';
import { useProjectStore } from '../../store/projectStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { DEVICE_DRAG_MIME } from '../canvas/NetworkCanvas.tsx';
import { DEVICE_NODE_HEIGHT, DEVICE_NODE_WIDTH } from '../canvas/DeviceNode.tsx';
import { DeviceIcon } from '../icons/DeviceIcon.tsx';

const groups: PaletteGroup[] = ['classic', 'datacenter'];

export function DevicePalette() {
  const t = useT();
  const addDevice = useProjectStore((s) => s.addDevice);
  const { screenToFlowPosition } = useReactFlow();
  // Wie im Original: Im Simulationsmodus lässt sich das Netz nicht verändern.
  const locked = useUiStore((s) => s.mode === 'simulation');

  const onDragStart = (event: DragEvent, type: DeviceType) => {
    event.dataTransfer.setData(DEVICE_DRAG_MIME, type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  // Tastaturbedienung: Enter/Leertaste legt das Gerät in der Mitte der sichtbaren Fläche ab.
  const onKeyDown = (event: KeyboardEvent, type: DeviceType) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const canvas = document.querySelector('.react-flow')?.getBoundingClientRect();
    const middle = canvas
      ? screenToFlowPosition({ x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 })
      : { x: 300, y: 200 };
    const jitter = (useProjectStore.getState().project.devices.length % 5) * 20;
    addDevice(type, {
      x: middle.x - DEVICE_NODE_WIDTH / 2 + jitter,
      y: middle.y - DEVICE_NODE_HEIGHT / 2 + jitter,
    });
  };

  return (
    <nav
      aria-label={t('palette.title')}
      className="flex h-full w-48 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-gradient-to-r from-gray-200 to-white p-2 dark:border-gray-700 dark:from-gray-800 dark:to-gray-900"
    >
      {groups.map((group) => (
        <section key={group} className="mb-3">
          <h2 className="panel-heading px-1">{t(`palette.${group}`)}</h2>
          <ul className="grid grid-cols-2 gap-1.5">
            {DEVICE_TYPES.filter((type) => DEVICE_CATALOG[type].group === group).map((type) => (
              <li key={type}>
                <button
                  type="button"
                  draggable={!locked}
                  disabled={locked}
                  onDragStart={(e) => onDragStart(e, type)}
                  onKeyDown={(e) => onKeyDown(e, type)}
                  title={locked ? t('sim.locked') : t(`device.${type}`)}
                  data-device-type={type}
                  className="flex w-full cursor-grab flex-col items-center rounded-md border border-transparent bg-white/70 p-1 text-center text-xxs leading-tight hover:border-accent hover:bg-white active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-800/70 dark:hover:bg-gray-700"
                >
                  <DeviceIcon type={type} size={36} />
                  <span className="mt-0.5 line-clamp-2">{t(`device.${type}`)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-auto px-1 text-xxs text-ink-soft dark:text-gray-400">
        {locked ? t('sim.locked') : t('palette.hint')}
      </p>
    </nav>
  );
}
