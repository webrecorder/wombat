import test from 'ava';
import * as utils from './helpers/utils';
import * as testedChanges from './helpers/testedValues';
import TestHelper from './helpers/testHelper';

/**
 * @type {TestHelper}
 */
let helper = null;

test.before(async t => {
  helper = await TestHelper.init(t);
  await helper.initWombat();
});

test.beforeEach(async t => {
  t.context.sandbox = helper.sandbox();
  t.context.server = helper.server();
  t.context.testPage = helper.testPage();
});

test.after.always(async t => {
  await helper.stop();
});

test('The actual top should have been sent the loadMSG', async t => {
  t.true(
    await t.context.testPage.evaluate(() => window.wbMessages.load),
    'The message sent by wombat to inform top it has loaded should have been sent'
  );
});

test('init_top_frame: should set __WB_replay_top correctly', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => window.__WB_replay_top === window),
    'The replay top should equal to frames window object'
  );
});

test('init_top_frame: should set __WB_orig_parent correctly', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => window.__WB_orig_parent === window.top),
    '__WB_orig_parent should equal the actual top'
  );
});

test('init_top_frame: should set parent to itself (__WB_replay_top)', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => window.parent === window.__WB_replay_top),
    'window.parent should equal to itself (__WB_replay_top)'
  );
});

test('WombatLocation: should be added to window as WB_wombat_location', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => window.WB_wombat_location != null),
    'WB_wombat_location was not added to window'
  );
});

testedChanges.URLParts.forEach(part => {
  test(`WombatLocation: should make available '${part}'`, async t => {
    const { sandbox, server } = t.context;
    t.true(
      await sandbox.evaluate(
        upart =>
          new URL(window.wbinfo.url)[upart] ===
          window.WB_wombat_location[upart],
        part
      ),
      `WB_wombat_location does not make available '${part}'`
    );
  });
});

test('WombatLocation: should return the href property as the value for toString', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(
      () => window.WB_wombat_location.toString() === window.wbinfo.url
    ),
    `WB_wombat_location does not return the href property as the value for toString`
  );
});

test('WombatLocation: should return itself as the value for valueOf', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(
      () => window.WB_wombat_location.valueOf() === window.WB_wombat_location
    ),
    `WB_wombat_location does not return itself as the value for valueOf`
  );
});

test('WombatLocation: should have a Symbol.toStringTag value of "Location"', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(
      () =>
        window.WB_wombat_location[window.Symbol.toStringTag] ===
        location[window.Symbol.toStringTag]
    ),
    `WB_wombat_location does not have a Symbol.toStringTag value of "Location"`
  );
});

test('WombatLocation browser navigation control: should rewrite Location.replace usage', async t => {
  const { sandbox, server } = t.context;
  const [navigationResponse] = await Promise.all([
    sandbox.waitForNavigation(),
    sandbox.evaluate(() => {
      window.WB_wombat_location.replace('/it');
    })
  ]);
  t.is(
    navigationResponse.url(),
    `${testedChanges.WB_PREFIX}mp_/https://tests.wombat.io/it`,
    'using WB_wombat_location.replace did not navigate the page'
  );
});

test('WombatLocation browser navigation control: should rewrite Location.assign usage', async t => {
  const { sandbox, server } = t.context;
  const [navigationResponse] = await Promise.all([
    sandbox.waitForNavigation(),
    sandbox.evaluate(() => {
      window.WB_wombat_location.assign('/it');
    })
  ]);
  t.is(
    navigationResponse.url(),
    `${testedChanges.WB_PREFIX}mp_/https://tests.wombat.io/it`,
    'using WB_wombat_location.assign did not navigate the page'
  );
});

test('WombatLocation browser navigation control: should reload the page via Location.reload usage', async t => {
  const { sandbox, server } = t.context;
  const [originalLoc, navigationResponse] = await Promise.all([
    sandbox.evaluate(() => window.location.href),
    sandbox.waitForNavigation(),
    sandbox.evaluate(() => {
      window.WB_wombat_location.reload();
    })
  ]);
  t.is(
    navigationResponse.url(),
    originalLoc,
    'using WB_wombat_location.reload did not reload the page'
  );
});

test('browser history control: should rewrite history.pushState', async t => {
  const { sandbox, server } = t.context;
  const [originalLoc, newloc] = await Promise.all([
    sandbox.evaluate(() => window.location.href),
    sandbox.evaluate(() => {
      window.history.pushState(null, null, '/it');
      return window.location.href;
    })
  ]);
  t.is(
    newloc,
    `${originalLoc}it`,
    'history navigations using pushState are not rewritten'
  );
  t.true(
    await sandbox.evaluate(
      () => window.WB_wombat_location.href === 'https://tests.wombat.io/it'
    ),
    'WB_wombat_location.href does not update after history.pushState usage'
  );
});

