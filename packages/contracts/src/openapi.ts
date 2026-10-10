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
