import { describe, expect, it, vi } from 'vitest';
import { broadcast, subscribe } from './broadcaster';

describe('broadcaster · subscribe + broadcast', () => {
  it('delivers events to an active subscriber', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    broadcast({ type: 'new_message', conversationId: 'c1', payload: { text: 'hi' } });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      type: 'new_message',
      conversationId: 'c1',
      payload: { text: 'hi' },
    });

    unsubscribe();
  });

  it('stops delivering after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    unsubscribe();
    broadcast({ type: 'conversation_update', conversationId: 'c2', payload: {} });

    expect(listener).not.toHaveBeenCalled();
  });

  it('delivers to multiple subscribers independently', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    const u1 = subscribe(l1);
    const u2 = subscribe(l2);

    broadcast({ type: 'mode_change', conversationId: 'c3', payload: { mode: 'human_active' } });

    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);

    u1();
    u2();
  });

  it('does not deliver to unsubscribed listener while keeping others', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    const u1 = subscribe(l1);
    const u2 = subscribe(l2);

    u1();
    broadcast({ type: 'new_message', conversationId: 'c4', payload: {} });

    expect(l1).not.toHaveBeenCalled();
    expect(l2).toHaveBeenCalledTimes(1);

    u2();
  });

  it('supports all three event types', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    broadcast({ type: 'new_message', conversationId: 'c', payload: {} });
    broadcast({ type: 'conversation_update', conversationId: 'c', payload: {} });
    broadcast({ type: 'mode_change', conversationId: 'c', payload: {} });

    expect(listener).toHaveBeenCalledTimes(3);
    const types = listener.mock.calls.map((c) => (c[0] as { type: string }).type);
    expect(types).toEqual(['new_message', 'conversation_update', 'mode_change']);

    unsubscribe();
  });
});