test('browser history control: should rewrite history.replaceState', async t => {
  const { sandbox, server } = t.context;
  const [originalLoc, newloc] = await Promise.all([
    sandbox.evaluate(() => window.location.href),
    sandbox.evaluate(() => {
      window.history.replaceState(null, null, '/it2');
      return window.location.href;
    })
  ]);
  t.is(
    newloc,
    `${originalLoc}it2`,
    'history navigations using pushState are not rewritten'
  );
  t.true(
    await sandbox.evaluate(
      () => window.WB_wombat_location.href === 'https://tests.wombat.io/it2'
    ),
    'WB_wombat_location.href does not update after history.replaceState usage'
  );
});

test('browser history control: should send the "replace-url" msg to the top frame on history.pushState usage', async t => {
  const { sandbox, testPage } = t.context;
  await sandbox.evaluate(() => window.history.pushState(null, null, '/it3'));
  t.true(
    await testPage.evaluate(
      () =>
        window.wbMessages['replace-url'].url != null &&
        window.wbMessages['replace-url'].url === 'https://tests.wombat.io/it3'
    ),
    'the "replace-url" message was not sent to the top frame on history.pushState usage'
  );
});

test('browser history control: should send the "replace-url" msg to the top frame on history.replaceState usage', async t => {
  const { sandbox, testPage } = t.context;
  await sandbox.evaluate(() => window.history.replaceState(null, null, '/it4'));
  t.true(
    await testPage.evaluate(
      () =>
        window.wbMessages['replace-url'].url != null &&
        window.wbMessages['replace-url'].url === 'https://tests.wombat.io/it4'
    ),
    'the "replace-url" message was not sent to the top frame on history.pushState usage'
  );
});

test('document.title: should send the "title" messasge to the top frame when document.title is changed', async t => {
  const { sandbox, testPage } = t.context;
  await sandbox.evaluate(() => (document.title = 'abc'));
  t.true(
    await testPage.evaluate(
      () => window.wbMessages.tile != null && window.wbMessages.tile === 'abc'
    ),
    'the "title" message was not sent to the top frame on document.title changes'
  );
});

test('document.write: should not perform rewriting when "write" is called with no arguments', async t => {
  const { sandbox, testPage } = t.context;
  await sandbox.evaluate(() => document.write());
  t.true(
    await sandbox.evaluate(() => document.documentElement == null),
    'this use case failed'
  );
});

test('document.write: should perform rewriting when "write" is called with one argument', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(expectedURL => {
      document.write('<a id="it" href="http://example.com">hi</a>');
      const elem = document.getElementById('it');
      if (!elem) return false;
      elem._no_rewrite = true;
      return elem.href === expectedURL;
    }, `${testedChanges.WB_PREFIX}mp_/http://example.com`),
    'wombat is not rewriting elements when document.write is used'
  );
});

test('document.write: should perform rewriting when "write" is called with multiple arguments', async t => {
  const { sandbox, server } = t.context;
  t.deepEqual(
    await sandbox.evaluate(expectedURL => {
      document.write(
        '<a id="it" href="http://example.com">hi</a>',
        '<a id="it2" href="http://example.com">hi</a>'
      );
      const results = {
        it: { exists: false, rewritten: false },
        it2: { exists: false, rewritten: false }
      };
      const it = document.getElementById('it');
      if (!it) return results;
      results.it.exists = true;
      it._no_rewrite = true;
      results.it.rewritten = it.href === expectedURL;
      const it2 = document.getElementById('it2');
      if (!it2) return results;
      results.it2.exists = true;
      it2._no_rewrite = true;
      results.it2.rewritten = it.href === expectedURL;
      return results;
    }, `${testedChanges.WB_PREFIX}mp_/http://example.com`),
    {
      it: { exists: true, rewritten: true },
      it2: { exists: true, rewritten: true }
    },
    'wombat is not rewriting elements when document.write is used with multiple values'
  );
});

test('document.write: should perform rewriting when "write" is called with a full string of HTML starting with <!doctype html>', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => {
      const unRW = `<!DOCTYPE html><html><head><link id="theLink" rel="stylesheet" href="https://cssHeaven.com/angelic.css"/></head><body><script id="theScript" src="http://javaScript.com/script.js"></script></body></html>`;
      const expectedRW = `<html><head><link id="theLink" rel="stylesheet" href="https://localhost:3030/live/20180803160549cs_/https://cssHeaven.com/angelic.css"></head><body><script id="theScript" src="https://localhost:3030/live/20180803160549js_/http://javaScript.com/script.js"></script></body></html>`;
      document.write(unRW);
      document.documentElement._no_rewrite = true;
      return document.documentElement.outerHTML === expectedRW;
    }),
    'wombat is not rewriting elements when document.write is used with full strings of html with <!doctype html>'
  );
});

