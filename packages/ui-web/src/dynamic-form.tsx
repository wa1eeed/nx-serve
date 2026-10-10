'use client';
import * as React from 'react';
import type { FormSchema, RenderedField } from '@nxserve/domain';

/** Visibility check for a rendered field given the current values (docs/05). */
export function isRenderedFieldVisible(field: RenderedField, values: Record<string, unknown>): boolean {
  const rule = field.visibility;
  if (!rule) return true;
  const other = values[rule.key];
  if ('eq' in rule) return other === rule.eq;
  if ('ne' in rule) return other !== rule.ne;
  if (rule.in) return rule.in.includes(other);
  return true;
}

/** The flattened list of currently visible fields across all sections. */
export function visibleFields(schema: FormSchema, values: Record<string, unknown>): RenderedField[] {
  return schema.sections.flatMap((s) => s.fields).filter((f) => isRenderedFieldVisible(f, values));
}

export interface DynamicFormProps {
  schema: FormSchema;
  defaultValues?: Record<string, unknown>;
  onSubmit?: (values: Record<string, unknown>) => void;
  submitLabel?: string;
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 'var(--nx-radius-md)',
  border: '1px solid var(--nx-color-border)',
  background: 'var(--nx-color-card)',
  color: 'var(--nx-color-foreground)',
  font: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 14,
};

/**
 * Renders an order form from a form schema (docs/05). Server driven: new fields,
 * labels and options appear without a release. RTL follows the document dir.
 */
export function DynamicForm({
  schema,
  defaultValues = {},
  onSubmit,
  submitLabel = 'Submit',
}: DynamicFormProps): React.ReactElement {
  const [values, setValues] = React.useState<Record<string, unknown>>(defaultValues);
  const set = (key: string, value: unknown): void => setValues((prev) => ({ ...prev, [key]: value }));

  const fields = visibleFields(schema, values);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(values);
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      {fields.map((field) => (
        <FieldInput key={field.key} field={field} value={values[field.key]} onChange={(v) => set(field.key, v)} />
      ))}
      <button
        type="submit"
        style={{
          ...inputStyle,
          cursor: 'pointer',
          background: 'var(--nx-color-primary)',
          color: 'var(--nx-color-primary-foreground)',
          border: 'none',
          width: 'fit-content',
          padding: '10px 16px',
          fontWeight: 500,
        }}
      >
        {submitLabel}
      </button>
    </form>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: RenderedField;
  value: unknown;
  onChange: (value: unknown) => void;
}): React.ReactElement {
  const label = (
    <span>
      {field.label ?? field.i18n_key ?? field.key}
      {field.required ? <span style={{ color: 'var(--nx-color-destructive)' }}> *</span> : null}
    </span>
  );

  switch (field.type) {
    case 'boolean':
      return (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {label}
        </label>
      );
    case 'number':
      return (
        <label style={labelStyle}>
          {label}
          <input
            style={inputStyle}
            type="number"
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </label>
      );
    case 'date':
      return (
        <label style={labelStyle}>
          {label}
          <input style={inputStyle} type="date" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
    case 'single_select':
      return (
        <label style={labelStyle}>
          {label}
          <select style={inputStyle} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)}>
            <option value="" />
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      );
    case 'multi_select': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset style={{ ...labelStyle, border: 'none', padding: 0, margin: 0 }}>
          {label}
          {(field.options ?? []).map((o) => (
            <label key={o.value} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))
                }
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      );
    }
    case 'location':
      return (
        <fieldset style={{ ...labelStyle, border: 'none', padding: 0, margin: 0 }}>
          {label}
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={inputStyle} placeholder="lat" inputMode="decimal" onChange={(e) => onChange({ ...(value as object), lat: Number(e.target.value) })} />
            <input style={inputStyle} placeholder="lng" inputMode="decimal" onChange={(e) => onChange({ ...(value as object), lng: Number(e.target.value) })} />
          </div>
        </fieldset>
      );
    default:
      // text, media, item_list, reference: a text input placeholder for Phase 1.
      return (
        <label style={labelStyle}>
          {label}
          <input style={inputStyle} type="text" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
  }
}
