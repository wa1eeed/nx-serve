// Mirror of the API management response shapes (packages/contracts api/schemas).
// The console keeps its own light interfaces so it does not bundle the Zod schemas.

export type TranslatableText = { en: string } & Record<string, string>;

export interface VerticalDetail {
  id: string;
  code: string;
  name: TranslatableText;
  default_fulfillment: string;
  default_tracking: string;
  config: Record<string, unknown>;
  is_active: boolean;
}

export interface CategoryDetail {
  id: string;
  vertical_id: string;
  code: string;
  name: TranslatableText;
  parent_id: string | null;
  fulfillment: string | null;
  tracking: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface FieldOption {
  value: string;
  label: TranslatableText;
}

export interface FieldDetail {
  id: string;
  vertical_id: string;
  category_id: string | null;
  scope: string;
  key: string;
  data_type: string;
  label: TranslatableText;
  required: boolean;
  options: FieldOption[] | null;
  validation: Record<string, unknown> | null;
  visibility_rule: Record<string, unknown> | null;
  reference_source: string | null;
  item_catalog_id: string | null;
  used_in_pricing: boolean;
  used_in_matching: boolean;
  match_rule: Record<string, unknown> | null;
  sort_order: number;
  is_active: boolean;
  version: number;
}
