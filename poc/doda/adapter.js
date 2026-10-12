const path = require('path');

module.exports = {
  name: 'DODA',
  statePath: path.join(__dirname, 'storageState.json'),
  // 応募者管理への直リンクは「サービスメニューからの遷移」を経ないと
  // SelectServiceModeにリダイレクトされてしまうため、トップページを起点にする
  listUrl: 'https://assist.doda.jp/DodaAssistR/System/SelectServiceMode',

  isLoginPage(url) {
    return url.includes('auth-connect.doda.jp');
  },

  // 応募者一覧はInfragistics社の古いjQueryグリッド(igGrid)で描画されており、
  // 通常のDOM解析では行データが取得できない。
  // そこで、ページ自身が初期表示時に自動送信する検索フォーム
  // (POST /DodaAssistR/ApplicantManagement/ApplicantManagement_Submit)
  // のJSONレスポンスを横取りして、そこから直接データを読む（DOM操作は一切行わない）。
  async extract(page) {
    const responsePromise = page
      .waitForResponse((res) => res.url().includes('ApplicantManagement_Submit'), { timeout: 15000 })
      .catch(() => null);

    await page.click('text=サービス', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.click('text=doda求人情報サービス', { timeout: 5000 }).catch(() => {});

    const response = await responsePromise;
    if (!response) {
      console.warn('[doda/adapter] ApplicantManagement_Submitの応答を検知できませんでした。');
      return [];
    }

    const json = await response.json();
    const list = json?.data?.applicantManagementListDisplay || [];

    return list.map((r) => ({
      key: String(r.applyNumber),
      label: `${r.name || ''}（${r.age || ''}${r.gender || ''}）${r.offerName || ''} / ${r.phase || ''}`,
      applyNumber: r.applyNumber,
      name: r.name,
      age: r.age,
      gender: r.gender,
      offerName: r.offerName,
      phase: r.phase,
      time: r.time,
    }));
  },
};
