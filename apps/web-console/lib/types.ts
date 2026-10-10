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

export interface StageDetail {
  id: string;
  workflow_id: string;
  code: string;
  label: TranslatableText;
  maps_to: string;
  sort_order: number;
  actor: string;
  tracking_active: boolean;
  requires: Record<string, unknown>;
  payment_action: string;
  notify: Record<string, unknown>;
  sla_minutes: number | null;
}

export interface WorkflowDetail {
  id: string;
  name: TranslatableText;
  version: number;
  is_active: boolean;
  stages: StageDetail[];
}

// --- Providers (Phase 2) ---
export interface ProviderOrgDetail {
  id: string;
  entity_type: string;
  legal_name: string;
  display_name: string;
  registration_no: string | null;
  city_id: string | null;
  moyasar_merchant_id: string | null;
  moyasar_status: string;
  nx_verify_ref: string | null;
  rating: number | null;
  is_active: boolean;
}

export interface OnboardingStatus {
  state: string;
  steps: { identity: string; merchant: string; documents: string; approval: string };
  eligible_for_dispatch: boolean;
  blockers: string[];
  documents: {
    all_required_satisfied: boolean;
    blocking_required: string[];
    pending_required: string[];
    expiring: string[];
    items: { doc_type: string; applies_to: string; required: boolean; state: string; expiring_soon: boolean }[];
  };
}

export interface OfferingDetail {
  id: string;
  org_id: string;
  vertical_id: string;
  category_id: string | null;
  zone_id: string | null;
  capabilities: Record<string, unknown>;
  status: string;
  review_notes: string | null;
  is_active: boolean;
}

export interface ProviderDocumentDetail {
  id: string;
  org_id: string;
  agent_id: string | null;
  asset_id: string | null;
  doc_type: string;
  file_url: string;
  expires_on: string | null;
  verify_status: string;
}

export interface ProviderGroupDetail {
  id: string;
  vertical_id: string | null;
  name: TranslatableText;
  description: TranslatableText | null;
}
