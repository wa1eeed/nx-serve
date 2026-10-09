import { rooms } from '@nxserve/contracts';
import { type SocketIdentity } from './auth.js';

/**
 * Rooms a client auto joins on connect based on its identity. Staff watch their
 * tenant ops room; customers and agents watch their own room. Order rooms are
 * joined on explicit, authorized subscription (later phases).
 */
export function roomsForIdentity(identity: SocketIdentity): string[] {
  if (!identity.tenantId) return [];
  switch (identity.actorType) {
    case 'staff':
      return [rooms.tenantOps(identity.tenantId)];
    case 'customer':
      return [rooms.customer(identity.actorId)];
    case 'agent':
      return [rooms.agent(identity.actorId)];
    default:
      return [];
  }
}
