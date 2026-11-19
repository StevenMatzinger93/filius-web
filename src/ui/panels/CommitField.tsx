import { useId, useState, type KeyboardEvent } from 'react';

interface CommitFieldProps {
  label: string;
  value: string;
  /** Übernimmt den Wert; gibt eine Fehlermeldung zurück oder null. */
  onCommit(value: string): string | null;
  placeholder?: string;
  mono?: boolean;
  hint?: string;
  testId?: string;
}

/**
 * Eingabefeld, das erst bei Enter oder beim Verlassen übernimmt (ein Undo-Schritt pro Eingabe).
 * Esc verwirft die Eingabe. Fehler werden unter dem Feld angezeigt und vorgelesen.
 */
export function CommitField({ label, value, onCommit, placeholder, mono, hint, testId }: CommitFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [source, setSource] = useState(value);
  const [error, setError] = useState<string | null>(null);
  if (source !== value) {
    setSource(value);
    setDraft(value);
    setError(null);
  }

  const commit = () => {
    if (draft === value) {
      setError(null);
      return;
    }
    setError(onCommit(draft));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') {
      setDraft(value);
      setError(null);
    }
  };

  return (
    <div className="mb-2">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        className={`field ${mono ? 'font-mono' : ''}`}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        data-testid={testId}
        spellCheck={false}
        autoComplete="off"
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-0.5 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-0.5 text-xxs text-ink-soft dark:text-gray-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
