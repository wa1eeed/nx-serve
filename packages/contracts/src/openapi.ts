import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { ProblemSchema } from './errors/problem.js';
import {
  BootstrapResponseSchema,
  CategoryDetailSchema,
  CreateCategorySchema,
  CreateFieldSchema,
  CreateStageSchema,
  CreateVerticalSchema,
  CreateWorkflowSchema,
  FieldDetailSchema,
  FieldResponseSchema,
  FormSchemaSchema,
  ReorderSchema,
  StageDetailSchema,
  UpdateStageSchema,
  UpdateWorkflowSchema,
  WorkflowDetailSchema,
  HealthResponseSchema,
  MeResponseSchema,
  MfaVerifySchema,
  OkStatusSchema,
  OtpChallengeResponseSchema,
  OtpRequestSchema,
  OtpVerifySchema,
  ReadyResponseSchema,
  RefreshSchema,
  StaffLoginResponseSchema,
  StaffLoginSchema,
  TokenPairSchema,
  UpdateCategorySchema,
  UpdateFieldSchema,
  UpdateVerticalSchema,
  VerticalDetailSchema,
  VerticalSummarySchema,
} from './api/schemas.js';
import {
  AddGroupMemberSchema,
  AgentDetailSchema,
  ApplyOfferingSchema,
  AssetDetailSchema,
  CreateAgentSchema,
  CreateAssetSchema,
  CreateProviderGroupSchema,
  DocumentDetailSchema,
  LinkAgentAssetSchema,
  MerchantWebhookSchema,
  OfferingDetailSchema,
  OnboardingStatusSchema,
  PresenceSchema,
  ProviderGroupDetailSchema,
  ProviderOrgDetailSchema,
  RegisterProviderRequestSchema,
  ReviewDocumentSchema,
  ReviewOfferingSchema,
  UploadDocumentSchema,
} from './api/providers.js';
import {
  CreateFeeScheduleSchema,
  CreateRateCardSchema,
  CreateSurgeScheduleSchema,
  EstimateRequestSchema,
  EstimateResponseSchema,
  FeeScheduleDetailSchema,
  FeeScheduleSummarySchema,
  PricingApprovalSchema,
  RateCardDetailSchema,
  RateCardSummarySchema,
  SimulateRequestSchema,
  SimulateResponseSchema,
  SurgeScheduleDetailSchema,
  UpdateFeeScheduleSchema,
  UpdateRateCardSchema,
  UpdateSurgeScheduleSchema,
} from './api/pricing.js';

extendZodWithOpenApi(z);

type AnyZod = z.ZodTypeAny;

