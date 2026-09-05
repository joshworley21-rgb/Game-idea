type Handler<T> = (payload: T) => void;

/** Minimal typed pub/sub used to keep the UI decoupled from the engine. */
export class Emitter<Events> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, fn: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of [...set]) (fn as Handler<Events[K]>)(payload);
  }
}
