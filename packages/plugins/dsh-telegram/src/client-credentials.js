function credentialError(action) {
  return new Error(action === 'read' ? '无法读取 Telegram 凭据状态' : '无法保存 Telegram Bot Token');
}

export function getCredentialsApi(ctx) {
  if (!ctx.remote?.credentials) throw credentialError('read');
  return ctx.remote.credentials;
}

export async function readCredentialStatuses(credentialsApi, refs) {
  let response;
  try {
    response = await credentialsApi.describe(Object.values(refs));
  } catch {
    throw credentialError('read');
  }
  if (response?.ok !== true) throw credentialError('read');

  return Object.fromEntries(
    Object.entries(refs).map(([key, ref]) => [key, response.value?.[ref]?.configured ?? false]),
  );
}

async function writeCredential(credentialsApi, ref, value) {
  let response;
  try {
    response = await credentialsApi.set(ref, value);
  } catch {
    throw credentialError('write');
  }
  if (response?.ok !== true) throw credentialError('write');
}

export async function saveTelegramSettings({ credentialsApi, scope, sourceEnabled, values, secrets, refs }) {
  if (sourceEnabled) await scope.set('enabled', false);
  for (const [field, value] of Object.entries(values)) {
    if (field !== 'enabled') await scope.set(field, value);
  }
  for (const [key, value] of Object.entries(secrets)) {
    if (value.trim()) await writeCredential(credentialsApi, refs[key], value.trim());
  }

  const credentials = await readCredentialStatuses(credentialsApi, refs);
  if (values.enabled && !credentials.botToken) {
    throw new Error('Bot Token 必须成功保存后才能启用 Telegram');
  }
  await scope.set('enabled', values.enabled);
  return credentials;
}
