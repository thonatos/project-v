/**
 * The one RPC envelope both clients accept from Core.
 *
 * The transport differs (a spawned helper on macOS, the C ABI on iOS), but the
 * response shape and error normalization are shared so a protocol change is
 * made once.
 */

/** A failed Core exchange, with the prefix Core adds already stripped. */
export class CoreError extends Error {
  readonly reason: string;

  constructor(message: string) {
    super(message);
    this.name = 'CoreError';
    // The host rejects with "<code>: <message>"; the message is what users read.
    this.reason = message.replace(/^Error:\s*/, '').replace(/^[a-z_]+:\s*/, '');
  }
}

export interface Envelope<Payload> {
  readonly type: string;
  readonly payload?: Payload;
}

/** Parses one response line and asserts it is the kind the caller asked for. */
export function parseEnvelope<Payload>(kind: string, expect: string, raw: string): Payload {
  let envelope: Envelope<Payload>;
  try {
    envelope = JSON.parse(raw) as Envelope<Payload>;
  } catch {
    throw new CoreError(`${kind} 返回了无法解析的响应`);
  }
  if (envelope.type === 'error') {
    const payload = envelope.payload as { message?: string } | undefined;
    throw new CoreError(payload?.message ?? `${kind} 失败`);
  }
  if (envelope.type !== expect || envelope.payload === undefined) {
    throw new CoreError(`${kind} 返回了意外的响应`);
  }
  return envelope.payload;
}