test('document.write: should perform rewriting when "write" is called with a full string of HTML starting with <html>', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => {
      const unRW = `<html><head><link id="theLink" rel="stylesheet" href="https://cssHeaven.com/angelic.css"/></head><body><script id="theScript" src="http://javaScript.com/script.js"></script></body></html>`;
      const expectedRW = `<html><head><link id="theLink" rel="stylesheet" href="https://localhost:3030/live/20180803160549cs_/https://cssHeaven.com/angelic.css"></head><body><script id="theScript" src="https://localhost:3030/live/20180803160549js_/http://javaScript.com/script.js"></script></body></html>`;
      document.write(unRW);
      document.documentElement._no_rewrite = true;
      return document.documentElement.outerHTML === expectedRW;
    }),
    'wombat is not rewriting elements when document.write is used with full strings of html with <html>'
  );
});

test('document.write: should perform rewriting when "write" is called with a full string of HTML starting with <head>', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => {
      const unRW = `<head><link id="theLink" rel="stylesheet" href="https://cssHeaven.com/angelic.css"/></head><body><script id="theScript" src="http://javaScript.com/script.js"></script></body>`;
      const expectedRW = `<head><link id="theLink" rel="stylesheet" href="https://localhost:3030/live/20180803160549cs_/https://cssHeaven.com/angelic.css"></head><body><script id="theScript" src="https://localhost:3030/live/20180803160549js_/http://javaScript.com/script.js"></script></body>`;
      document.write(unRW);
      document.documentElement._no_rewrite = true;
      return document.documentElement.outerHTML === expectedRW;
    }),
    'wombat is not rewriting elements when document.write is used with full strings of html with <head>'
  );
});

test('document.write: should perform rewriting when "write" is called with a full string of HTML starting with <body>', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => {
      const unRW = `<body><script id="theScript" src="http://javaScript.com/script.js"></script></body>`;
      const expectedRW = `<body><script id="theScript" src="https://localhost:3030/live/20180803160549js_/http://javaScript.com/script.js"></script></body>`;
      document.write(unRW);
      document.documentElement._no_rewrite = true;
      return document.documentElement.outerHTML === expectedRW;
    }),
    'wombat is not rewriting elements when document.write is used with full strings of html with <body>'
  );
});

test('document.writeln: should not perform rewriting when "writeln" is called with no arguments', async t => {
  const { sandbox, server } = t.context;
  await sandbox.evaluate(() => document.writeln());
  t.true(
    await sandbox.evaluate(() => document.documentElement == null),
    'this use case failed'
  );
});

test('document.writeln: should perform rewriting when "writeln" is called with one argument', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(expectedURL => {
      document.writeln('<a id="it" href="http://example.com">hi</a>');
      const elem = document.getElementById('it');
      if (!elem) return false;
      elem._no_rewrite = true;
      return elem.href === expectedURL;
    }, `${testedChanges.WB_PREFIX}mp_/http://example.com\n`),
    'wombat is not rewriting elements when document.writeln is used'
  );
});

test('document.writeln: should perform rewriting when "writeln" is called with multiple arguments', async t => {
  const { sandbox, server } = t.context;
  t.deepEqual(
    await sandbox.evaluate(expectedURL => {
      document.writeln(
        '<a id="it" href="http://example.com">hi</a>',
        '<a id="it2" href="http://example.com">hi</a>'
      );
      const results = {
        it: { exists: false, rewritten: false },
        it2: { exists: false, rewritten: false }
      };
      const it = document.getElementById('it');
      if (!it) return results;
      results.it.exists = true;
      it._no_rewrite = true;
      results.it.rewritten = it.href === expectedURL;
      const it2 = document.getElementById('it2');
      if (!it2) return results;
      results.it2.exists = true;
      it2._no_rewrite = true;
      results.it2.rewritten = it.href === expectedURL;
      return results;
    }, `${testedChanges.WB_PREFIX}mp_/http://example.com`),
    {
      it: { exists: true, rewritten: true },
      it2: { exists: true, rewritten: true }
    },
    'wombat is not rewriting elements when document.write is used with multiple values'
  );
});

test('document.writeln: should perform rewriting when "write" is called with a full string of HTML starting with <!doctype html>', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => {
      const unRW = `<!DOCTYPE html><html><head><link id="theLink" rel="stylesheet" href="https://cssHeaven.com/angelic.css"/></head><body><script id="theScript" src="http://javaScript.com/script.js"></script></body></html>`;
      const expectedRW = `<html><head><link id="theLink" rel="stylesheet" href="https://localhost:3030/live/20180803160549cs_/https://cssHeaven.com/angelic.css"></head><body><script id="theScript" src="https://localhost:3030/live/20180803160549js_/http://javaScript.com/script.js"></script></body></html>\n`;
      document.writeln(unRW);
      document.documentElement._no_rewrite = true;
      return document.documentElement.outerHTML === expectedRW;
    }),
    'wombat is not rewriting elements when document.write is used with full strings of html with <!doctype html>'
  );
});

