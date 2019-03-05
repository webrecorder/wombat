const cp = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const readline = require('readline');
const criHelper = require('chrome-remote-interface-extra/lib/helper');

const CHROME_PROFILE_PATH = path.join(os.tmpdir(), 'temp_chrome_profile-');
const winPos = !process.env.NO_MOVE_WINDOW ? '--window-position=2000,0' : '';

const chromeArgs = userDataDir => [
  '--enable-automation',
  '--force-color-profile=srgb',
  '--remote-debugging-port=9222',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-ipc-flooding-protection',
  '--enable-features=NetworkService,NetworkServiceInProcess',
  '--disable-client-side-phishing-detection',
  '--disable-default-apps',
  '--disable-extensions',
  '--disable-popup-blocking',
  '--disable-hang-monitor',
  '--disable-prompt-on-repost',
  '--disable-sync',
  '--disable-domain-reliability',
  '--disable-infobars',
  '--disable-features=site-per-process,TranslateUI',
  '--disable-breakpad',
  '--disable-backing-store-limit',
  '--metrics-recording-only',
  '--no-first-run',
  '--safebrowsing-disable-auto-update',
  '--password-store=basic',
  '--use-mock-keychain',
  '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
  `--user-data-dir=${userDataDir}`,
  winPos,
  'about:blank'
];

/**
 * @type {RegExp}
 */
const nlre = /\r?\n/;
/**
 * @type {RegExp}
 */
const desktopArgRE = /(^[^ ]+).*/;

/**
 * @desc Executes the supplied command
 * @param {string} someCommand
 * @param {boolean} [rejectOnError = false]
 * @returns {Promise<string>}
 */
function exec(someCommand, rejectOnError = false) {
  return new Promise((resolve, reject) => {
    cp.exec(someCommand, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error && rejectOnError) reject(error);
      resolve(stdout.trim());
    });
  });
}

/**
 * @desc Executes the which command for the supplied executable name
 * @param {string} executable
 */
function which(executable) {
  return exec(`which ${executable}`);
}

/**
 * @desc Executes the ls command for the supplied path looking for .desktop files for Chrome or Chromium
 * @param {string} desktopPath
 * @returns {Promise<string[]>}
 */
function chromeDesktops(desktopPath) {
  // eslint-disable-next-line
  return exec(
    `ls ${desktopPath} | grep -E "\/.*\/(google|chrome|chromium)-.*"`
  ).then(results => results.split(nlre));
}

/**
 * @desc Extracts the Chrome or Chromium executable path from the .desktop file
 * @param {string} desktopPath
 * @returns {Promise<string[]>}
 */
async function desktopExePath(desktopPath) {
  let maybeResults;
  // eslint-disable-next-line
  const patternPipe = `"^Exec=\/.*\/(google|chrome|chromium)-.*" ${desktopPath} | awk -F '=' '{print $2}'`;
  try {
    maybeResults = await exec(`grep -ER ${patternPipe}`, true);
  } catch (e) {
    maybeResults = await exec(`grep -Er ${patternPipe}`);
  }
  const seen = new Set();
  let keep;
  return maybeResults
    .split(nlre)
    .map(execPath => execPath.replace(desktopArgRE, '$1'))
    .filter(exePath => {
      keep = !seen.has(exePath);
      seen.add(exePath);
      return keep;
    });
}

/**
 * @desc Tests (T|F) to see if the execPath is executable by this process
 * @param {string} execPath - The executable path to test
 * @returns {Promise<boolean>}
 */
async function bingo(execPath) {
  if (!execPath || execPath === '') return false;
  try {
    await fs.access(execPath, fs.constants.X_OK);
    return true;
  } catch (e) {
    return false;
  }
}

