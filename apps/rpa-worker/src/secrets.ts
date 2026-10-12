import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();
const projectId = process.env.GCP_PROJECT_ID || 'fujiarte-ats';

// storageState(セッションCookie)はSecret Managerに保存し、ID/PWと同等の機密情報として扱う。
export async function getSecret(name: string): Promise<string> {
  const [version] = await client.accessSecretVersion({
    name: `projects/${projectId}/secrets/${name}/versions/latest`,
  });
  const payload = version.payload?.data?.toString();
  if (!payload) throw new Error(`シークレット ${name} が空です`);
  return payload;
}

export async function setSecret(name: string, value: string): Promise<void> {
  await client.addSecretVersion({
    parent: `projects/${projectId}/secrets/${name}`,
    payload: { data: Buffer.from(value, 'utf8') },
  });
}
