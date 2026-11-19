import { formatMask } from '../../engine/model/address.ts';
import { isEndDevice, portsCarryIp } from '../../engine/model/catalog.ts';
import {
  renameDevice,
  setDhcpClient,
  setDns,
  setGateway,
  setInterfaceIp,
  setInterfaceMac,
  setNote,
  type EditError,
} from '../../engine/model/edit.ts';
import type { DeviceConfig, InterfaceConfig, LinkConfig, Project } from '../../engine/model/project.ts';
import { linkAt, movePort } from '../../engine/model/topology.ts';
import { useT, type TFunction } from '../../i18n/index.ts';
import { useProjectStore } from '../../store/projectStore.ts';
import { DeviceIcon } from '../icons/DeviceIcon.tsx';
import { CommitField } from './CommitField.tsx';

type Recipe = (draft: Project) => EditError | null;

/** Änderung ausführen und Fehlertext zurückgeben (null = ok). */
function useEdit() {
  const change = useProjectStore((s) => s.change);
  const t = useT();
  return (label: string, recipe: Recipe): string | null => {
    let error: EditError | null = null;
    change(label, (draft) => {
      error = recipe(draft);
    });
    return error ? errorText(t, error) : null;
  };
}

function errorText(t: TFunction, error: EditError): string {
  switch (error) {
    case 'invalid-ip':
      return t('panel.invalidIp');
    case 'invalid-mask':
      return t('panel.invalidMask');
    case 'invalid-mac':
      return t('panel.invalidMac');
    case 'duplicate-mac':
      return t('panel.duplicateMac');
    case 'invalid-name':
      return t('panel.invalidName');
    default:
      return t('connect.unknown');
  }
}

function peerOf(project: Project, iface: InterfaceConfig): string | null {
  const link = linkAt(project, iface.id);
  if (!link) return null;
  const other = link.a.interfaceId === iface.id ? link.b : link.a;
  const device = project.devices.find((d) => d.id === other.deviceId);
  const port = device?.interfaces.find((i) => i.id === other.interfaceId);
  return device && port ? `${device.name} (${port.name})` : null;
}

function InterfaceEditor({
  device,
  iface,
  project,
}: {
  device: DeviceConfig;
  iface: InterfaceConfig;
  project: Project;
}) {
  const t = useT();
  const edit = useEdit();
  const ipText = iface.ipv4?.address ?? '';
  const maskText = iface.ipv4 ? formatMask(iface.ipv4.prefix) : '';
  const peer = peerOf(project, iface);
  return (
    <fieldset
      className="mb-3 rounded-md border border-gray-200 p-2 dark:border-gray-700"
      data-testid={`iface-${iface.name}`}
    >
      <legend className="px-1 font-mono text-xs font-semibold">{iface.name}</legend>
      <p className="mb-1.5 text-xxs text-ink-soft dark:text-gray-400">
        {t('panel.connectedTo')}: {peer ?? t('panel.free')}
      </p>
      <CommitField
        label={t('panel.ip')}
        value={ipText}
        mono
        hint={t('panel.ipOptional')}
        testId={`ip-${iface.name}`}
        onCommit={(v) =>
          edit('ip', (d) =>
            setInterfaceIp(d, device.id, iface.id, v, v.trim() === '' ? '' : maskText || '255.255.255.0'),
          )
        }
      />
      <CommitField
        label={t('panel.mask')}
        value={maskText}
        mono
        testId={`mask-${iface.name}`}
        onCommit={(v) => edit('mask', (d) => setInterfaceIp(d, device.id, iface.id, ipText, v))}
      />
      <CommitField
        label={t('panel.mac')}
        value={iface.mac}
        mono
        onCommit={(v) => edit('mac', (d) => setInterfaceMac(d, device.id, iface.id, v))}
      />
    </fieldset>
  );
}

