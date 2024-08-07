import test from 'ava';
import { mpURL } from './helpers/testedValues';
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

test.afterEach.always(async t => {
  if (t.title.includes('SharedWorker')) {
    await helper.fullRefresh();
  } else {
    await helper.ensureSandbox();
  }
});

test.after.always(async t => {
  await helper.stop();
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
  const result = await sandbox.evaluate(async () => {
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
  });
  t.true(result);
});

test('fetch: should rewrite the input argument when it is a string (URL), also return original', async t => {
  const { sandbox, server } = t.context;
  const result = await sandbox.evaluate(async () => {
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
    return {url: data.url, respURL: response.url};
  });
  t.is(result.url, '/live/20180803160549mp_/https://tests.wombat.io/test');
  t.is(result.respURL, 'https://tests.wombat.io/test');
});

test('fetch: should rewrite the input argument when it is an Request object, also return original', async t => {
  const { sandbox, server } = t.context;
  const result = await sandbox.evaluate(async () => {
    let to;
    let request = new Request('/test', {
      method: 'GET'
    });
    let response = await Promise.race([
      fetch(request),
      new Promise(resolve => {
        to = setTimeout(() => resolve('timed out'), 5000);
      })
    ]);
    if (response === 'timed out')
      throw new Error('no reply from server in 5 seconds');
    clearTimeout(to);
    const data = await response.json();
    return {url: data.url,
            rwUrl: request.url,
            respURL: response.url};
  });
  t.is(result.rwUrl, 'https://tests.wombat.io/test');
  t.is(result.url, '/live/20180803160549mp_/https://tests.wombat.io/test');
  t.is(result.respURL, 'https://tests.wombat.io/test');
});

test('fetch: Request.referrer is rewritten across multiple copies of Request', async t => {
  const { sandbox, server } = t.context;
  const result = await sandbox.evaluate(async () => {
    let to;
    let A = new Request('/test', {'referrer': '/abc'});
    let B = new Request('/test', A);
    let C = new Request(B, {'referrer': '/xyz'});
    let D = new Request({'url': '/test', 'referrer': '/cde'}, C);
    D.__WB_no_unrewrite = true;

    return {A: A.referrer,
            B: B.referrer,
            C: C.referrer,
            D: D.referrer
           };
  });
  t.is(result.A, 'https://tests.wombat.io/abc');
  t.is(result.B, 'https://tests.wombat.io/abc');
  t.is(result.C, 'https://tests.wombat.io/xyz');
  t.is(result.D, 'http://localhost:3030/live/20180803160549mp_/https://tests.wombat.io/xyz');
});


test('fetch: should rewrite the input argument when it is a object, but return original', async t => {
  const { sandbox, server } = t.context;
  const result = await sandbox.evaluate(async () => {
    let to;
    let response = await Promise.race([
      fetch({ href: '/test', toString: () => { return '/test'; }}),
      new Promise(resolve => {
        to = setTimeout(() => resolve('timed out'), 10000);
      })
    ]);
    if (response === 'timed out')
      throw new Error('no reply from server in 10 seconds');
    clearTimeout(to);
    const data = await response.json();
    return {url: data.url, respURL: response.url};
  });
  t.is(result.url, '/live/20180803160549mp_/https://tests.wombat.io/test');
  t.is(result.respURL, 'https://tests.wombat.io/test');
});

test('Request: should rewrite the input argument to the constructor when it is a string (URL)', async t => {
  const { sandbox, server } = t.context;
  const result = await sandbox.evaluate(() => {
    const req = new Request('/test', { method: 'GET' });
    return {url: req.url};
  });
  t.is(result.url, 'https://tests.wombat.io/test');
});

test('Request: should rewrite the input argument to the constructor when it is an object with a url property', async t => {
  const { sandbox, server } = t.context;
  const result = await sandbox.evaluate(() => {
    const req = new Request({ url: '/test' }, { method: 'GET', referrer: 'https://example.com/' });
    return {url: req.url, referrer: req.referrer};
  });
  t.is(result.url, 'https://tests.wombat.io/test');
  t.is(result.referrer, 'https://example.com/');
});

