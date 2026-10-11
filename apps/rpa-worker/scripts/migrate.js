// 一度きりのマイグレーション実行用スクリプト(本番の継続運用では使わない)。
const fs = require('fs');
const path = require('path');
const { Connector } = require('@google-cloud/cloud-sql-connector');
const { Client } = require('pg');

(async () => {
  const connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName: 'fujiarte-ats:asia-northeast1:fujiarte-ats-db',
    ipType: 'PUBLIC',
  });

  const client = new Client({
    ...clientOpts,
    user: 'postgres',
    password: process.env.PGPASSWORD,
    database: 'postgres',
  });

  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', '001_init.sql'), 'utf8');
  await client.query(sql);
  console.log('マイグレーション完了');
  await client.end();
  connector.close();
})().catch((err) => {
  console.error('マイグレーション失敗:', err.message);
  process.exit(1);
});
