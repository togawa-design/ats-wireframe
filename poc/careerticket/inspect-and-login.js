const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function loadCreds() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'baitai.txt'), 'utf8');
  const section = raw.split('【キャリアチケット就職スカウト】')[1]?.split('残る媒体')[0] || '';
  const url = section.match(/URL[：:]\s*(\S+)/)?.[1];
  const lines = section.split('\n').map((l) => l.trim()).filter(Boolean);
  const loginId = lines.find((l) => l.includes('@') && !l.startsWith('URL'));
  const password = section.match(/pass[：:]\s*(\S+)/)?.[1];
  if (!url || !loginId || !password) {
    throw new Error('baitai.txt からキャリアチケットの認証情報を抽出できませんでした');
  }
  return { url, loginId, password };
}

(async () => {
  const { url, loginId, password } = loadCreds();
  const outDir = path.join(__dirname, '..', 'screenshots');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('[careerticket] ログイン画面を確認:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, 'careerticket-01-top.png'), fullPage: true });
  console.log('[careerticket] title:', await page.title());

  const inputs = await page.$$eval('input, form, button', (els) =>
    els.map((el) => ({ tag: el.tagName, type: el.getAttribute('type'), name: el.getAttribute('name'), id: el.id }))
  );
  console.log('[careerticket] form要素:', JSON.stringify(inputs, null, 2));

  // フォームが見つかれば、実際にログインを試して何が起きるか確認する
  const emailField = inputs.find((i) => i.type === 'email' || i.name?.toLowerCase().includes('mail'));
  const passField = inputs.find((i) => i.type === 'password');

  if (emailField && passField) {
    const emailSelector = emailField.id ? `#${emailField.id}` : `[name="${emailField.name}"]`;
    const passSelector = passField.id ? `#${passField.id}` : `[name="${passField.name}"]`;
    await page.fill(emailSelector, loginId);
    await page.fill(passSelector, password);
    const submitBtn = inputs.find((i) => i.type === 'submit');
    if (submitBtn) {
      const submitSelector = submitBtn.id ? `#${submitBtn.id}` : `[name="${submitBtn.name}"]`;
      await page.click(submitSelector).catch(() => {});
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(3000);
    console.log('[careerticket] ログイン試行後URL:', page.url());
    console.log('[careerticket] ログイン試行後title:', await page.title());
    await page.screenshot({ path: path.join(outDir, 'careerticket-02-after-login.png'), fullPage: true });

    const postInputs = await page.$$eval('input, form', (els) =>
      els.map((el) => ({ tag: el.tagName, type: el.getAttribute('type'), name: el.getAttribute('name'), placeholder: el.getAttribute('placeholder') }))
    );
    console.log('[careerticket] ログイン試行後のform要素:', JSON.stringify(postInputs, null, 2));
  } else {
    console.log('[careerticket] email/passwordフィールドが自動検出できませんでした。手動確認が必要です。');
  }

  await browser.close();
})().catch((err) => {
  console.error('[careerticket] ERROR:', err.message);
  process.exit(1);
});
