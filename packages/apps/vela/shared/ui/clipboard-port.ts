export interface ClipboardTextPort {
  writeText(text: string): Promise<void>;
  readText(): Promise<string>;
}

export async function copyTextWith(port: ClipboardTextPort, text: string): Promise<boolean> {
  if (!text) return false;
  await port.writeText(text);
  return (await port.readText()) === text;
}
