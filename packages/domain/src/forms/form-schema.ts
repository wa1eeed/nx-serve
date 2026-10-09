/**
 * Form schema builder (docs/05). Merges the order form layers into one versioned
 * schema the web and mobile renderers consume: fulfillment fields derived from
 * the mode, then the tenant's service fields with labels resolved to the locale.
 * Pure: the API loads the definitions and entitlements and calls this.
 */
import { type FieldType, type FieldValidationRules, type VisibilityRule } from '../fields/validate.js';

export type Locale = 'ar' | 'en';
export type TranslatedText = { en: string } & Record<string, string>;
export type FulfillmentMode = 'at_customer' | 'point_to_point' | 'at_provider' | 'remote';
export type TrackingMode = 'none' | 'en_route' | 'full_trip';

export interface ServiceFieldDef {
  key: string;
  dataType: FieldType;
  required: boolean;
  label: TranslatedText;
  options?: { value: string; label: TranslatedText }[];
  validation?: FieldValidationRules;
  visibility?: VisibilityRule;
  allowCustomItems?: boolean;
  referenceSource?: string;
  requiresModule?: string;
}

export interface RenderedOption {
  value: string;
  label: string;
}

export interface RenderedField {
  key: string;
  type: FieldType;
  required: boolean;
  label?: string;
  i18n_key?: string;
  options?: RenderedOption[];
  validation?: FieldValidationRules;
  visibility?: VisibilityRule;
  allow_custom?: boolean;
  reference_source?: string;
}

export interface FormSection {
  key: 'fulfillment' | 'service';
  fields: RenderedField[];
}

export interface FormSchema {
  version: string;
  locale: Locale;
  fulfillment: FulfillmentMode;
  tracking: TrackingMode;
  sections: FormSection[];
}

export interface BuildFormSchemaInput {
  version: string;
  locale: Locale;
  fulfillment: FulfillmentMode;
  tracking: TrackingMode;
  serviceFields: ServiceFieldDef[];
  /** Effective tenant modules; fields that require a missing module are omitted. */
  entitledModules?: ReadonlySet<string>;
}

/** Resolves translatable text to the locale, falling back to the en source. */
export function resolveText(text: TranslatedText, locale: Locale): string {
  const value = text[locale];
  return typeof value === 'string' && value.length > 0 ? value : text.en;
}

/** Structural location fields implied by the fulfillment mode (docs/05 layer 2). */
function fulfillmentFields(mode: FulfillmentMode): RenderedField[] {
  switch (mode) {
    case 'at_customer':
      return [{ key: 'origin', type: 'location', required: true, i18n_key: 'fields.origin' }];
    case 'point_to_point':
      return [
        { key: 'origin', type: 'location', required: true, i18n_key: 'fields.pickup' },
        { key: 'destination', type: 'location', required: true, i18n_key: 'fields.dropoff' },
      ];
    case 'at_provider':
      return [
        { key: 'provider_branch', type: 'reference', required: true, i18n_key: 'fields.branch', reference_source: 'provider_branch' },
        { key: 'appointment_slot', type: 'date', required: true, i18n_key: 'fields.appointment' },
      ];
    case 'remote':
      return [];
  }
}

export function buildFormSchema(input: BuildFormSchemaInput): FormSchema {
  const service: RenderedField[] = [];
  for (const def of input.serviceFields) {
    if (def.requiresModule && input.entitledModules && !input.entitledModules.has(def.requiresModule)) {
      continue;
    }
    const field: RenderedField = {
      key: def.key,
      type: def.dataType,
      required: def.required,
      label: resolveText(def.label, input.locale),
    };
    if (def.options) {
      field.options = def.options.map((o) => ({ value: o.value, label: resolveText(o.label, input.locale) }));
    }
    if (def.validation) field.validation = def.validation;
    if (def.visibility) field.visibility = def.visibility;
    if (def.allowCustomItems) field.allow_custom = true;
    if (def.referenceSource) field.reference_source = def.referenceSource;
    service.push(field);
  }

  return {
    version: input.version,
    locale: input.locale,
    fulfillment: input.fulfillment,
    tracking: input.tracking,
    sections: [
      { key: 'fulfillment', fields: fulfillmentFields(input.fulfillment) },
      { key: 'service', fields: service },
    ],
  };
}
