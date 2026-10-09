/**
 * Dynamic field validation (docs/05). One definition system drives order forms,
 * provider capabilities and asset attributes. Pure: the API resolves references
 * and catalogs against the database separately; here we validate shape, type,
 * rules and conditional visibility.
 */

export type FieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'single_select'
  | 'multi_select'
  | 'date'
  | 'location'
  | 'media'
  | 'item_list'
  | 'reference';

export interface FieldValidationRules {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  regex?: string;
}

export interface VisibilityRule {
  key: string;
  eq?: unknown;
  ne?: unknown;
  in?: unknown[];
}

export interface FieldDefinition {
  key: string;
  dataType: FieldType;
  required: boolean;
  options?: string[];
  validation?: FieldValidationRules;
  visibility?: VisibilityRule;
  allowCustomItems?: boolean;
  referenceSource?: string;
}

export interface FieldError {
  key: string;
  code: string;
  message: string;
}

export interface FieldValidationResult {
  valid: boolean;
  errors: FieldError[];
}

/** Whether a field is shown given the current values (hidden fields are skipped). */
export function isFieldVisible(def: FieldDefinition, values: Record<string, unknown>): boolean {
  const rule = def.visibility;
  if (!rule) return true;
  const other = values[rule.key];
  if ('eq' in rule) return other === rule.eq;
  if ('ne' in rule) return other !== rule.ne;
  if (rule.in) return rule.in.includes(other);
  return true;
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

interface ItemRow {
  catalog_item_id?: unknown;
  custom_name?: unknown;
  quantity?: unknown;
}

/** Validates a payload of attribute values against their definitions. */
export function validateFields(
  defs: readonly FieldDefinition[],
  values: Record<string, unknown>,
): FieldValidationResult {
  const errors: FieldError[] = [];
  const add = (key: string, code: string, message: string): void => {
    errors.push({ key, code, message });
  };

  for (const def of defs) {
    if (!isFieldVisible(def, values)) continue;
    const value = values[def.key];

    if (isEmpty(value)) {
      if (def.required) add(def.key, 'required', `${def.key} is required`);
      continue;
    }

    validateByType(def, value, add);
  }

  return { valid: errors.length === 0, errors };
}

function validateByType(
  def: FieldDefinition,
  value: unknown,
  add: (key: string, code: string, message: string) => void,
): void {
  const r = def.validation;
  switch (def.dataType) {
    case 'text': {
      if (typeof value !== 'string') return add(def.key, 'type', `${def.key} must be text`);
      if (r?.minLength !== undefined && value.length < r.minLength)
        add(def.key, 'min_length', `${def.key} is too short`);
      if (r?.maxLength !== undefined && value.length > r.maxLength)
        add(def.key, 'max_length', `${def.key} is too long`);
      if (r?.regex !== undefined && !new RegExp(r.regex).test(value))
        add(def.key, 'pattern', `${def.key} has an invalid format`);
      return;
    }
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value))
        return add(def.key, 'type', `${def.key} must be a number`);
      if (r?.min !== undefined && value < r.min) add(def.key, 'min', `${def.key} is too small`);
      if (r?.max !== undefined && value > r.max) add(def.key, 'max', `${def.key} is too large`);
      return;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') add(def.key, 'type', `${def.key} must be true or false`);
      return;
    }
    case 'single_select': {
      if (typeof value !== 'string') return add(def.key, 'type', `${def.key} must be a choice`);
      if (def.options && !def.options.includes(value))
        add(def.key, 'not_in_options', `${def.key} is not an allowed choice`);
      return;
    }
    case 'multi_select': {
      if (!Array.isArray(value)) return add(def.key, 'type', `${def.key} must be a list of choices`);
      for (const v of value) {
        if (typeof v !== 'string' || (def.options && !def.options.includes(v)))
          add(def.key, 'not_in_options', `${def.key} contains an invalid choice`);
      }
      return;
    }
    case 'date': {
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
        add(def.key, 'type', `${def.key} must be a date`);
      return;
    }
    case 'location': {
      const loc = value as { lat?: unknown; lng?: unknown };
      if (typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number')
        add(def.key, 'type', `${def.key} must be a location with lat and lng`);
      return;
    }
    case 'media': {
      if (!Array.isArray(value)) add(def.key, 'type', `${def.key} must be a list of media`);
      return;
    }
    case 'reference': {
      if (typeof value !== 'string' || value.length === 0)
        add(def.key, 'empty_reference', `${def.key} must reference an item`);
      return;
    }
    case 'item_list': {
      if (!Array.isArray(value)) return add(def.key, 'type', `${def.key} must be a list of items`);
      for (const raw of value as ItemRow[]) {
        const hasCatalog = typeof raw.catalog_item_id === 'string';
        const hasCustom = typeof raw.custom_name === 'string' && raw.custom_name !== '';
        if (!hasCatalog && !hasCustom)
          add(def.key, 'invalid_item', `${def.key} has an item without a catalog id or name`);
        if (hasCustom && !hasCatalog && def.allowCustomItems !== true)
          add(def.key, 'custom_not_allowed', `${def.key} does not allow custom items`);
        const qty = raw.quantity;
        if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0)
          add(def.key, 'invalid_quantity', `${def.key} has an item with an invalid quantity`);
      }
      return;
    }
  }
}
