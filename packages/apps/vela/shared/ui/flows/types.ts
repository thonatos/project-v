/**
 * A writable signal, structurally. Flows take these so they stay testable in
 * plain Node: NSH signals are callable and expose `set`.
 */
export interface Signal<T> {
  (): T;
  set(value: T): void;
}
