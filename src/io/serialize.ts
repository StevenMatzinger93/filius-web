import { PROJECT_SCHEMA_ID, type Project } from '../engine/model/project.ts';
import { projectSchemaV1 } from './schema.ts';

export const PROJECT_FILE_EXTENSION = '.filiusweb.json';

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export type ParseResult = { ok: true; project: Project } | { ok: false; errors: string[] };

/**
 * Liest eine Projektdatei. Ältere Schema-Versionen würden hier migriert
 * (Kette migrateVn → Vn+1); Version 1 ist die erste.
 */
export function parseProject(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Die Datei ist kein gültiges JSON.'] };
  }
  if (
    typeof data !== 'object' ||
    data === null ||
    (data as { schema?: unknown }).schema !== PROJECT_SCHEMA_ID
  ) {
    return { ok: false, errors: ['Die Datei ist kein Filius-Web-Projekt.'] };
  }
  const version = (data as { version?: unknown }).version;
  if (typeof version === 'number' && version > 1) {
    return { ok: false, errors: [`Die Datei stammt aus einer neueren Version (Schema ${version}).`] };
  }
  const result = projectSchemaV1.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((issue) => `${issue.path.join('.') || 'Projekt'}: ${issue.message}`),
    };
  }
  return { ok: true, project: result.data };
}
