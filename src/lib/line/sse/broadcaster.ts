import { EventEmitter } from 'events';

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export interface SseEvent {
  type: 'new_message' | 'conversation_update' | 'mode_change';
  conversationId: string;
  payload: unknown;
}

export function broadcast(event: SseEvent) {
  emitter.emit('sse', event);
}

export function subscribe(listener: (event: SseEvent) => void): () => void {
  emitter.on('sse', listener);
  return () => emitter.off('sse', listener);
}
