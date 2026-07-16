// @vitest-environment node
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { issueToken, requireAdmin, requireAuth } from './auth.ts';

function fakeSocket(id = 'socket-1') {
  return { id, emit: vi.fn() } as any;
}

function fakeCtx(authenticatedSockets: Map<string, any> = new Map()) {
  return { authenticatedSockets, jwtSecret: 'test-secret' } as any;
}

describe('requireAuth', () => {
  it('calls the handler with the authInfo when the socket is authenticated', () => {
    const authInfo = { callsign: 'W1ABC', role: 'regular', connectedAt: 0, ip: '127.0.0.1' };
    const socket = fakeSocket();
    const ctx = fakeCtx(new Map([[socket.id, authInfo]]));
    const handler = vi.fn();

    requireAuth(socket, ctx, handler);

    expect(handler).toHaveBeenCalledWith(authInfo);
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('emits auth:required and does not call the handler when unauthenticated', () => {
    const socket = fakeSocket();
    const ctx = fakeCtx();
    const handler = vi.fn();

    requireAuth(socket, ctx, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('auth:required');
  });
});

describe('requireAdmin', () => {
  it('calls the handler when the socket is an authenticated admin', () => {
    const authInfo = { callsign: 'ADMIN', role: 'admin', connectedAt: 0, ip: '127.0.0.1' };
    const socket = fakeSocket();
    const ctx = fakeCtx(new Map([[socket.id, authInfo]]));
    const handler = vi.fn();

    requireAdmin(socket, ctx, handler);

    expect(handler).toHaveBeenCalledWith(authInfo);
  });

  it('emits auth:required and does not call the handler when unauthenticated', () => {
    const socket = fakeSocket();
    const ctx = fakeCtx();
    const handler = vi.fn();

    requireAdmin(socket, ctx, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('auth:required');
  });

  it('emits auth:error and does not call the handler for a non-admin role', () => {
    const authInfo = { callsign: 'W1ABC', role: 'regular', connectedAt: 0, ip: '127.0.0.1' };
    const socket = fakeSocket();
    const ctx = fakeCtx(new Map([[socket.id, authInfo]]));
    const handler = vi.fn();

    requireAdmin(socket, ctx, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('auth:error', { error: 'Forbidden' });
  });
});

describe('issueToken', () => {
  it('signs a JWT carrying the callsign and role, expiring in ~7 days', () => {
    const ctx = fakeCtx();

    const token = issueToken('W1ABC', 'admin', ctx);
    const payload = jwt.verify(token, ctx.jwtSecret) as jwt.JwtPayload;

    expect(payload.sub).toBe('W1ABC');
    expect((payload as any).role).toBe('admin');
    expect(payload.iat).toBeTypeOf('number');
    expect(payload.exp).toBeTypeOf('number');
    const lifetimeSeconds = payload.exp! - payload.iat!;
    expect(lifetimeSeconds).toBe(7 * 24 * 60 * 60);
  });

  it('produces a token that fails verification against a different secret', () => {
    const ctx = fakeCtx();
    const token = issueToken('W1ABC', 'regular', ctx);

    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });
});
