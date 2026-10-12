import express from 'express';
import { runWatcher } from './watcher-core';
import { adapters } from './adapters';

const app = express();
const port = process.env.PORT || 8080;

// Cloud Schedulerから媒体ごとに `POST /run/:media` を数分〜十数分おきに叩く想定。
app.post('/run/:media', async (req, res) => {
  const adapter = adapters[req.params.media];
  if (!adapter) {
    res.status(404).json({ error: `未知の媒体: ${req.params.media}` });
    return;
  }

  try {
    const result = await runWatcher(adapter, { headless: true });
    if (result.status === 'session_expired') {
      // TODO: ここでSlack通知等のアラートを飛ばし、人手による再ログインにエスカレーションする
      console.error(`[${adapter.slug}] セッション失効を検知`);
    }
    res.status(200).json(result);
  } catch (err) {
    console.error(`[${adapter.slug}] 実行エラー:`, err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/health', (_req, res) => res.status(200).send('ok'));

app.listen(port, () => {
  console.log(`rpa-worker listening on port ${port}`);
});
