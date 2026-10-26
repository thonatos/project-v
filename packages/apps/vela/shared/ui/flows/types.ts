/**
 * A writable signal, structurally. Flows take these so they stay testable in
 * plain Node: NSH signals are callable and expose `set`.
 */
export interface WritableValue<T> {
  (): T;
  set(value: T): void;
}

/** The owning store supplies NSH's `batch`; plain tests may run it directly. */
export type Transaction = (run: () => void) => void;
export const directTransaction: Transaction = (run) => run();
