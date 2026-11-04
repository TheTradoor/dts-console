import {defineConfig} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const baseURL = process.env.DTS_BROWSER_BASE_URL;
if (baseURL) {
  const target = new URL(baseURL);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash) {
    throw new Error('DTS_BROWSER_BASE_URL must be an HTTP(S) application URL without credentials, query or fragment.');
  }
  if (!target.pathname.endsWith('/')) throw new Error('DTS_BROWSER_BASE_URL must end with a slash.');
}
let commit = null, sourceDirty = null;
try {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {encoding: 'utf8'}).trim();
  if (realpathSync(root) === realpathSync(fileURLToPath(new URL('.', import.meta.url)))) {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
    sourceDirty = execFileSync('git', ['status', '--porcelain'], {encoding: 'utf8'}).trim().length > 0;
  }
} catch {}

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.mjs',
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  globalTimeout: 600000,
  expect: {timeout: 5000},
  outputDir: 'artifacts/browser/test-results',
  reporter: [
    ['list'],
    ['json', {outputFile: 'artifacts/browser/results.json'}],
    ['html', {outputFolder: 'artifacts/browser/html', open: 'never'}],
  ],
  metadata: {commit, sourceDirty, scope: 'Public fixtures; browser acceptance only', externalFonts: 'disabled'},
  use: {
    baseURL,
    browserName: 'chromium',
    acceptDownloads: true,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {name: 'chromium-desktop', use: {viewport: {width: 1440, height: 1000}}},
    {name: 'chromium-mobile-viewport', use: {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}},
  ],
});