test('document.writeln: should perform rewriting when "write" is called with a full string of HTML starting with <html>', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => {
      const unRW = `<html><head><link id="theLink" rel="stylesheet" href="https://cssHeaven.com/angelic.css"/></head><body><script id="theScript" src="http://javaScript.com/script.js"></script></body></html>`;
      const expectedRW = `<html><head><link id="theLink" rel="stylesheet" href="https://localhost:3030/live/20180803160549cs_/https://cssHeaven.com/angelic.css"></head><body><script id="theScript" src="https://localhost:3030/live/20180803160549js_/http://javaScript.com/script.js"></script></body></html>\n`;
      document.writeln(unRW);
      document.documentElement._no_rewrite = true;
      return document.documentElement.outerHTML === expectedRW;
    }),
    'wombat is not rewriting elements when document.write is used with full strings of html with <html>'
  );
});

test('document.writeln: should perform rewriting when "write" is called with a full string of HTML starting with <head>', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => {
      const unRW = `<head><link id="theLink" rel="stylesheet" href="https://cssHeaven.com/angelic.css"/></head><body><script id="theScript" src="http://javaScript.com/script.js"></script></body>`;
      const expectedRW = `<head><link id="theLink" rel="stylesheet" href="https://localhost:3030/live/20180803160549cs_/https://cssHeaven.com/angelic.css"></head><body><script id="theScript" src="https://localhost:3030/live/20180803160549js_/http://javaScript.com/script.js"></script></body>\n`;
      document.writeln(unRW);
      document.documentElement._no_rewrite = true;
      return document.documentElement.outerHTML === expectedRW;
    }),
    'wombat is not rewriting elements when document.write is used with full strings of html with <head>'
  );
});

test('document.writeln: should perform rewriting when "write" is called with a full string of HTML starting with <body>', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => {
      const unRW = `<body><script id="theScript" src="http://javaScript.com/script.js"></script></body>`;
      const expectedRW = `<body><script id="theScript" src="https://localhost:3030/live/20180803160549js_/http://javaScript.com/script.js"></script></body>\n`;
      document.writeln(unRW);
      document.documentElement._no_rewrite = true;
      return document.documentElement.outerHTML === expectedRW;
    }),
    'wombat is not rewriting elements when document.write is used with full strings of html with <body>'
  );
});

test('XMLHttpRequest: should rewrite the URL argument of "open"', async t => {
  const { sandbox, server } = t.context;
  const response = await sandbox.evaluate(async () => {
    let reqDone;
    let to;
    const prom = new Promise(resolve => {
      reqDone = resolve;
      to = setTimeout(() => resolve(false), 5000);
    });
    const onLoad = () => {
      clearTimeout(to);
      reqDone(true);
    };
    const xhr = new XMLHttpRequest();
    xhr.addEventListener('load', onLoad);
    xhr.open('GET', '/test');
    xhr.send();
    const loaded = await prom;
    if (!loaded) throw new Error('no reply from server in 5 seconds');
    return JSON.parse(xhr.responseText);
  });
  t.is(response.headers['x-pywb-requested-with'], 'XMLHttpRequest');
  t.is(response.url, '/live/20180803160549mp_/https://tests.wombat.io/test');
});

test('XMLHttpRequest: should rewrite the "responseURL" property', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(async () => {
      let reqDone;
      let to;
      const prom = new Promise(resolve => {
        reqDone = resolve;
        to = setTimeout(() => resolve(false), 5000);
      });
      const onLoad = () => {
        clearTimeout(to);
        reqDone(true);
      };
      const xhr = new XMLHttpRequest();
      xhr.addEventListener('load', onLoad);
      xhr.open('GET', '/test');
      xhr.send();
      const loaded = await prom;
      if (!loaded) throw new Error('no reply from server in 5 seconds');
      return xhr.responseURL === 'https://tests.wombat.io/test';
    })
  );
});

test('fetch: should rewrite the input argument when it is a string (URL)', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(async () => {
      let to;
      let response = await Promise.race([
        fetch('/test'),
        new Promise(resolve => {
          to = setTimeout(() => resolve('timed out'), 5000);
        })
      ]);
      if (response === 'timed out')
        throw new Error('no reply from server in 5 seconds');
      clearTimeout(to);
      const data = await response.json();
      return (
        data.url === '/live/20180803160549mp_/https://tests.wombat.io/test'
      );
    })
  );
});

test('fetch: should rewrite the input argument when it is an Request object', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(async () => {
      let to;
      let response = await Promise.race([
        fetch(
          new Request('/test', {
            method: 'GET'
          })
        ),
        new Promise(resolve => {
          to = setTimeout(() => resolve('timed out'), 5000);
        })
      ]);
      if (response === 'timed out')
        throw new Error('no reply from server in 5 seconds');
      clearTimeout(to);
      const data = await response.json();
      return (
        data.url === '/live/20180803160549mp_/https://tests.wombat.io/test'
      );
    })
  );
});

