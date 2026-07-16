import { describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { handleCommand } from './useWsjtxBridge';

// Minimal stub matching only the on/off/once/emit surface handleCommand
// actually uses, plus an emit call log for assertions.
class StubSocket {
  private handlers = new Map<string, Set<(...args: any[]) => void>>();
  emitted: Array<[string, any]> = [];

  on(event: string, handler: (...args: any[]) => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return this;
  }

  once(event: string, handler: (...args: any[]) => void) {
    return this.on(event, handler);
  }

  off(event: string, handler: (...args: any[]) => void) {
    this.handlers.get(event)?.delete(handler);
    return this;
  }

  emit(event: string, ...args: any[]) {
    this.emitted.push([event, args[0]]);
    this.handlers.get(event)?.forEach((h) => h(...args));
    return true;
  }
}

function fakeWs(readyState: number = WebSocket.OPEN) {
  return { readyState, send: vi.fn() } as unknown as WebSocket;
}

describe('handleCommand', () => {
  it('set-frequency: forwards the frequency and reports success', () => {
    const socket = new StubSocket();
    const ws = fakeWs();

    handleCommand(ws, socket as unknown as Socket, { cmd: 'set-frequency', args: 14074000, id: 1 });

    expect(socket.emitted).toContainEqual(['set-frequency', '14074000']);
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ event: 'cmd-result', id: 1, ok: true }));
  });

  describe('set-mode', () => {
    it('forwards mode and bandwidth for valid args', () => {
      const socket = new StubSocket();
      const ws = fakeWs();

      handleCommand(ws, socket as unknown as Socket, {
        cmd: 'set-mode',
        args: { mode: 'USB', bandwidth: 2400 },
        id: 2,
      });

      expect(socket.emitted).toContainEqual(['set-mode', { mode: 'USB', bandwidth: 2400 }]);
    });

    it('defaults bandwidth to "-1" when omitted', () => {
      const socket = new StubSocket();
      const ws = fakeWs();

      handleCommand(ws, socket as unknown as Socket, { cmd: 'set-mode', args: { mode: 'USB' }, id: 3 });

      expect(socket.emitted).toContainEqual(['set-mode', { mode: 'USB', bandwidth: '-1' }]);
    });

    it('reports invalid args and does not emit set-mode when args is not an object', () => {
      const socket = new StubSocket();
      const ws = fakeWs();

      handleCommand(ws, socket as unknown as Socket, { cmd: 'set-mode', args: 'USB', id: 4 });

      expect(socket.emitted.some(([event]) => event === 'set-mode')).toBe(false);
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'cmd-result', id: 4, ok: false, error: 'invalid args' }),
      );
    });

    it('reports invalid args when mode is missing', () => {
      const socket = new StubSocket();
      const ws = fakeWs();

      handleCommand(ws, socket as unknown as Socket, { cmd: 'set-mode', args: { bandwidth: 2400 }, id: 5 });

      expect(socket.emitted.some(([event]) => event === 'set-mode')).toBe(false);
    });
  });

  describe('set-ptt', () => {
    it.each([
      [1, true],
      [0, false],
      ['1', true],
    ] as const)('coerces args=%p to pttVal=%p', (args, expected) => {
      const socket = new StubSocket();
      const ws = fakeWs();

      handleCommand(ws, socket as unknown as Socket, { cmd: 'set-ptt', args, id: 6 });

      expect(socket.emitted).toContainEqual(['set-ptt', expected]);
    });

    it('reports success immediately regardless of eventual rig confirmation (fire-and-forget)', () => {
      const socket = new StubSocket();
      const ws = fakeWs();

      handleCommand(ws, socket as unknown as Socket, { cmd: 'set-ptt', args: 1, id: 7 });

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ event: 'cmd-result', id: 7, ok: true }));
    });
  });

  it('set-vfo: forwards the VFO name and reports success', () => {
    const socket = new StubSocket();
    const ws = fakeWs();

    handleCommand(ws, socket as unknown as Socket, { cmd: 'set-vfo', args: 'VFOB', id: 8 });

    expect(socket.emitted).toContainEqual(['set-vfo', 'VFOB']);
  });

  describe('set-split-vfo', () => {
    it('forwards split=1 and the given txVFO for valid args', () => {
      const socket = new StubSocket();
      const ws = fakeWs();

      handleCommand(ws, socket as unknown as Socket, {
        cmd: 'set-split-vfo',
        args: { split: true, vfo: 'VFOB' },
        id: 9,
      });

      expect(socket.emitted).toContainEqual(['set-split-vfo', { split: 1, txVFO: 'VFOB' }]);
    });

    it('defaults txVFO to "VFOB" when vfo is omitted, and split to 0 when falsy', () => {
      const socket = new StubSocket();
      const ws = fakeWs();

      handleCommand(ws, socket as unknown as Socket, {
        cmd: 'set-split-vfo',
        args: { split: false },
        id: 10,
      });

      expect(socket.emitted).toContainEqual(['set-split-vfo', { split: 0, txVFO: 'VFOB' }]);
    });

    it('reports invalid args when args is not an object', () => {
      const socket = new StubSocket();
      const ws = fakeWs();

      handleCommand(ws, socket as unknown as Socket, { cmd: 'set-split-vfo', args: 'x', id: 11 });

      expect(socket.emitted.some(([event]) => event === 'set-split-vfo')).toBe(false);
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'cmd-result', id: 11, ok: false, error: 'invalid args' }),
      );
    });
  });

  it('send-raw: forwards the raw command string and reports success', () => {
    const socket = new StubSocket();
    const ws = fakeWs();

    handleCommand(ws, socket as unknown as Socket, { cmd: 'send-raw', args: '\\dump_state', id: 12 });

    expect(socket.emitted).toContainEqual(['send-raw', '\\dump_state']);
  });

  it('reports "unknown command" and emits nothing for an unrecognized cmd', () => {
    const socket = new StubSocket();
    const ws = fakeWs();

    handleCommand(ws, socket as unknown as Socket, { cmd: 'not-a-real-command', args: null, id: 13 });

    expect(socket.emitted).toHaveLength(0);
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'cmd-result', id: 13, ok: false, error: 'unknown command' }),
    );
  });

  it('does not send a result over a closed WebSocket', () => {
    const socket = new StubSocket();
    const ws = fakeWs(WebSocket.CLOSED);

    handleCommand(ws, socket as unknown as Socket, { cmd: 'set-frequency', args: 7074000, id: 14 });

    expect(socket.emitted).toContainEqual(['set-frequency', '7074000']);
    expect(ws.send).not.toHaveBeenCalled();
  });
});
