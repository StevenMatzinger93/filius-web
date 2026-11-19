import { downloadText, fileNameFor, pickFile } from '../io/file.ts';
import { parseProject, PROJECT_FILE_EXTENSION, serializeProject } from '../io/serialize.ts';
import { useProjectStore } from '../store/projectStore.ts';

/** Projekt als Datei speichern (Export). */
export function saveProjectToFile(): void {
  const { project, markSaved, setNotice } = useProjectStore.getState();
  const stamped = { ...project, meta: { ...project.meta, modified: new Date().toISOString() } };
  downloadText(fileNameFor(project.meta.name, PROJECT_FILE_EXTENSION), serializeProject(stamped));
  markSaved();
  setNotice({ kind: 'info', key: 'notice.saved' });
}

/** Projektdatei auswählen, prüfen und laden. */
export async function openProjectFromFile(): Promise<void> {
  const file = await pickFile(`${PROJECT_FILE_EXTENSION},.json,application/json`);
  if (!file) return;
  const result = parseProject(await file.text());
  const store = useProjectStore.getState();
  if (!result.ok) {
    store.setNotice({
      kind: 'error',
      key: 'notice.loadFailed',
      params: { reason: result.errors.slice(0, 3).join('; ') },
    });
    return;
  }
  store.replaceProject(result.project);
  store.setNotice({ kind: 'info', key: 'notice.loaded', params: { name: result.project.meta.name } });
}
