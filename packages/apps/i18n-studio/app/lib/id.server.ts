import { ulid } from 'ulid';

export function newId(): string {
  return ulid();
}

export function nowMs(): number {
  return Date.now();
}