test('fetch: should rewrite the input argument when it is a object with an href property', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(async () => {
      let to;
      let response = await Promise.race([
        fetch({ href: '/test' }),
        new Promise(resolve => {
          to = setTimeout(() => resolve('timed out'), 5000);
        })
      ]);
      if (response === 'timed out')
        throw new Error('no reply from server in 5 seconds');
      clearTimeout(to);
      const data = await response.json();
      return (
        data.url === '/live/20180803160549mp_/https://tests.wombat.io/test'
      );
    })
  );
});

test('Request: should rewrite the input argument to the constructor when it is a string (URL)', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => {
      const req = new Request('/test', { method: 'GET' });
      return req.url === '/live/20180803160549mp_/https://tests.wombat.io/test';
    })
  );
});

test('Request: should rewrite the input argument to the constructor when it is an object with a url property', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => {
      const req = new Request({ url: '/test' }, { method: 'GET' });
      return req.url === '/live/20180803160549mp_/https://tests.wombat.io/test';
    })
  );
});

test('Audio: should rewrite the URL argument to the constructor', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(
      () =>
        window.top.getElementPropertyAsIs(
          new Audio('https://music.com/music.mp3'),
          'src'
        ) === '/live/20180803160549oe_/https://music.com/music.mp3'
    )
  );
});

test('FontFace: should rewrite the source argument to the constructor', async t => {
  const { sandbox, server } = t.context;
  await Promise.all([
    server.waitForRequest(
      '/live/20180803160549mp_/https://tests.wombat.io/daFont.woff2'
    ),
    sandbox.evaluate(async () => {
      try {
        const ff = new FontFace('DaFont', 'url(daFont.woff2)');
        await ff.load();
      } catch (e) {}
    })
  ]);
  // the server will automatically reject the waitForRequest promise after 15s
  t.pass('URLs used in the construction of FontFaces are rewritten');
});

test('Web Workers: should rewrite the URL argument to the constructor of "Worker"', async t => {
  const { sandbox, server, testPage } = t.context;
  await Promise.all([
    new Promise((resolve, reject) => {
      const to = setTimeout(
        () => reject(new Error('the worker was not started')),
        15000
      );
      testPage.once('workercreated', w => {
        clearTimeout(to);
        resolve();
      });
    }),
    server.waitForRequest(
      '/live/20180803160549wkr_/https://tests.wombat.io/testWorker.js'
    ),
    sandbox.evaluate(() => {
      window.theWorker = new Worker('testWorker.js');
    })
  ]);
  await sandbox.evaluate(() => {
    window.theWorker.terminate();
  });
  t.pass(
    'The worker URL was rewritten when using Worker and is working on the page'
  );
});

test('Web Workers: should have a light override applied', async t => {
  const { sandbox, server, testPage } = t.context;
  const [worker] = await Promise.all([
    new Promise((resolve, reject) => {
      const to = setTimeout(
        () => reject(new Error('the worker was not started')),
        15000
      );
      testPage.once('workercreated', w => {
        clearTimeout(to);
        resolve(w);
      });
    }),
    server.waitForRequest(
      '/live/20180803160549wkr_/https://tests.wombat.io/testWorker.js'
    ),
    sandbox.evaluate(() => {
      window.theWorker = new Worker('testWorker.js');
    })
  ]);
  t.deepEqual(
    await worker
      .evaluate(() => ({
        fetch: self.isFetchOverriden(),
        importScripts: self.isImportScriptsOverriden(),
        open: self.isAjaxRewritten()
      }))
      .then(async results => {
        await sandbox.evaluate(() => {
          window.theWorker.terminate();
        });
        return results;
      }),
    { fetch: true, importScripts: true, open: true },
    'The light web worker overrides were not applied properly'
  );
});

test('Web Workers: should rewrite the URL argument to the constructor of "SharedWorker"', async t => {
  const { sandbox, server, testPage } = t.context;
  await Promise.all([
    server.waitForRequest(
      '/live/20180803160549wkr_/https://tests.wombat.io/testWorker.js'
    ),
    sandbox.evaluate(() => {
      window.theWorker = new SharedWorker('testWorker.js');
    })
  ]);
  await sandbox.evaluate(() => {
    window.theWorker.terminate();
  });
  t.pass(
    'The worker URL was rewritten when using SharedWorker and is working on the page'
  );
});

test('Service Worker: should rewrite the URL argument of "navigator.serviceWorker.register"', async t => {
  const { sandbox, server, testPage } = t.context;
  t.true(
    await sandbox.evaluate(async () => {
      const sw = await window.navigator.serviceWorker.register(
        '/testWorker.js'
      );
      await sw.unregister();
      return sw.scope.includes('`mp_/https://tests.wombat.io/');
    }),
    'rewriting of service workers is not correct'
  );
});

