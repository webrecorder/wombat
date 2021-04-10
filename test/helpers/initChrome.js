const { launch } = require('chrome-launcher');
const { CRIExtra, Browser } = require('chrome-remote-interface-extra')

const winPos = !process.env.NO_MOVE_WINDOW ? '--window-position=2000,0' : '';

const chromeArgs = [
  '--force-color-profile=srgb',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-ipc-flooding-protection',
  '--enable-features=NetworkService,NetworkServiceInProcess,AwaitOptimization',
  '--disable-client-side-phishing-detection',
  '--disable-default-apps',
  '--disable-extensions',
  '--disable-popup-blocking',
  '--disable-hang-monitor',
  '--disable-prompt-on-repost',
  '--disable-sync',
  '--disable-domain-reliability',
  '--disable-infobars',
  '--disable-features=site-per-process,TranslateUI,BlinkGenPropertyTrees,LazyFrameLoading',
  '--disable-breakpad',
  '--disable-backing-store-limit',
  '--metrics-recording-only',
  '--no-first-run',
  '--safebrowsing-disable-auto-update',
  '--password-store=basic',
  '--use-mock-keychain',
  '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
  winPos,
];

/**
 *
 * @return {Promise<Browser>}
 */
async function initChrome() {
  const chrome = await launch({
    chromeFlags: chromeArgs
  });
  const client = await CRIExtra({ host: 'localhost', port: chrome.port });
  const browser = await Browser.create(client, {
    ignoreHTTPSErrors: true,
    additionalDomains: { workers: true },
    process: chrome.process,
    closeCallback: () => chrome.kill(),
  });
  await browser.waitForTarget(t => t.type() === 'page');
  return browser;
}

module.exports = initChrome;
