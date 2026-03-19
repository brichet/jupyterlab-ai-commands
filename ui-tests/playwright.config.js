/**
 * Configuration for Playwright using default from @jupyterlab/galata
 */
const baseConfig = require('@jupyterlab/galata/lib/playwright-config');

const host = process.env.JL_UI_TEST_HOST || '127.0.0.1';
const port = process.env.JL_UI_TEST_PORT || '8888';
const targetUrl = process.env.TARGET_URL || `http://${host}:${port}`;
const labUrl = targetUrl.endsWith('/lab') ? targetUrl : `${targetUrl}/lab`;

module.exports = {
  ...baseConfig,
  webServer: {
    command: 'jlpm start',
    url: labUrl,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI
  }
};