/** Builds the OpenAPI 3.1 document for the public API from the Zod contracts. */
export function buildOpenApiDocument(): ReturnType<OpenApiGeneratorV31['generateDocument']> {
  const registry = new OpenAPIRegistry();

  const Problem = registry.register('Problem', ProblemSchema);
  const TokenPair = registry.register('TokenPair', TokenPairSchema);

  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
  registry.registerComponent('securitySchemes', 'secretKey', {
    type: 'http',
    scheme: 'bearer',
    description: 'Tenant secret API key: nx_test_... or nx_live_...',
  });

  const problemResponse = (description: string) => ({
    description,
    content: { 'application/problem+json': { schema: Problem } },
  });
  const jsonBody = (schema: AnyZod) => ({
    content: { 'application/json': { schema } },
  });
  const jsonResponse = (description: string, schema: AnyZod) => ({
    description,
    content: { 'application/json': { schema } },
  });

  registry.registerPath({
    method: 'get',
    path: '/health',
    tags: ['System'],
    summary: 'Liveness probe',
    responses: { 200: jsonResponse('Service is up', HealthResponseSchema) },
  });

  registry.registerPath({
    method: 'get',
    path: '/ready',
    tags: ['System'],
    summary: 'Readiness probe (database and Redis reachable)',
    responses: {
      200: jsonResponse('Dependencies reachable', ReadyResponseSchema),
      503: problemResponse('A dependency is unavailable'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/app/bootstrap',
    tags: ['App'],
    summary: 'Tenant theme, locales and feature flags, resolved by host',
    responses: {
      200: jsonResponse('Bootstrap payload', BootstrapResponseSchema),
      404: problemResponse('Tenant could not be resolved'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/me',
    tags: ['App'],
    summary: 'Current request context (actor, tenant, locale)',
    security: [{ bearerAuth: [] }],
    responses: { 200: jsonResponse('Context', MeResponseSchema) },
  });

  registry.registerPath({
    method: 'get',
    path: '/catalog/verticals',
    tags: ['Catalog'],
    summary: 'List the tenant service verticals',
    security: [{ bearerAuth: [] }, { secretKey: [] }],
    responses: {
      200: jsonResponse('Verticals', z.array(VerticalSummarySchema)),
      404: problemResponse('Tenant could not be resolved'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/catalog/verticals/{id}/form',
    tags: ['Catalog'],
    summary: 'The order form schema for a vertical, merged and localized (ETag versioned)',
    security: [{ bearerAuth: [] }, { secretKey: [] }],
    responses: {
      200: jsonResponse('Form schema', FormSchemaSchema),
      404: problemResponse('Vertical or tenant not found'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/admin/templates/{code}/install',
    tags: ['Catalog'],
    summary: 'Install a published template into the tenant as an editable copy',
    security: [{ bearerAuth: [] }],
    responses: {
      201: jsonResponse('Installed', z.object({ vertical_id: z.string().uuid() })),
      404: problemResponse('Template not found'),
      409: problemResponse('Template already installed'),
    },
  });

  // --- Catalog administration (management console, requires catalog.manage) ---
  const adminSec = [{ bearerAuth: [] }];
  const idParam = { params: z.object({ id: z.string().uuid() }) };
  const uuid = z.string().uuid();

  registry.registerPath({
    method: 'post',
    path: '/admin/verticals',
    tags: ['Catalog admin'],
    summary: 'Create a service vertical',
    security: adminSec,
    request: { body: jsonBody(CreateVerticalSchema) },
    responses: {
      201: jsonResponse('Created', z.object({ id: uuid, code: z.string() })),
      403: problemResponse('Permission denied'),
      422: problemResponse('Validation failed'),
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/admin/verticals/{id}',
    tags: ['Catalog admin'],
    summary: 'Get a vertical (raw, for editing)',
    security: adminSec,
    request: idParam,
    responses: { 200: jsonResponse('Vertical', VerticalDetailSchema), 404: problemResponse('Not found') },
  });
  registry.registerPath({
    method: 'patch',
    path: '/admin/verticals/{id}',
    tags: ['Catalog admin'],
    summary: 'Update a vertical',
    security: adminSec,
    request: { ...idParam, body: jsonBody(UpdateVerticalSchema) },
    responses: { 200: jsonResponse('Updated', z.object({ id: uuid })), 404: problemResponse('Not found') },
  });
  registry.registerPath({
    method: 'delete',
    path: '/admin/verticals/{id}',
    tags: ['Catalog admin'],
    summary: 'Deactivate a vertical (soft delete)',
    security: adminSec,
    request: idParam,
    responses: { 200: jsonResponse('Deactivated', OkStatusSchema), 404: problemResponse('Not found') },
  });

  registry.registerPath({
    method: 'get',
    path: '/admin/verticals/{verticalId}/categories',
    tags: ['Catalog admin'],
    summary: 'List the categories of a vertical (raw, for editing)',
    security: adminSec,
    request: { params: z.object({ verticalId: uuid }) },
    responses: { 200: jsonResponse('Categories', z.array(CategoryDetailSchema)) },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/verticals/{verticalId}/categories',
    tags: ['Catalog admin'],
    summary: 'Create a category under a vertical',
    security: adminSec,
    request: { params: z.object({ verticalId: uuid }), body: jsonBody(CreateCategorySchema) },
    responses: {
      201: jsonResponse('Created', z.object({ id: uuid, code: z.string() })),
      404: problemResponse('Vertical not found'),
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/admin/categories/{id}',
    tags: ['Catalog admin'],
    summary: 'Get a category (raw, for editing)',
    security: adminSec,
    request: idParam,
    responses: { 200: jsonResponse('Category', CategoryDetailSchema), 404: problemResponse('Not found') },
  });
  registry.registerPath({
    method: 'patch',
    path: '/admin/categories/{id}',
    tags: ['Catalog admin'],
    summary: 'Update a category',
    security: adminSec,
    request: { ...idParam, body: jsonBody(UpdateCategorySchema) },
    responses: { 200: jsonResponse('Updated', z.object({ id: uuid })), 404: problemResponse('Not found') },
  });
  registry.registerPath({
    method: 'delete',
    path: '/admin/categories/{id}',
    tags: ['Catalog admin'],
    summary: 'Deactivate a category (soft delete)',
    security: adminSec,
    request: idParam,
    responses: { 200: jsonResponse('Deactivated', OkStatusSchema), 404: problemResponse('Not found') },
  });

  registry.registerPath({
    method: 'get',
    path: '/admin/verticals/{verticalId}/fields',
    tags: ['Catalog admin'],
    summary: 'List the dynamic fields of a vertical (raw, for editing)',
    security: adminSec,
    request: { params: z.object({ verticalId: uuid }) },
    responses: { 200: jsonResponse('Fields', z.array(FieldDetailSchema)) },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/verticals/{verticalId}/fields',
    tags: ['Catalog admin'],
    summary: 'Create a dynamic field',
    security: adminSec,
    request: { params: z.object({ verticalId: uuid }), body: jsonBody(CreateFieldSchema) },
    responses: {
      201: jsonResponse('Created', FieldResponseSchema),
      404: problemResponse('Vertical not found'),
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/admin/fields/{id}',
    tags: ['Catalog admin'],
    summary: 'Get a dynamic field (raw, for editing)',
    security: adminSec,
    request: idParam,
    responses: { 200: jsonResponse('Field', FieldDetailSchema), 404: problemResponse('Not found') },
  });
  registry.registerPath({
    method: 'patch',
    path: '/admin/fields/{id}',
    tags: ['Catalog admin'],
    summary: 'Update a dynamic field',
    security: adminSec,
    request: { ...idParam, body: jsonBody(UpdateFieldSchema) },
    responses: { 200: jsonResponse('Updated', FieldResponseSchema), 404: problemResponse('Not found') },
  });
  registry.registerPath({
    method: 'delete',
    path: '/admin/fields/{id}',
    tags: ['Catalog admin'],
    summary: 'Deactivate a dynamic field (soft delete)',
    security: adminSec,
    request: idParam,
    responses: { 200: jsonResponse('Deactivated', OkStatusSchema), 404: problemResponse('Not found') },
  });

  // Workflow and stages (one workflow per vertical)
  registry.registerPath({
    method: 'get',
    path: '/admin/verticals/{verticalId}/workflow',
    tags: ['Catalog admin'],
    summary: 'The order workflow and its ordered stages for a vertical',
    security: adminSec,
    request: { params: z.object({ verticalId: uuid }) },
    responses: { 200: jsonResponse('Workflow', WorkflowDetailSchema), 404: problemResponse('No workflow yet') },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/verticals/{verticalId}/workflow',
    tags: ['Catalog admin'],
    summary: 'Create and link a workflow for a vertical that has none',
    security: adminSec,
    request: { params: z.object({ verticalId: uuid }), body: jsonBody(CreateWorkflowSchema) },
    responses: {
      201: jsonResponse('Created', z.object({ id: uuid })),
      404: problemResponse('Vertical not found'),
      409: problemResponse('Vertical already has a workflow'),
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/admin/workflows/{id}',
    tags: ['Catalog admin'],
    summary: 'Rename a workflow',
    security: adminSec,
    request: { ...idParam, body: jsonBody(UpdateWorkflowSchema) },
    responses: { 200: jsonResponse('Updated', z.object({ id: uuid })), 404: problemResponse('Not found') },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/workflows/{workflowId}/stages',
    tags: ['Catalog admin'],
    summary: 'Add a stage to a workflow',
    security: adminSec,
    request: { params: z.object({ workflowId: uuid }), body: jsonBody(CreateStageSchema) },
    responses: { 201: jsonResponse('Created', StageDetailSchema), 404: problemResponse('Workflow not found') },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/workflows/{workflowId}/stages/reorder',
    tags: ['Catalog admin'],
    summary: 'Reorder the stages of a workflow',
    security: adminSec,
    request: { params: z.object({ workflowId: uuid }), body: jsonBody(ReorderSchema) },
    responses: { 200: jsonResponse('Reordered', OkStatusSchema), 404: problemResponse('Workflow not found') },
  });
  registry.registerPath({
    method: 'patch',
    path: '/admin/stages/{id}',
    tags: ['Catalog admin'],
    summary: 'Update a stage',
    security: adminSec,
    request: { ...idParam, body: jsonBody(UpdateStageSchema) },
    responses: { 200: jsonResponse('Updated', StageDetailSchema), 404: problemResponse('Not found') },
  });
  registry.registerPath({
    method: 'delete',
    path: '/admin/stages/{id}',
    tags: ['Catalog admin'],
    summary: 'Delete a stage',
    security: adminSec,
    request: idParam,
    responses: {
      200: jsonResponse('Deleted', OkStatusSchema),
      404: problemResponse('Not found'),
      409: problemResponse('Stage is referenced by existing orders'),
    },
  });

  // --- Providers (self service; docs/08) ---
  registry.registerPath({
    method: 'post',
    path: '/providers/register',
    tags: ['Providers'],
    summary: 'Register a provider (OTP verified): starts identity check and creates the sandbox merchant',
    request: { body: jsonBody(RegisterProviderRequestSchema) },
    responses: {
      201: jsonResponse('Registered', z.object({ org: ProviderOrgDetailSchema, tokens: TokenPair })),
      401: problemResponse('OTP invalid or expired'),
      409: problemResponse('Mobile already belongs to a provider'),
      422: problemResponse('Validation failed'),
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/providers/me',
    tags: ['Providers'],
    summary: 'The authenticated provider org and its onboarding readiness',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonResponse('Provider and onboarding', z.object({ org: ProviderOrgDetailSchema, onboarding: OnboardingStatusSchema })),
      401: problemResponse('Provider agent authentication required'),
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/providers/me/agents',
    tags: ['Providers'],
    summary: 'Add an agent to the provider (owner only)',
    security: [{ bearerAuth: [] }],
    request: { body: jsonBody(CreateAgentSchema) },
    responses: { 201: jsonResponse('Agent', AgentDetailSchema), 403: problemResponse('Owner only') },
  });
  registry.registerPath({
    method: 'post',
    path: '/providers/me/assets',
    tags: ['Providers'],
    summary: 'Add an asset (attributes validated against the vertical asset fields)',
    security: [{ bearerAuth: [] }],
    request: { body: jsonBody(CreateAssetSchema) },
    responses: { 201: jsonResponse('Asset', AssetDetailSchema), 422: problemResponse('Invalid attributes') },
  });
  registry.registerPath({
    method: 'post',
    path: '/providers/me/agent-assets',
    tags: ['Providers'],
    summary: 'Link an agent to an asset',
    security: [{ bearerAuth: [] }],
    request: { body: jsonBody(LinkAgentAssetSchema) },
    responses: { 201: jsonResponse('Linked', OkStatusSchema), 404: problemResponse('Agent or asset not found') },
  });
  registry.registerPath({
    method: 'post',
    path: '/providers/me/offerings',
    tags: ['Providers'],
    summary: 'Apply for an offering (category and zone)',
    security: [{ bearerAuth: [] }],
    request: { body: jsonBody(ApplyOfferingSchema) },
    responses: { 201: jsonResponse('Offering', OfferingDetailSchema) },
  });
  registry.registerPath({
    method: 'get',
    path: '/providers/me/offerings',
    tags: ['Providers'],
    summary: 'List the provider offerings',
    security: [{ bearerAuth: [] }],
    responses: { 200: jsonResponse('Offerings', z.array(OfferingDetailSchema)) },
  });
  registry.registerPath({
    method: 'post',
    path: '/providers/me/documents',
    tags: ['Providers'],
    summary: 'Upload a document reference for a category requirement',
    security: [{ bearerAuth: [] }],
    request: { body: jsonBody(UploadDocumentSchema) },
    responses: { 201: jsonResponse('Document', DocumentDetailSchema), 422: problemResponse('Scope or date invalid') },
  });
  registry.registerPath({
    method: 'get',
    path: '/providers/me/documents',
    tags: ['Providers'],
    summary: 'List the provider documents',
    security: [{ bearerAuth: [] }],
    responses: { 200: jsonResponse('Documents', z.array(DocumentDetailSchema)) },
  });
  registry.registerPath({
    method: 'put',
    path: '/providers/me/presence',
    tags: ['Providers'],
    summary: 'Update the agent presence (online, offline, busy) and location',
    security: [{ bearerAuth: [] }],
    request: { body: jsonBody(PresenceSchema) },
    responses: { 200: jsonResponse('Updated', OkStatusSchema) },
  });

  // --- Provider administration (tenant staff; providers.approve) ---
  const providerSec = [{ bearerAuth: [] }];
  const providerIdParam = { params: z.object({ id: z.string().uuid() }) };
  registry.registerPath({
    method: 'get',
    path: '/admin/providers',
    tags: ['Provider admin'],
    summary: 'List the tenant providers',
    security: providerSec,
    responses: { 200: jsonResponse('Providers', z.array(ProviderOrgDetailSchema)) },
  });
  registry.registerPath({
    method: 'get',
    path: '/admin/providers/{id}',
    tags: ['Provider admin'],
    summary: 'A provider and its onboarding readiness',
    security: providerSec,
    request: providerIdParam,
    responses: {
      200: jsonResponse('Provider', z.object({ org: ProviderOrgDetailSchema, onboarding: OnboardingStatusSchema })),
      404: problemResponse('Not found'),
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/admin/providers/{id}/offerings',
    tags: ['Provider admin'],
    summary: 'A provider offerings (to review)',
    security: providerSec,
    request: providerIdParam,
    responses: { 200: jsonResponse('Offerings', z.array(OfferingDetailSchema)) },
  });
  registry.registerPath({
    method: 'get',
    path: '/admin/providers/{id}/documents',
    tags: ['Provider admin'],
    summary: 'A provider documents (to verify)',
    security: providerSec,
    request: providerIdParam,
    responses: { 200: jsonResponse('Documents', z.array(DocumentDetailSchema)) },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/offerings/{id}/review',
    tags: ['Provider admin'],
    summary: 'Approve, request info for, or reject an offering',
    security: providerSec,
    request: { ...providerIdParam, body: jsonBody(ReviewOfferingSchema) },
    responses: { 200: jsonResponse('Offering', OfferingDetailSchema), 404: problemResponse('Not found') },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/documents/{id}/review',
    tags: ['Provider admin'],
    summary: 'Verify or reject a document',
    security: providerSec,
    request: { ...providerIdParam, body: jsonBody(ReviewDocumentSchema) },
    responses: { 200: jsonResponse('Document', DocumentDetailSchema), 404: problemResponse('Not found') },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/providers/{id}/merchant/refresh',
    tags: ['Provider admin'],
    summary: 'Pull the latest merchant status from the gateway',
    security: providerSec,
    request: providerIdParam,
    responses: {
      200: jsonResponse('Provider', ProviderOrgDetailSchema),
      409: problemResponse('No merchant yet'),
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/provider-groups',
    tags: ['Provider admin'],
    summary: 'Create a provider group',
    security: providerSec,
    request: { body: jsonBody(CreateProviderGroupSchema) },
    responses: { 201: jsonResponse('Group', ProviderGroupDetailSchema) },
  });
  registry.registerPath({
    method: 'get',
    path: '/admin/provider-groups',
    tags: ['Provider admin'],
    summary: 'List provider groups',
    security: providerSec,
    responses: { 200: jsonResponse('Groups', z.array(ProviderGroupDetailSchema)) },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/provider-groups/{id}/members',
    tags: ['Provider admin'],
    summary: 'Add an org or agent to a group',
    security: providerSec,
    request: { ...providerIdParam, body: jsonBody(AddGroupMemberSchema) },
    responses: { 200: jsonResponse('Added', OkStatusSchema), 404: problemResponse('Group not found') },
  });
  registry.registerPath({
    method: 'post',
    path: '/webhooks/merchant',
    tags: ['Webhooks'],
    summary: 'Gateway merchant status webhook (shared secret, processed exactly once)',
    request: { body: jsonBody(MerchantWebhookSchema) },
    responses: { 200: jsonResponse('Accepted', OkStatusSchema), 401: problemResponse('Verification failed') },
  });

  // --- Pricing (docs/09) ---
  registry.registerPath({
    method: 'post',
    path: '/estimates',
    tags: ['Pricing'],
    summary: 'Create a price estimate (a quote) for a trip; stored with a short expiry',
    security: [{ bearerAuth: [] }, { secretKey: [] }],
    request: { body: jsonBody(EstimateRequestSchema) },
    responses: {
      201: jsonResponse('Estimate', EstimateResponseSchema),
      404: problemResponse('No active rate card for this scope'),
      422: problemResponse('Validation failed'),
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/pricing/simulate',
    tags: ['Pricing'],
    summary: 'Fee and price simulator: compute a fare, fees, splits and settlement from inputs',
    security: [{ bearerAuth: [] }],
    request: { body: jsonBody(SimulateRequestSchema) },
    responses: { 200: jsonResponse('Simulation', SimulateResponseSchema), 403: problemResponse('Permission denied') },
  });

  // --- Pricing admin: rate cards and fee schedules (maker-checker), surge ---
  const adminPricing = [{ bearerAuth: [] }];
  const pricingId = { params: z.object({ id: z.string().uuid() }) };
  const approvalBody = { body: jsonBody(PricingApprovalSchema) };

  registry.registerPath({
    method: 'post',
    path: '/admin/pricing/rate-cards',
    tags: ['Pricing admin'],
    summary: 'Create a rate-card draft (maker-checker, pricing.edit)',
    security: adminPricing,
    request: { body: jsonBody(CreateRateCardSchema) },
    responses: { 201: jsonResponse('Draft rate card', RateCardDetailSchema), 403: problemResponse('Permission denied'), 404: problemResponse('A referenced tier, city, zone or vehicle class was not found'), 422: problemResponse('Validation failed') },
  });
  registry.registerPath({
    method: 'get',
    path: '/admin/pricing/rate-cards',
    tags: ['Pricing admin'],
    summary: 'List rate cards (all statuses)',
    security: adminPricing,
    responses: { 200: jsonResponse('Rate cards', z.array(RateCardSummarySchema)) },
  });
  registry.registerPath({
    method: 'get',
    path: '/admin/pricing/rate-cards/{id}',
    tags: ['Pricing admin'],
    summary: 'Get a rate card',
    security: adminPricing,
    request: pricingId,
    responses: { 200: jsonResponse('Rate card', RateCardDetailSchema), 404: problemResponse('Not found') },
  });
  registry.registerPath({
    method: 'patch',
    path: '/admin/pricing/rate-cards/{id}',
    tags: ['Pricing admin'],
    summary: 'Update a draft or pending rate card',
    security: adminPricing,
    request: { ...pricingId, body: jsonBody(UpdateRateCardSchema) },
    responses: { 200: jsonResponse('Updated', RateCardDetailSchema), 404: problemResponse('Not found'), 409: problemResponse('Not editable'), 422: problemResponse('Validation failed') },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/pricing/rate-cards/{id}/submit',
    tags: ['Pricing admin'],
    summary: 'Submit a draft rate card for approval',
    security: adminPricing,
    request: pricingId,
    responses: { 200: jsonResponse('Pending approval', RateCardDetailSchema), 404: problemResponse('Not found'), 409: problemResponse('Not a draft') },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/pricing/rate-cards/{id}/approve',
    tags: ['Pricing admin'],
    summary: 'Approve a pending rate card (pricing.approve; the approver cannot be the creator)',
    security: adminPricing,
    request: { ...pricingId, ...approvalBody },
    responses: { 200: jsonResponse('Active', RateCardDetailSchema), 403: problemResponse('Permission denied'), 404: problemResponse('Not found'), 409: problemResponse('Not pending, or approver is the creator') },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/pricing/rate-cards/{id}/reject',
    tags: ['Pricing admin'],
    summary: 'Reject a pending rate card back to draft (pricing.approve)',
    security: adminPricing,
    request: { ...pricingId, ...approvalBody },
    responses: { 200: jsonResponse('Back to draft', RateCardDetailSchema), 403: problemResponse('Permission denied'), 404: problemResponse('Not found'), 409: problemResponse('Not pending') },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/pricing/rate-cards/{id}/archive',
    tags: ['Pricing admin'],
    summary: 'Archive a rate card (pricing.approve)',
    security: adminPricing,
    request: pricingId,
    responses: { 200: jsonResponse('Archived', RateCardDetailSchema), 403: problemResponse('Permission denied'), 404: problemResponse('Not found') },
  });

  registry.registerPath({
    method: 'post',
    path: '/admin/pricing/fee-schedules',
    tags: ['Pricing admin'],
    summary: 'Create a fee-schedule draft with its components (maker-checker, pricing.edit)',
    security: adminPricing,
    request: { body: jsonBody(CreateFeeScheduleSchema) },
    responses: { 201: jsonResponse('Draft fee schedule', FeeScheduleDetailSchema), 403: problemResponse('Permission denied'), 404: problemResponse('A referenced vertical, category, city, zone or provider was not found'), 422: problemResponse('Validation failed') },
  });
  registry.registerPath({
    method: 'get',
    path: '/admin/pricing/fee-schedules',
    tags: ['Pricing admin'],
    summary: 'List fee schedules (all statuses)',
    security: adminPricing,
    responses: { 200: jsonResponse('Fee schedules', z.array(FeeScheduleSummarySchema)) },
  });
  registry.registerPath({
    method: 'get',
    path: '/admin/pricing/fee-schedules/{id}',
    tags: ['Pricing admin'],
    summary: 'Get a fee schedule with its components',
    security: adminPricing,
    request: pricingId,
    responses: { 200: jsonResponse('Fee schedule', FeeScheduleDetailSchema), 404: problemResponse('Not found') },
  });
  registry.registerPath({
    method: 'patch',
    path: '/admin/pricing/fee-schedules/{id}',
    tags: ['Pricing admin'],
    summary: 'Update a draft or pending fee schedule (replaces components when provided)',
    security: adminPricing,
    request: { ...pricingId, body: jsonBody(UpdateFeeScheduleSchema) },
    responses: { 200: jsonResponse('Updated', FeeScheduleDetailSchema), 404: problemResponse('Not found'), 409: problemResponse('Not editable'), 422: problemResponse('Validation failed') },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/pricing/fee-schedules/{id}/submit',
    tags: ['Pricing admin'],
    summary: 'Submit a draft fee schedule for approval',
    security: adminPricing,
    request: pricingId,
    responses: { 200: jsonResponse('Pending approval', FeeScheduleDetailSchema), 404: problemResponse('Not found'), 409: problemResponse('Not a draft') },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/pricing/fee-schedules/{id}/approve',
    tags: ['Pricing admin'],
    summary: 'Approve a pending fee schedule (pricing.approve; the approver cannot be the creator)',
    security: adminPricing,
    request: { ...pricingId, ...approvalBody },
    responses: { 200: jsonResponse('Active', FeeScheduleDetailSchema), 403: problemResponse('Permission denied'), 404: problemResponse('Not found'), 409: problemResponse('Not pending, or approver is the creator') },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/pricing/fee-schedules/{id}/reject',
    tags: ['Pricing admin'],
    summary: 'Reject a pending fee schedule back to draft (pricing.approve)',
    security: adminPricing,
    request: { ...pricingId, ...approvalBody },
    responses: { 200: jsonResponse('Back to draft', FeeScheduleDetailSchema), 403: problemResponse('Permission denied'), 404: problemResponse('Not found'), 409: problemResponse('Not pending') },
  });
  registry.registerPath({
    method: 'post',
    path: '/admin/pricing/fee-schedules/{id}/archive',
    tags: ['Pricing admin'],
    summary: 'Archive a fee schedule (pricing.approve)',
    security: adminPricing,
    request: pricingId,
    responses: { 200: jsonResponse('Archived', FeeScheduleDetailSchema), 403: problemResponse('Permission denied'), 404: problemResponse('Not found') },
  });

  registry.registerPath({
    method: 'post',
    path: '/admin/pricing/surge-schedules',
    tags: ['Pricing admin'],
    summary: 'Create a surge schedule (pricing.edit)',
    security: adminPricing,
    request: { body: jsonBody(CreateSurgeScheduleSchema) },
    responses: { 201: jsonResponse('Created', SurgeScheduleDetailSchema), 403: problemResponse('Permission denied'), 422: problemResponse('Validation failed') },
  });
  registry.registerPath({
    method: 'get',
    path: '/admin/pricing/surge-schedules',
    tags: ['Pricing admin'],
    summary: 'List surge schedules',
    security: adminPricing,
    responses: { 200: jsonResponse('Surge schedules', z.array(SurgeScheduleDetailSchema)) },
  });
  registry.registerPath({
    method: 'patch',
    path: '/admin/pricing/surge-schedules/{id}',
    tags: ['Pricing admin'],
    summary: 'Update a surge schedule',
    security: adminPricing,
    request: { ...pricingId, body: jsonBody(UpdateSurgeScheduleSchema) },
    responses: { 200: jsonResponse('Updated', SurgeScheduleDetailSchema), 404: problemResponse('Not found'), 422: problemResponse('Validation failed') },
  });
  registry.registerPath({
    method: 'delete',
    path: '/admin/pricing/surge-schedules/{id}',
    tags: ['Pricing admin'],
    summary: 'Deactivate a surge schedule',
    security: adminPricing,
    request: pricingId,
    responses: { 200: jsonResponse('Deactivated', OkStatusSchema), 404: problemResponse('Not found') },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/otp/request',
    tags: ['Auth'],
    summary: 'Request a phone OTP for a customer or agent',
    request: { body: jsonBody(OtpRequestSchema) },
    responses: {
      200: jsonResponse('Challenge created', OtpChallengeResponseSchema),
      422: problemResponse('Validation failed'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/otp/verify',
    tags: ['Auth'],
    summary: 'Verify a phone OTP and issue tokens',
    request: { body: jsonBody(OtpVerifySchema) },
    responses: {
      200: jsonResponse('Token pair', TokenPair),
      401: problemResponse('Invalid or expired code'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/staff/login',
    tags: ['Auth'],
    summary: 'Staff email and password login (may require MFA)',
    request: { body: jsonBody(StaffLoginSchema) },
    responses: {
      200: jsonResponse('Token pair or MFA challenge', StaffLoginResponseSchema),
      401: problemResponse('Invalid credentials'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/mfa/verify',
    tags: ['Auth'],
    summary: 'Verify a staff TOTP code and issue tokens',
    request: { body: jsonBody(MfaVerifySchema) },
    responses: {
      200: jsonResponse('Token pair', TokenPair),
      401: problemResponse('Invalid MFA code'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/token/refresh',
    tags: ['Auth'],
    summary: 'Rotate a refresh token (reuse is detected and revokes the family)',
    request: { body: jsonBody(RefreshSchema) },
    responses: {
      200: jsonResponse('Token pair', TokenPair),
      401: problemResponse('Invalid refresh token'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/logout',
    tags: ['Auth'],
    summary: 'Revoke a refresh token',
    request: { body: jsonBody(RefreshSchema) },
    responses: { 200: jsonResponse('Logged out', z.object({ status: z.literal('ok') })) },
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'NX Serve API',
      version: '1.0.0',
      description:
        'Configurable multi-tenant field services platform. snake_case JSON, cursor pagination, RFC 9457 problem+json errors, Idempotency-Key on POSTs. Phase 0 surface.',
    },
    servers: [
      { url: 'https://api.nxserve.dev/v1', description: 'Production' },
      { url: 'http://localhost:3001/v1', description: 'Local' },
    ],
  });
}