testedChanges.TextNodeTest.fnTests.forEach(fn => {
  test(`should rewrite the data argument of "Text.${fn}" when it is a child of a style tag`, async t => {
    const { sandbox, server } = t.context;
    t.true(
      await sandbox.evaluate(
        testFn,
        fn,
        testedChanges.TextNodeTest.theStyle,
        testedChanges.TextNodeTest.theStyleRw,
        true
      )
    );
  });

  test(`should rewrite the data argument of "Text.${fn}" when it is not a child of a style tag`, async t => {
    const { sandbox, server } = t.context;
    t.true(
      await sandbox.evaluate(
        testFn,
        fn,
        testedChanges.TextNodeTest.theStyle,
        testedChanges.TextNodeTest.theStyleRw,
        false
      )
    );
  });

  function testFn(fn, theStyle, theStyleRw, inStyle) {
    const tn = document.createTextNode('');
    const tnParent = document.createElement(inStyle ? 'style' : 'p');
    tnParent.appendChild(tn);
    if (fn === 'insertData') {
      tn[fn](0, theStyle);
    } else if (fn === 'replaceData') {
      tn[fn](0, 0, theStyle);
    } else {
      tn[fn](theStyle);
    }
    const result = tnParent.innerText === inStyle ? theStyle : theStyleRw;
    tnParent.remove();
    return result;
  }
});

testedChanges.HTMLAssign.innerOuterHTML.forEach(aTest => {
  test(`should rewrite assignments to ${aTest.which}`, async t => {
    const { sandbox, server } = t.context;
    t.true(await sandbox.evaluate(testFn, aTest.which, aTest.unrw, aTest.rw));
    function testFn(which, unrw, rw) {
      const div = document.createElement('div');
      document.body.appendChild(div);
      div[aTest.which] = unrw;
      let results;
      if (which === 'outerHTML') {
        const elem = document.getElementById('oHTML');
        elem._no_rewrite = true;
        results = elem.outerHTML === rw;
      } else {
        div._no_rewrite = true;
        results = div.innerHTML === rw;
      }
      div.remove();
      return results;
    }
  });
});

test(`should rewrite assignments to HTMLIframeElement.srcdoc`, async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => {
      const iframe = document.createElement('iframe');
      const unRW = `<html><head><link id="theLink" rel="stylesheet" href="https://cssHeaven.com/angelic.css"/></head><body><script id="theScript" src="http://javaScript.com/script.js"></script></body></html>`;
      const expectedRW = `<html><head><link id="theLink" rel="stylesheet" href="https://localhost:3030/live/20180803160549cs_/https://cssHeaven.com/angelic.css"></head><body><script id="theScript" src="https://localhost:3030/live/20180803160549js_/http://javaScript.com/script.js"></script></body></html>`;
      iframe.srcdoc = unRW;
      return window.top.getElementPropertyAsIs(iframe, 'srcdoc') === expectedRW;
    })
  );
});

test(`should rewrite assignments to HTMLStyleElement.textContent`, async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(
      (theStyle, theStyleRw) => {
        const style = document.createElement('style');
        style.textContent = theStyle;
        return (
          window.top.getElementPropertyAsIs(style, 'textContent') === theStyleRw
        );
      },
      testedChanges.TextNodeTest.theStyle,
      testedChanges.TextNodeTest.theStyleRw
    )
  );
});

['URL', 'documentURI', 'baseURI'].forEach(which => {
  test(`should rewrite retrievals to to document.${which}`, async t => {
    const { sandbox, server } = t.context;
    t.true(
      await sandbox.evaluate(
        whichOne => document[whichOne] === 'https://tests.wombat.io/',
        which
      )
    );
  });
});

test('Element.prototype: should rewrite elements added via "insertAdjacentElement"', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      const a = window.top.document.createElement('a');
      a.href = 'http://example.com';
      a.id = 'aa';
      div.insertAdjacentElement('afterend', a);
      const results = window.top.getElementPropertyAsIs(
        div.nextElementSibling,
        'href'
      );
      div.remove();
      return results.endsWith('mp_/http://example.com');
    })
  );
});

test('Element.prototype: should rewrite strings of html added via "insertAdjacentHTML"', async t => {
  const { sandbox, server } = t.context;
  t.true(
    await sandbox.evaluate(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      div.insertAdjacentHTML(
        'afterend',
        '<a id="aa" href="http://example.com"></a>'
      );
      const results = window.top.getElementPropertyAsIs(
        div.nextElementSibling,
        'href'
      );
      div.remove();
      return results.endsWith('mp_/http://example.com');
    })
  );
});

