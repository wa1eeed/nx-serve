import { jwtVerify } from 'jose';

export interface SocketIdentity {
  actorType: 'customer' | 'agent' | 'staff' | 'api_client' | 'system';
  actorId: string;
  tenantId: string | null;
}

/** Verifies the access JWT presented in the Socket.IO handshake. */
export async function verifyToken(token: string, secret: Uint8Array): Promise<SocketIdentity> {
  const { payload } = await jwtVerify(token, secret);
  const actorType = payload.typ;
  const actorId = payload.sub;
  if (typeof actorType !== 'string' || typeof actorId !== 'string') {
    throw new Error('Invalid token claims');
  }
  const tid = payload.tid;
  return {
    actorType: actorType as SocketIdentity['actorType'],
    actorId,
    tenantId: typeof tid === 'string' ? tid : null,
  };
}