function SwitchPorts({ device, project }: { device: DeviceConfig; project: Project }) {
  const t = useT();
  return (
    <section>
      <h3 className="panel-heading">{t('panel.ports')}</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-ink-soft dark:text-gray-400">
            <th className="py-0.5 font-medium">{t('panel.port')}</th>
            <th className="py-0.5 font-medium">{t('panel.connectedTo')}</th>
          </tr>
        </thead>
        <tbody>
          {device.interfaces.map((iface) => {
            const peer = peerOf(project, iface);
            return (
              <tr key={iface.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-0.5 font-mono">{iface.name}</td>
                <td className={`py-0.5 ${peer ? '' : 'text-muted-text'}`}>{peer ?? t('panel.free')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function DeviceProperties({ device, project }: { device: DeviceConfig; project: Project }) {
  const t = useT();
  const edit = useEdit();
  const endDevice = isEndDevice(device.type);
  const first = device.interfaces[0];
  return (
    <div data-testid="device-properties">
      <div className="mb-3 flex items-center gap-2">
        <DeviceIcon type={device.type} size={40} />
        <div>
          <div className="text-sm font-semibold">{device.name}</div>
          <div className="text-xs text-ink-soft dark:text-gray-400">{t(`device.${device.type}`)}</div>
        </div>
      </div>
      <CommitField
        label={t('panel.name')}
        value={device.name}
        testId="device-name"
        onCommit={(v) => edit('rename', (d) => renameDevice(d, device.id, v))}
      />
      {endDevice && first && (
        <>
          <label className="mb-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={device.dhcpClient}
              onChange={(e) => edit('dhcp', (d) => setDhcpClient(d, device.id, e.target.checked))}
            />
            {t('panel.dhcp')}
          </label>
          <CommitField
            label={t('panel.gateway')}
            value={device.gateway}
            mono
            hint={t('panel.ipOptional')}
            testId="device-gateway"
            onCommit={(v) => edit('gateway', (d) => setGateway(d, device.id, v))}
          />
          <CommitField
            label={t('panel.dns')}
            value={device.dns}
            mono
            hint={t('panel.ipOptional')}
            onCommit={(v) => edit('dns', (d) => setDns(d, device.id, v))}
          />
        </>
      )}
      {!endDevice && portsCarryIp(device.type) && (
        <CommitField
          label={t('panel.gateway')}
          value={device.gateway}
          mono
          hint={t('panel.ipOptional')}
          onCommit={(v) => edit('gateway', (d) => setGateway(d, device.id, v))}
        />
      )}
      {portsCarryIp(device.type) ? (
        <section>
          <h3 className="panel-heading">{t('panel.interfaces')}</h3>
          {device.interfaces.map((iface) => (
            <InterfaceEditor key={iface.id} device={device} iface={iface} project={project} />
          ))}
        </section>
      ) : (
        <SwitchPorts device={device} project={project} />
      )}
      <div className="mt-3">
        <label className="field-label" htmlFor="device-note">
          {t('panel.note')}
        </label>
        <textarea
          id="device-note"
          className="field min-h-16"
          defaultValue={device.note}
          key={`${device.id}-${device.note}`}
          onBlur={(e) => {
            if (e.target.value !== device.note) edit('note', (d) => setNote(d, device.id, e.target.value));
          }}
        />
      </div>
    </div>
  );
}

function LinkProperties({ link, project }: { link: LinkConfig; project: Project }) {
  const t = useT();
  const change = useProjectStore((s) => s.change);
  return (
    <div data-testid="link-properties">
      <h3 className="panel-heading">{t('panel.link')}</h3>
      {(['a', 'b'] as const).map((side, index) => {
        const end = link[side];
        const device = project.devices.find((d) => d.id === end.deviceId);
        if (!device) return null;
        const options = device.interfaces.filter((i) => {
          const occupant = linkAt(project, i.id);
          return !occupant || occupant.id === link.id;
        });
        const selectId = `link-end-${side}`;
        return (
          <div key={side} className="mb-2">
            <label className="field-label" htmlFor={selectId}>
              {t('panel.linkEnd', { n: index + 1 })}: {device.name}
            </label>
            <select
              id={selectId}
              className="field font-mono"
              value={end.interfaceId}
              onChange={(e) => change('move-port', (d) => void movePort(d, link.id, side, e.target.value))}
            >
              {options.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

export function PropertiesPanel() {
  const t = useT();
  const project = useProjectStore((s) => s.project);
  const selection = useProjectStore((s) => s.selection);
  const deleteSelection = useProjectStore((s) => s.deleteSelection);
  const count = selection.deviceIds.length + selection.linkIds.length;

  let body;
  if (count === 0) {
    body = <p className="text-sm text-ink-soft dark:text-gray-400">{t('panel.nothing')}</p>;
  } else if (count > 1) {
    body = <p className="text-sm">{t('panel.multi', { count })}</p>;
  } else if (selection.deviceIds[0]) {
    const device = project.devices.find((d) => d.id === selection.deviceIds[0]);
    body = device ? <DeviceProperties key={device.id} device={device} project={project} /> : null;
  } else {
    const link = project.links.find((l) => l.id === selection.linkIds[0]);
    body = link ? <LinkProperties link={link} project={project} /> : null;
  }

  return (
    <aside
      aria-label={t('panel.title')}
      className="flex h-full w-80 shrink-0 flex-col border-l border-gray-200 bg-surface dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <h2 className="text-sm font-semibold">{t('panel.title')}</h2>
        {count > 0 && (
          <button type="button" className="btn text-danger" onClick={deleteSelection}>
            {t('panel.delete')}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3">{body}</div>
    </aside>
  );
}
