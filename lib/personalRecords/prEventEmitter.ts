/**
 * Event Emitter for PR Events
 * Desacopla las notificaciones de la detección de PRs
 */

import { PR_EVENTS, PREventType, PREventPayload } from '@/types/personalRecord';

// Mapa de listeners por tipo de evento
type EventListener = (payload: PREventPayload) => void | Promise<void>;

const listeners: Map<PREventType, Set<EventListener>> = new Map();

/**
 * Subscribe to a PR event
 * @param event - Event type
 * @param listener - Callback function
 * @returns Unsubscribe function
 */
export function onPREvent(event: PREventType, listener: EventListener): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }

  listeners.get(event)!.add(listener);

  // Return unsubscribe function
  return () => {
    listeners.get(event)?.delete(listener);
  };
}

/**
 * Emit a PR event to all listeners
 * @param event - Event type
 * @param payload - Event payload
 */
export async function emitPREvent(event: PREventType, payload: PREventPayload): Promise<void> {
  const eventListeners = listeners.get(event);

  if (!eventListeners || eventListeners.size === 0) {
    return;
  }

  // Execute all listeners concurrently
  const promises = Array.from(eventListeners).map(async (listener) => {
    try {
      await listener(payload);
    } catch (error) {
      console.error(`[PREventEmitter] Error in listener for ${event}:`, error);
    }
  });

  await Promise.all(promises);
}

/**
 * Remove all listeners for an event
 * @param event - Event type (optional, if omitted clears all events)
 */
export function clearPREventListeners(event?: PREventType): void {
  if (event) {
    listeners.delete(event);
  } else {
    listeners.clear();
  }
}

/**
 * Get count of listeners for an event (useful for debugging)
 * @param event - Event type
 * @returns Number of listeners
 */
export function getPREventListenerCount(event: PREventType): number {
  return listeners.get(event)?.size ?? 0;
}

// Export event constants for convenience
export { PR_EVENTS };

// Default notification handler que loguea en consola
onPREvent(PR_EVENTS.RECORD_BROKEN, (payload) => {
  console.log(
    `[PR Event] 🏆 Nuevo récord para atleta ${payload.athleteId}: ` +
      `${payload.record.distanceLabel} en ${payload.record.timeSeconds}s` +
      (payload.previousRecord
        ? ` (mejora de ${payload.previousRecord.timeSeconds - payload.record.timeSeconds}s)`
        : ' (primer récord)')
  );
});

onPREvent(PR_EVENTS.RECORD_CREATED, (payload) => {
  console.log(
    `[PR Event] 📝 Récord creado para atleta ${payload.athleteId}: ` +
      `${payload.record.distanceLabel} en ${payload.record.timeSeconds}s`
  );
});