testedChanges.ElementGetSetAttribute.forEach(aTest => {
  if (aTest.elem === 'link') {
    Object.entries(testedChanges.LinkAsTypes).forEach(([as, mod]) => {
      test(`should un-rewrite the value returned by getAttribute for the href attribute of <link rel="preload" as="${as}">`, async t => {
        const { sandbox, server } = t.context;
        t.true(
          await sandbox.evaluate(
            (theElem, prop, asV, unrw) => {
              const elem = document.createElement(theElem);
              elem.rel = 'preload';
              elem.as = asV;
              elem.setAttribute(prop, unrw);
              return elem.getAttribute(prop) === unrw;
            },
            aTest.elem,
            aTest.prop,
            as,
            aTest.unrw
          )
        );
      });

      test(`should un-rewrite the value returned by getAttribute for the href attribute of <link rel="import" as="${as}">`, async t => {
        const { sandbox, server } = t.context;
        t.true(
          await sandbox.evaluate(
            (theElem, prop, asV, unrw) => {
              const elem = document.createElement(theElem);
              elem.rel = 'import';
              elem.as = asV;
              elem.setAttribute(prop, unrw);
              return elem.getAttribute(prop) === unrw;
            },
            aTest.elem,
            aTest.prop,
            as,
            aTest.unrw
          )
        );
      });

      test(`should rewrite the value set by setAttribute for the href attribute of <link rel="preload" as="${as}">`, async t => {
        const { sandbox, server } = t.context;
        t.true(
          await sandbox.evaluate(
            (theElem, prop, asV, unrw) => {
              const elem = document.createElement(theElem);
              elem.rel = 'preload';
              elem.as = asV;
              elem.setAttribute(prop, unrw);
              return (
                elem.getAttribute(prop) === unrw &&
                window.top.getElementPropertyAsIs(elem, prop) !== unrw
              );
            },
            aTest.elem,
            aTest.prop,
            as,
            aTest.unrw
          )
        );
      });

      test(`should rewrite the value set by setAttribute for the href attribute of <link rel="import" as="${as}">`, async t => {
        const { sandbox, server } = t.context;
        t.true(
          await sandbox.evaluate(
            (theElem, prop, asV, unrw) => {
              const elem = document.createElement(theElem);
              elem.rel = 'import';
              elem.as = asV;
              elem.setAttribute(prop, unrw);
              return window.top.getElementPropertyAsIs(elem, prop) !== unrw;
            },
            aTest.elem,
            aTest.prop,
            as,
            aTest.unrw
          )
        );
      });
    });
  }

  test(`should rewrite the value set by setAttribute for the href attribute of <link rel="stylesheet">`, async t => {
    const { sandbox, server } = t.context;
    t.true(
      await sandbox.evaluate(
        (theElem, prop, asV, unrw) => {
          const elem = document.createElement(theElem);
          elem.rel = 'stylesheet';
          elem.setAttribute(prop, unrw);
          return window.top.getElementPropertyAsIs(elem, prop) !== unrw;
        },
        aTest.elem,
        aTest.prop,
        aTest.unrw
      )
    );
  });

  test(`should un-rewrite the value returned by getAttribute for the href attribute of <link rel="stylesheet">`, async t => {
    const { sandbox, server } = t.context;
    t.true(
      await sandbox.evaluate(
        (theElem, prop, asV, unrw) => {
          const elem = document.createElement(theElem);
          elem.rel = 'stylesheet';
          elem.setAttribute(prop, unrw);
          return (
            window.top.getElementPropertyAsIs(elem, prop) !==
            elem.getAttribute(prop)
          );
        },
        aTest.elem,
        aTest.prop,
        aTest.unrw
      )
    );
  });

  test(`should un-rewrite the value returned by getAttribute for ${
    aTest.elem
  }.${prop}`, async t => {
    const { sandbox, server } = t.context;
    const { document } = this.wombatSandbox;
    const elem = document.createElement(aTest.elem);
    elem.setAttribute(prop, unrw);
    expect(elem.getAttribute(prop)).to.equal(
      prop === 'srcset' ? `${this.testHelpers.baseURLMP}/${unrw}` : unrw
    );
  });

  test(`should rewrite the value set by setAttribute for ${
    aTest.elem
  }.${prop}`, async t => {
    const { sandbox, server } = t.context;
    const { document } = this.wombatSandbox;
    const elem = document.createElement(aTest.elem);
    elem.setAttribute(prop, unrw);
    expect(elem.getAttribute(prop)).to.equal(
      prop === 'srcset' ? `${this.testHelpers.baseURLMP}/${unrw}` : unrw
    );
    expect(elem).to.have.rewrittenAttr(
      prop,
      prop === 'srcset'
        ? `${this.testHelpers.baseURLMP}/${unrw}`
        : `${prefix}${window.TagToMod[elem.tagName][prop]}/${unrw}`
    );
  });
});

test('Node.prototype: should return the document Proxy object when ownerDocument is accessed', async t => {
  const { sandbox, server } = t.context;
  const { document } = this.wombatSandbox;
  expect(document.body.ownerDocument).to.equal(document._WB_wombat_obj_proxy);
});

test('Node.prototype: should rewrite a element with no children supplied to "appendChild"', async t => {
  const { sandbox, server } = t.context;
  const wombatDoc = this.wombatSandbox.document;
  const div = wombatDoc.createElement('div');
  const a = window.untamperedWithWinDocObj.document.createElement('a');
  a.href = 'http://example.com';
  div.appendChild(a);
  expect(a).to.have.rewrittenAttr(
    'href',
    `${this.testHelpers.baseURLMP}/http://example.com`
  );
});

