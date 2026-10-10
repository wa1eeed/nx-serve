'use client';
import { useCallback, useState, type ReactNode } from 'react';
import { ApiError } from '../lib/api';
import { useT } from '../lib/i18n';

const controlStyle = {
  padding: '8px 10px',
  borderRadius: 'var(--nx-radius-md)',
  border: '1px solid var(--nx-color-border)',
  background: 'var(--nx-color-card)',
  color: 'var(--nx-color-foreground)',
  font: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
} as const;

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 14 }}>
      <span>
        {label}
        {required ? <span style={{ color: 'var(--nx-color-destructive)' }}> *</span> : null}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: {
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
}): ReactNode {
  return (
    <input
      style={controlStyle}
      type={props.type ?? 'text'}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function TextArea(props: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }): ReactNode {
  return (
    <textarea
      style={{ ...controlStyle, fontFamily: 'var(--nx-font-mono, monospace)', resize: 'vertical' }}
      rows={props.rows ?? 3}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function SelectInput(props: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}): ReactNode {
  return (
    <select style={controlStyle} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CheckboxInput(props: { label: string; value: boolean; onChange: (v: boolean) => void }): ReactNode {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
      <input type="checkbox" checked={props.value} onChange={(e) => props.onChange(e.target.checked)} />
      {props.label}
    </label>
  );
}

const buttonBase = {
  padding: '9px 16px',
  borderRadius: 'var(--nx-radius-md)',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: 500,
} as const;

export function PrimaryButton(props: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}): ReactNode {
  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        ...buttonBase,
        border: 'none',
        background: 'var(--nx-color-primary)',
        color: 'var(--nx-color-primary-foreground)',
        opacity: props.disabled ? 0.6 : 1,
      }}
    >
      {props.children}
    </button>
  );
}

export function GhostButton(props: { children: ReactNode; onClick?: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        ...buttonBase,
        border: '1px solid var(--nx-color-border)',
        background: 'transparent',
        color: 'var(--nx-color-foreground)',
      }}
    >
      {props.children}
    </button>
  );
}

/** Shows a write failure with the real problem+json reason (auth, conflict, validation). */
export function SubmitError({ error }: { error: ApiError | Error }): ReactNode {
  const t = useT();
  const api = error instanceof ApiError ? error : undefined;
  const base = api && (api.status === 401 || api.status === 403) ? t('error.auth') : t('error.api');
  const detail = api?.message && api.message !== base ? api.message : undefined;
  return (
    <div
      role="alert"
      style={{
        border: '1px solid var(--nx-color-destructive)',
        color: 'var(--nx-color-destructive)',
        borderRadius: 'var(--nx-radius-md)',
        padding: '10px 12px',
        fontSize: 14,
      }}
    >
      {detail ?? base}
      {api?.code ? <span style={{ opacity: 0.7 }}> ({api.code})</span> : null}
    </div>
  );
}

export type SubmitState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'error'; error: ApiError | Error }
  | { status: 'done' };

/** Runs an async write once at a time, tracking pending, error and done for the UI. */
export function useSubmit(): { state: SubmitState; run: (fn: () => Promise<void>) => Promise<void> } {
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const run = useCallback(async (fn: () => Promise<void>) => {
    setState({ status: 'pending' });
    try {
      await fn();
      setState({ status: 'done' });
    } catch (error) {
      setState({ status: 'error', error: error as Error });
    }
  }, []);
  return { state, run };
}
