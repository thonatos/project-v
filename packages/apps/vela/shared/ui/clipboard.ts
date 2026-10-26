import { Clipboard } from 'nsh/clipboard';
import { copyTextWith } from './clipboard-port';

/** Writes and verifies text so a capability refusal is visible to the caller. */
export async function copyText(text: string): Promise<boolean> {
  return copyTextWith(Clipboard, text);
}