test('Node.prototype: should rewrite a element with multiple children supplied to "appendChild"', async t => {
  const { sandbox, server } = t.context;
  const wombatDoc = this.wombatSandbox.document;
  const div = wombatDoc.createElement('div');
  const a1 = window.untamperedWithWinDocObj.document.createElement('a');
  const a2 = window.untamperedWithWinDocObj.document.createElement('a');
  const a3 = window.untamperedWithWinDocObj.document.createElement('a');
  a1.href = 'http://example.com';
  a2.href = 'http://example.com';
  a3.href = 'http://example.com';
  a1.appendChild(a2);
  a1.appendChild(a3);
  div.appendChild(a1);
  expect(a1).to.have.rewrittenAttr(
    'href',
    `${this.testHelpers.baseURLMP}/http://example.com`
  );
  expect(a2).to.have.rewrittenAttr(
    'href',
    `${this.testHelpers.baseURLMP}/http://example.com`
  );
  expect(a3).to.have.rewrittenAttr(
    'href',
    `${this.testHelpers.baseURLMP}/http://example.com`
  );
});

test('Node.prototype: should rewrite a element with no children supplied to "insertBefore"', async t => {
  const { sandbox, server } = t.context;
  const wombatDoc = this.wombatSandbox.document;
  const div = wombatDoc.createElement('div');
  wombatDoc.body.appendChild(div);
  const a = window.untamperedWithWinDocObj.document.createElement('a');
  a.href = 'http://example.com';
  wombatDoc.body.insertBefore(a, div);
  div.remove();
  a.remove();
  expect(a).to.have.rewrittenAttr(
    'href',
    `${this.testHelpers.baseURLMP}/http://example.com`
  );
});

test('Node.prototype: should rewrite a element with multiple children supplied to "insertBefore"', async t => {
  const { sandbox, server } = t.context;
  const wombatDoc = this.wombatSandbox.document;
  const div = wombatDoc.createElement('div');
  wombatDoc.body.appendChild(div);
  const a1 = window.untamperedWithWinDocObj.document.createElement('a');
  const a2 = window.untamperedWithWinDocObj.document.createElement('a');
  const a3 = window.untamperedWithWinDocObj.document.createElement('a');
  a1.href = 'http://example.com';
  a2.href = 'http://example.com';
  a3.href = 'http://example.com';
  a1.appendChild(a2);
  a1.appendChild(a3);
  wombatDoc.body.insertBefore(a1, div);
  div.remove();
  a1.remove();
  expect(a1).to.have.rewrittenAttr(
    'href',
    `${this.testHelpers.baseURLMP}/http://example.com`
  );
  expect(a2).to.have.rewrittenAttr(
    'href',
    `${this.testHelpers.baseURLMP}/http://example.com`
  );
  expect(a3).to.have.rewrittenAttr(
    'href',
    `${this.testHelpers.baseURLMP}/http://example.com`
  );
});

test('Node.prototype: should rewrite a element with no children supplied to "replaceChild"', async t => {
  const { sandbox, server } = t.context;
  const wombatDoc = this.wombatSandbox.document;
  const div = wombatDoc.createElement('div');
  wombatDoc.body.appendChild(div);
  const a = window.untamperedWithWinDocObj.document.createElement('a');
  a.href = 'http://example.com';
  wombatDoc.body.replaceChild(a, div);
  a.remove();
  expect(a).to.have.rewrittenAttr(
    'href',
    `${this.testHelpers.baseURLMP}/http://example.com`
  );
});

test('Node.prototype: should rewrite a element with multiple children supplied to "replaceChild"', async t => {
  const { sandbox, server } = t.context;
  const wombatDoc = this.wombatSandbox.document;
  const div = wombatDoc.createElement('div');
  wombatDoc.body.appendChild(div);
  const a1 = window.untamperedWithWinDocObj.document.createElement('a');
  const a2 = window.untamperedWithWinDocObj.document.createElement('a');
  const a3 = window.untamperedWithWinDocObj.document.createElement('a');
  a1.href = 'http://example.com';
  a2.href = 'http://example.com';
  a3.href = 'http://example.com';
  a1.appendChild(a2);
  a1.appendChild(a3);
  wombatDoc.body.replaceChild(a1, div);
  a1.remove();
  expect(a1).to.have.rewrittenAttr(
    'href',
    `${this.testHelpers.baseURLMP}/http://example.com`
  );
  expect(a2).to.have.rewrittenAttr(
    'href',
    `${this.testHelpers.baseURLMP}/http://example.com`
  );
  expect(a3).to.have.rewrittenAttr(
    'href',
    `${this.testHelpers.baseURLMP}/http://example.com`
  );
});
