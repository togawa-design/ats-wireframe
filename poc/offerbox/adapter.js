const path = require('path');

module.exports = {
  name: 'OfferBox',
  statePath: path.join(__dirname, 'storageState.json'),
  listUrl: 'https://app.offerbox.jp/v2/cofferlist#1',

  isLoginPage(url) {
    return url.includes('/clogin/');
  },

  // 選考管理リストの学生カードはReactベースの動的レンダリングで、素のDOMからは取得できない。
  // 実体は `/v2/api/company/offerlist/list` が返すJSONの `list` フィールドに、
  // サーバーサイドレンダリング済みのHTML断片（学生カード1件=1ブロック、
  // data-student-id属性でID付与）が文字列として埋め込まれている。
  // これを正規表現でブロック分割し、IDのみ抽出する（DOM操作は行わない）。
  //
  // TODO: 現状は1ページ目(20件)のみ。ページングへの対応、氏名・大学名等の詳細抽出は未実装
  // （HTML構造が複雑でタグ超えた文字列抽出が必要なため、要追加調査）。
  async extract(page) {
    const responsePromise = page
      .waitForResponse((res) => res.url().includes('/v2/api/company/offerlist/list'), { timeout: 15000 })
      .catch(() => null);

    await page.waitForLoadState('domcontentloaded');
    const response = await responsePromise;
    if (!response) {
      console.warn('[offerbox/adapter] offerlist/listの応答を検知できませんでした。');
      return [];
    }

    const json = await response.json();
    const html = json?.list || '';
    const blocks = html.split(/(?=<div class="profListBrock)/).filter((b) => b.includes('data-student-id'));

    return blocks
      .map((b) => b.match(/data-student-id="(\d+)"/)?.[1])
      .filter(Boolean)
      .map((id) => ({ key: id, label: `学生ID ${id}` }));
  },
};
