import {test as base, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {squadsExample,validateSquadsDraft} from '../../dist/squads.mjs';

const dist = new URL('../../dist/', import.meta.url);
const file = name => fileURLToPath(new URL(name, dist));
const json = name => JSON.parse(readFileSync(file(name), 'utf8'));
const legacy = json('fixture-session.json');
const validation = json('validation.json');
const assets = ['index.html', 'app.mjs', 'style.css', 'protocol.mjs', 'crypto.mjs',
  'squads.mjs','squads-ui.mjs',
  'validation.json', 'fixture-session.json', 'nonce-fixture-session.json',
  'fixture-result.json', 'policy-fixture-result.json', 'policy-nonce-fixture-result.json'];
const digest = data => createHash('sha256').update(data).digest('hex');

const test = base.extend({
  diagnostics: [async ({page, context, baseURL}, use, testInfo) => {
    if (!baseURL) throw new Error('Set DTS_BROWSER_BASE_URL to the review deployment for this checkout.');
    const origin = new URL(baseURL).origin;
    const javascriptErrors = [], unexpectedRequests = [], failedLocalRequests = [];
    page.on('pageerror', error => javascriptErrors.push(error.message));
    page.on('requestfailed', request => {
      if (new URL(request.url()).origin === origin) failedLocalRequests.push(request.url());
    });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (!['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) unexpectedRequests.push(url.href);
      await route.abort();
    });
    await use();
    await testInfo.attach('browser-diagnostics', {
      body: Buffer.from(JSON.stringify({browser: context.browser()?.version(), viewport: page.viewportSize(),
        javascriptErrors, unexpectedRequests, failedLocalRequests, externalFonts: 'disabled'}, null, 2)),
      contentType: 'application/json',
    });
    expect(javascriptErrors, 'Uncaught JavaScript errors').toEqual([]);
    expect(unexpectedRequests, 'Unexpected external requests').toEqual([]);
    expect(failedLocalRequests, 'Failed application requests').toEqual([]);
  }, {auto: true}],
});

async function view(page, name) {
  if (name === 'readiness') await page.getByRole('button', {name: 'View scope'}).click();
  else await page.locator(`.nav-item[data-view="${name}"]`).click();
  await expect(page.locator(`#${name}-view`)).toBeVisible();
}

async function chooseFile(page, button, input) {
  const pending = page.waitForEvent('filechooser');
  await page.locator(button).click();
  await (await pending).setFiles(input);
}

async function importSession(page, name) {
  const packet = json(name);
  await view(page, 'review');
  await chooseFile(page, '#import-session', file(name));
  await expect(page.locator('#review-content')).toBeVisible();
  await expect(page.locator('#session-id')).toHaveText(packet.messageSha256.slice(0, 16));
  await expect(page.locator('#decoded')).toContainText(packet.review.recipient);
  await expect(page.locator('#decoded')).toContainText(packet.review.amountSol + ' SOL');
  return packet;
}

async function importResult(page, name) {
  await view(page, 'verify');
  await chooseFile(page, '#import-result', file(name));
}

async function downloadJson(page, selector, testInfo, name) {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  const download = await pending;
  const path = testInfo.outputPath(name);
  await download.saveAs(path);
  expect(await download.failure()).toBeNull();
  await testInfo.attach(name, {path, contentType: 'application/json'});
  return JSON.parse(await readFile(path, 'utf8'));
}

async function capture(page, testInfo, name) {
  await page.evaluate(async () => { await document.fonts.ready; });
  // Let the real notification expire so it cannot obscure review evidence.
  await expect(page.locator('#toast')).toBeHidden({timeout: 10000});
  const dimensions = await page.evaluate(() => ({width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth}));
  expect(dimensions.scroll, `${name}: horizontal document overflow`).toBeLessThanOrEqual(dimensions.width);
  const path = testInfo.outputPath(name + '.png');
  await page.screenshot({path, fullPage: true});
  await testInfo.attach(name, {path, contentType: 'image/png'});
}

test.beforeEach(async ({page, request, baseURL}, testInfo) => {
  if (!baseURL) throw new Error('DTS_BROWSER_BASE_URL is required for execution; --list only collects tests.');
  // Bind the target to the checked-out assets instead of trusting its version label.
  const hashes = {};
  for (const name of assets) {
    const response = await request.get(new URL(name, baseURL).href, {maxRedirects: 0});
    expect(response.status(), name).toBe(200);
    const expected = digest(readFileSync(file(name)));
    expect(digest(await response.body()), `${name}: target differs from checkout`).toBe(expected);
    hashes[name] = expected;
  }
  await testInfo.attach('source-hashes', {body: Buffer.from(JSON.stringify(hashes, null, 2)), contentType: 'application/json'});
  await page.goto(baseURL);
  await expect(page.locator('#source')).toHaveValue(legacy.review.from);
  // The count is hidden on the initial view; this also waits for initialize().
  await expect(page.locator('#test-count')).toHaveText(validation.passed + ' passed');
});

test('readiness describes the partial parser and all views render', async ({page}, testInfo) => {
  for (const name of ['prepare', 'review', 'verify', 'squads', 'readiness']) {
    await view(page, name);
    await capture(page, testInfo, name);
  }
  await expect(page.locator('.version-line')).toContainText('v0.3.0');
  await expect(page.locator('#readiness-view')).toContainText('No hardware development');
  await expect(page.locator('#readiness-view')).toContainText('M1 partial');
  await expect(page.locator('#readiness-view')).toContainText('trusted device review and approval are still pending');
  await expect(page.locator('#test-description')).toHaveText(`${validation.failed} failed · ${validation.recordedAt.slice(0, 10)}`);
});

for (const name of ['fixture', 'nonce-fixture']) {
  test(`${name}: file import, signature verification and downloaded report`, async ({page}, testInfo) => {
    const packet = await importSession(page, name + '-session.json');
    await capture(page, testInfo, 'imported-session');
    await importResult(page, 'policy-' + name + '-result.json');
    await expect(page.locator('#verify-state')).toHaveText('VERIFIED');
    await expect(page.locator('#verified-details')).toContainText(packet.messageSha256);
    const report = await downloadJson(page, '#download-report', testInfo, 'verification.json');
    expect(report.verified).toBe(true);
    expect(report.environment).toBe('public-fixture-only');
    expect(report.messageSha256).toBe(packet.messageSha256);
    expect(report.messageSha512).toBe(packet.messageSha512);
    expect(report.review).toEqual(packet.review);
    expect(report.signatureHex).toBe(json('policy-' + name + '-result.json').recordHex.slice(88, 216));
    expect(report.limitations).toContain('No trusted device review or authorization');
    expect(report).not.toHaveProperty('evidence');
    expect(report).not.toHaveProperty('firmwareParser');
    expect(report).not.toHaveProperty('hardwareMeasured');
    await capture(page, testInfo, 'verified-result');
  });
}

test('a mismatched result clears the previous successful result', async ({page}, testInfo) => {
  await importSession(page, 'nonce-fixture-session.json');
  await importResult(page, 'policy-nonce-fixture-result.json');
  await expect(page.locator('#verify-state')).toHaveText('VERIFIED');
  await importResult(page, 'policy-fixture-result.json');
  await expect(page.locator('#verify-state')).toHaveText('REJECTED');
  await expect(page.locator('#verify-error')).toHaveText('This result belongs to a different session.');
  await expect(page.locator('#verify-success')).toBeHidden();
  await expect(page.locator('#download-report')).toBeHidden();
  await capture(page, testInfo, 'cross-session-rejection');
});

test('export requires all recipient pages and acknowledgement', async ({page}, testInfo) => {
  await importSession(page, 'fixture-session.json');
  await expect(page.locator('#export-session')).toBeDisabled();
  await expect(page.locator('#review-ack')).toBeDisabled();
  // Four source pages precede the four recipient pages.
  for (let i = 0; i < 4; i++) {
    await expect(page.locator('#page-title')).toHaveText('Source address');
    await expect(page.locator('#export-session')).toBeDisabled();
    await page.locator('#next-page').click();
  }
  for (let i = 1; i <= 4; i++) {
    await expect(page.locator('#page-title')).toHaveText('Recipient address');
    await expect(page.locator('#recipient-progress')).toHaveText(`Recipient review: ${i} / 4 pages visited.`);
    await expect(page.locator('#export-session')).toBeDisabled();
    if (i < 4) {
      await expect(page.locator('#review-ack')).toBeDisabled();
      await page.locator('#next-page').click();
    }
  }
  await expect(page.locator('#review-ack')).toBeEnabled();
  await page.locator('#review-ack').check();
  await expect(page.locator('#export-session')).toBeEnabled();
  const exported = await downloadJson(page, '#export-session', testInfo, 'session.json');
  expect(exported).toEqual(legacy);
  await capture(page, testInfo, 'reviewed-session');
});

test('editing clears verification and resets review before another session', async ({page}, testInfo) => {
  await importSession(page, 'fixture-session.json');
  await importResult(page, 'policy-fixture-result.json');
  await expect(page.locator('#verify-state')).toHaveText('VERIFIED');
  await view(page, 'prepare');
  await page.locator('#amount').fill('0.000006');
  await view(page, 'verify');
  await expect(page.locator('#verify-state')).toHaveText('AWAITING RESULT');
  await expect(page.locator('#download-report')).toBeHidden();
  await view(page, 'review');
  await expect(page.locator('#review-empty')).toBeVisible();
  await view(page, 'prepare');
  await page.locator('#recipient').fill(legacy.review.recipient);
  await page.locator('input[name="format"][value="legacy"]').check();
  await page.locator('#prepare-button').click();
  await expect(page.locator('#decoded')).toContainText('0.000006 SOL');
  await expect(page.locator('#recipient-progress')).toHaveText('Recipient review: 0 / 4 pages visited.');
  await expect(page.locator('#review-ack')).not.toBeChecked();
  await expect(page.locator('#review-ack')).toBeDisabled();
  await expect(page.locator('#export-session')).toBeDisabled();
  await importResult(page, 'policy-fixture-result.json');
  await expect(page.locator('#verify-state')).toHaveText('REJECTED');
  await expect(page.locator('#download-report')).toBeHidden();
  await capture(page, testInfo, 'edited-session-rejection');
});

test('a modified signature cannot retain a successful verification', async ({page}, testInfo) => {
  await importSession(page, 'fixture-session.json');
  await importResult(page, 'policy-fixture-result.json');
  await expect(page.locator('#verify-state')).toHaveText('VERIFIED');
  const changed = json('policy-fixture-result.json');
  const bytes = Buffer.from(changed.recordHex, 'hex');
  bytes[44] ^= 1;
  changed.recordHex = bytes.toString('hex');
  await chooseFile(page, '#import-result', {name: 'modified-result.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(changed))});
  await expect(page.locator('#verify-state')).toHaveText('REJECTED');
  await expect(page.locator('#verify-error')).toHaveText('Result CRC does not match.');
  await expect(page.locator('#download-report')).toBeHidden();
  await capture(page, testInfo, 'modified-record-rejection');
});

test('a malformed replacement session invalidates the previous one', async ({page}, testInfo) => {
  await importSession(page, 'fixture-session.json');
  await importResult(page, 'policy-fixture-result.json');
  await expect(page.locator('#verify-state')).toHaveText('VERIFIED');
  await view(page, 'review');
  await chooseFile(page, '#import-session', {name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{')});
  await expect(page.locator('#toast')).toHaveText('Session rejected: The selected file is not valid JSON.');
  await expect(page.locator('#review-empty')).toBeVisible();
  await view(page, 'verify');
  await expect(page.locator('#verify-state')).toHaveText('AWAITING RESULT');
  await expect(page.locator('#download-report')).toBeHidden();
  await capture(page, testInfo, 'malformed-session-invalidation');
});

test('a malformed result is rejected and clears the previous verified report', async ({page}, testInfo) => {
  await importSession(page, 'fixture-session.json');
  await importResult(page, 'policy-fixture-result.json');
  await expect(page.locator('#verify-state')).toHaveText('VERIFIED');
  await chooseFile(page, '#import-result', {name: 'invalid-result.json', mimeType: 'application/json', buffer: Buffer.from('{')});
  await expect(page.locator('#verify-state')).toHaveText('REJECTED');
  await expect(page.locator('#verify-error')).toHaveText('The selected file is not valid JSON.');
  await expect(page.locator('#verify-success')).toBeHidden();
  await expect(page.locator('#download-report')).toBeHidden();
  await capture(page, testInfo, 'malformed-result-rejection');
});

async function loadSquads(page) {
  await view(page,'squads');
  await page.locator('#squads-example').click();
  await expect(page.locator('#squads-result')).toBeVisible();
  await expect(page.locator('#squads-size')).toContainText('487 message bytes');
}

test('Squads draft exports reviewed bytes and imports with full decoded intent',async({page},testInfo)=>{
  await loadSquads(page);
  await expect(page.locator('#squads-decoded')).toContainText(squadsExample().recipient);
  await expect(page.locator('#squads-export')).toBeDisabled();
  await page.locator('#squads-ack').check();
  const packet=await downloadJson(page,'#squads-export',testInfo,'squads-draft.json');
  expect(validateSquadsDraft(packet)).toEqual(packet);
  expect(packet.status).toBe('UNSIGNED_DRAFT');
  expect(packet.review.transactionIndex).toBe('1');
  expect(packet).not.toHaveProperty('signature');
  await capture(page,testInfo,'squads-reviewed-draft');
  await page.locator('#sq-amountSol').fill('0.000006');
  await expect(page.locator('#squads-result')).toBeHidden();
  await chooseFile(page,'#squads-import',{name:'draft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(packet))});
  await expect(page.locator('#squads-result')).toBeVisible();
  await expect(page.locator('#sq-amountSol')).toHaveValue('0.000005');
  await expect(page.locator('#squads-ack')).not.toBeChecked();
  await expect(page.locator('#squads-export')).toBeDisabled();
});

test('Squads input changes invalidate the draft and reject invalid amounts',async({page},testInfo)=>{
  await loadSquads(page);await page.locator('#squads-ack').check();
  await page.locator('#sq-amountSol').fill('0');
  await expect(page.locator('#squads-result')).toBeHidden();
  await expect(page.locator('#squads-empty')).toBeVisible();
  await page.getByRole('button',{name:'Build & inspect draft'}).click();
  await expect(page.locator('#squads-error')).toContainText('Amount must be positive');
  await expect(page.locator('#squads-export')).toBeDisabled();
  await capture(page,testInfo,'squads-invalid-amount');
});

test('Squads stale index or nonce blocks reuse while matching is explicitly unverified',async({page},testInfo)=>{
  await loadSquads(page);
  await page.getByRole('button',{name:'Compare values',exact:true}).click();
  await expect(page.locator('#squads-comparison')).toContainText('VALUES MATCH');
  await expect(page.locator('#squads-comparison')).toContainText('No on-chain state');
  await page.locator('#squads-ack').check();
  await page.locator('#sq-compare-index').fill('1');
  await page.getByRole('button',{name:'Compare values',exact:true}).click();
  await expect(page.locator('#squads-comparison')).toContainText('REBUILD REQUIRED');
  await expect(page.locator('#squads-export')).toBeDisabled();
  await page.locator('#squads-ack').check();
  await expect(page.locator('#squads-export')).toBeDisabled();
  await page.locator('#sq-compare-index').fill('0');
  await page.getByRole('button',{name:'Compare values',exact:true}).click();
  await expect(page.locator('#squads-comparison')).toContainText('mismatch was already detected');
  await expect(page.locator('#squads-export')).toBeDisabled();
  await loadSquads(page);
  await page.locator('#sq-compare-nonce').fill(squadsExample().recipient);
  await page.getByRole('button',{name:'Compare values',exact:true}).click();
  await expect(page.locator('#squads-comparison')).toContainText('nonce value changed');
  await capture(page,testInfo,'squads-stale-state');
  await loadSquads(page);await page.locator('#squads-ack').check();
  await page.locator('#sq-compare-index').fill('9007199254740991');
  await page.getByRole('button',{name:'Compare values',exact:true}).click();
  await expect(page.locator('#squads-comparison')).toContainText('exceeds the supported range');
  await expect(page.locator('#squads-export')).toBeDisabled();
  await page.locator('#squads-ack').check();
  await expect(page.locator('#squads-export')).toBeDisabled();
});

test('Squads tampered or malformed imports clear the previous review',async({page},testInfo)=>{
  await loadSquads(page);await page.locator('#squads-ack').check();
  const packet=await downloadJson(page,'#squads-export',testInfo,'squads-for-tamper.json');
  packet.review.recipient=squadsExample().member;
  await chooseFile(page,'#squads-import',{name:'tampered.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(packet))});
  await expect(page.locator('#squads-error')).toContainText('does not match the decoded message');
  await expect(page.locator('#squads-result')).toBeHidden();
  await expect(page.locator('#squads-export')).toBeDisabled();
  await loadSquads(page);
  await chooseFile(page,'#squads-import',{name:'malformed.json',mimeType:'application/json',buffer:Buffer.from('{')});
  await expect(page.locator('#squads-error')).toContainText('not valid JSON');
  await expect(page.locator('#squads-result')).toBeHidden();
  await capture(page,testInfo,'squads-rejected-import');
});
