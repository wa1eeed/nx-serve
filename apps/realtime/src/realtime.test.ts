import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { verifyToken } from './auth.js';
import { roomsForIdentity } from './rooms.js';

const secret = new TextEncoder().encode('test-secret');

async function sign(claims: Record<string, unknown>, sub: string): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
}

describe('verifyToken', () => {
  it('extracts the identity from a valid token', async () => {
    const token = await sign({ typ: 'staff', tid: 'T1' }, 'U1');
    const identity = await verifyToken(token, secret);
    expect(identity).toEqual({ actorType: 'staff', actorId: 'U1', tenantId: 'T1' });
  });

  it('rejects a token signed with another secret', async () => {
    const token = await new SignJWT({ typ: 'staff' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('U1')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('other'));
    await expect(verifyToken(token, secret)).rejects.toThrow();
  });
});

describe('roomsForIdentity', () => {
  it('joins staff to the tenant ops room and customers to their own', () => {
    expect(roomsForIdentity({ actorType: 'staff', actorId: 'U1', tenantId: 'T1' })).toEqual([
      'tenant:T1:ops',
    ]);
    expect(roomsForIdentity({ actorType: 'customer', actorId: 'C1', tenantId: 'T1' })).toEqual([
      'customer:C1',
    ]);
    expect(roomsForIdentity({ actorType: 'agent', actorId: 'A1', tenantId: null })).toEqual([]);
  });
});
