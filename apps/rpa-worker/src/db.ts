import { Pool } from 'pg';

// Cloud Run上では Cloud SQL Auth Proxy のUnixソケット経由で接続する。
// ローカル開発時は DATABASE_URL をそのまま使う。
const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME; // 例: fujiarte-ats:asia-northeast1:fujiarte-ats-db

export const pool = new Pool(
  instanceConnectionName
    ? {
        host: `/cloudsql/${instanceConnectionName}`,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'postgres',
      }
    : {
        connectionString: process.env.DATABASE_URL,
      }
);
