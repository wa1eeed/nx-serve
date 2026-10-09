import { type EventEnvelope } from './events/envelope.js';

/** Redis pub/sub channel the worker publishes outbox events to; realtime subscribes. */
export const EVENTS_CHANNEL = 'nx:events';

/** Socket.IO room names (docs/14). */
export const rooms = {
  tenantOps: (tenantId: string): string => `tenant:${tenantId}:ops`,
  tenantZone: (tenantId: string, zone: string): string => `tenant:${tenantId}:zone:${zone}`,
  order: (orderId: string): string => `order:${orderId}`,
  agent: (agentId: string): string => `agent:${agentId}`,
  customer: (customerId: string): string => `customer:${customerId}`,
  providerOrg: (orgId: string): string => `provider_org:${orgId}`,
};

/**
 * Resolves the Socket.IO rooms an event should fan out to from its envelope.
 * Pure so it is unit tested and shared by the worker and realtime gateway.
 */
export function roomsForEvent(envelope: EventEnvelope): string[] {
  const data = envelope.data as Record<string, unknown>;
  const targets = new Set<string>([rooms.tenantOps(envelope.tenant_id)]);

  const orderId = data['order_id'];
  if (typeof orderId === 'string') targets.add(rooms.order(orderId));

  const agentId = data['agent_id'];
  if (typeof agentId === 'string') targets.add(rooms.agent(agentId));

  const customerId = data['customer_id'];
  if (typeof customerId === 'string') targets.add(rooms.customer(customerId));

  const orgId = data['provider_org_id'];
  if (typeof orgId === 'string') targets.add(rooms.providerOrg(orgId));

  return [...targets];
}