// thanks Squidwarc
async function findChrome() {
  const execs = [
    'google-chrome-unstable',
    'google-chrome-beta',
    'google-chrome-stable',
    'chromium-browser',
    'chromium'
  ];
  let i = 0;
  let len = execs.length;
  let commandResults;
  // check which exec first
  for (; i < len; ++i) {
    commandResults = await which(execs[i]);
    if (await bingo(commandResults)) {
      return commandResults;
    }
  }
  // which executable did not result in an exe so we must now check desktop files
  const desktops = [
    '/usr/share/applications/*.desktop',
    '~/.local/share/applications/*.desktop'
  ];
  len = desktops.length;
  let len2;
  let j = 0;
  i = 0;
  let found = [];
  for (; i < len; ++i) {
    commandResults = await chromeDesktops(desktops[i]);
    len2 = commandResults.length;
    for (j = 0; j < len2; ++j) {
      found = found.concat(await desktopExePath(commandResults[j]));
    }
  }
  const desiredExes = [
    { regex: /google-chrome-unstable$/, weight: 52 },
    { regex: /google-chrome-beta$/, weight: 51 },
    { regex: /google-chrome-stable$/, weight: 50 },
    { regex: /google-chrome$/, weight: 49 },
    { regex: /chrome-wrapper$/, weight: 48 },
    { regex: /chromium-browser$/, weight: 47 },
    { regex: /chromium$/, weight: 46 }
  ];
  let sortedExes = found
    .map(exep => {
      for (const desired of desiredExes) {
        if (desired.regex.test(exep)) {
          return { exep, weight: desired.weight };
        }
      }
      return { exep, weight: 10 };
    })
    .sort((a, b) => b.weight - a.weight)
    .map(pair => pair.exep);
  if (sortedExes.length > 0) {
    return sortedExes[0];
  }
  throw new Error('No Chrome Installations Found');
}

/**
 *
 * @return {Promise<{chromeProcess: ChildProcess, killChrome: function(): void}>}
 */
async function initChrome() {
  const executable = await findChrome();
  const userDataDir = await fs.mkdtemp(CHROME_PROFILE_PATH);
  const chromeArguments = chromeArgs(userDataDir);
  const chromeProcess = cp.spawn(executable, chromeArguments, {
    stdio: ['ignore', 'ignore', 'pipe'],
    env: process.env,
    detached: process.platform !== 'win32'
  });

  const maybeRemoveUDataDir = () => {
    try {
      fs.removeSync(userDataDir);
    } catch (e) {}
  };

  let killed = false;

  const killChrome = () => {
    if (killed) {
      return;
    }
    killed = true;
    chromeProcess.kill('SIGKILL');
    // process.kill(-chromeProcess.pid, 'SIGKILL')
    maybeRemoveUDataDir();
  };

  process.on('exit', killChrome);
  chromeProcess.once('exit', maybeRemoveUDataDir);

  process.on('SIGINT', () => {
    killChrome();
    process.exit(130);
  });
  process.once('SIGTERM', killChrome);
  process.once('SIGHUP', killChrome);
  await waitForWSEndpoint(chromeProcess, 15 * 1000);
  return { chromeProcess, killChrome };
}

module.exports = initChrome;

// module.exports = initChrome
function waitForWSEndpoint(chromeProcess, timeout) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: chromeProcess.stderr });
    let stderr = '';
    const listeners = [
      criHelper.helper.addEventListener(rl, 'line', onLine),
      criHelper.helper.addEventListener(rl, 'close', onClose),
      criHelper.helper.addEventListener(chromeProcess, 'exit', onClose),
      criHelper.helper.addEventListener(chromeProcess, 'error', onClose)
    ];
    const timeoutId = timeout ? setTimeout(onTimeout, timeout) : 0;

    function onClose() {
      cleanup();
      reject(new Error(['Failed to launch chrome!', stderr].join('\n')));
    }

    function onTimeout() {
      cleanup();
      reject(
        new Error(
          `Timed out after ${timeout} ms while trying to connect to Chrome!`
        )
      );
    }

    /**
     * @param {string} line
     */
    function onLine(line) {
      stderr += line + '\n';
      const match = line.match(/^DevTools listening on (ws:\/\/.*)$/);
      if (!match) {
        return;
      }
      cleanup();
      resolve(match[1]);
    }

    function cleanup() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      criHelper.helper.removeEventListeners(listeners);
      rl.close();
    }
  });
}
