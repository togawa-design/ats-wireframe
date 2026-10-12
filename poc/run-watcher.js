// 使い方: node poc/run-watcher.js <media> [--headed]
// 例:     node poc/run-watcher.js mynavi
//         node poc/run-watcher.js rekatsu --headed   (Re就活はheadlessだとBot対策で403になるため)
//
// cron等でこのコマンドを媒体ごとに数分〜十数分おきに実行する想定。
const path = require('path');
const core = require('./lib/watcher-core');

const media = process.argv[2];
const headed = process.argv.includes('--headed');
if (!media) {
  console.error('使い方: node poc/run-watcher.js <media> [--headed]  (例: mynavi, rekatsu, offerbox, kimisuka, doda, mynavi-tenshoku)');
  process.exit(1);
}

const adapterPath = path.join(__dirname, media, 'adapter.js');
let adapter;
try {
  adapter = require(adapterPath);
} catch (err) {
  console.error(`[run-watcher] ${adapterPath} が読み込めません:`, err.message);
  process.exit(1);
}

core.run(adapter, { headless: !headed });
