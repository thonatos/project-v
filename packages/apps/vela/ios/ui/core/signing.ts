/**
 * The development-signing note, generated from the embedded profile's real
 * expiry, so a long-lived profile never claims it expires in 7 days.
 */
export function signingNotice(expiresAt: string, now: number = Date.now()): string {
  if (!expiresAt) return '未读取到签名信息；覆盖安装不会清除设备身份与数据。';
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) return '未读取到签名信息；覆盖安装不会清除设备身份与数据。';
  if (expires <= now) return '签名已过期，请重新构建并覆盖安装。';
  const days = Math.ceil((expires - now) / 86_400_000);
  if (days <= 7) return `还有 ${days} 天到期，到期前覆盖安装即可。`;
  return '覆盖安装不会清除设备身份与数据。';
}
