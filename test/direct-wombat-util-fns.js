import test from 'ava';
import TestHelper from './helpers/testHelper';
import { NativeFnTest, SaveSrcSetDataSrcSet } from './helpers/testedValues';

/**
 * @type {TestHelper}
 */
let helper = null;

test.before(async t => {
  helper = await TestHelper.init(t, true);
});

test.beforeEach(async t => {
  t.context.sandbox = helper.sandbox();
  t.context.testPage = helper.testPage();
  t.context.server = helper.server();
  await helper.initWombat();
});

test.after.always(async t => {
  await helper.stop();
});

test('getPageUnderModifier: should return the modifier the page is under', async t => {
  const { sandbox } = t.context;
  const testResult = await sandbox.evaluate(() =>
    wombat.getPageUnderModifier()
  );
  t.is(testResult, 'mp_');
});

test('isNativeFunction: should return T/F indicating if a function is a native function or not', async t => {
  const { sandbox } = t.context;
  const testResult = await sandbox.evaluate(NativeFnTest.testFN);
  t.deepEqual(testResult, NativeFnTest.expectedValue);
});

for (let i = 0; i < SaveSrcSetDataSrcSet.values.length; i++) {
  const value = SaveSrcSetDataSrcSet.values[i];
  test(`isSavedSrcSrcset: should return '${value.expected}' for '${value.name}'`, async t => {
    const { sandbox } = t.context;
    const testResult = await sandbox.evaluate(
      SaveSrcSetDataSrcSet.testFnSS,
      value.tagName,
      value.parentElement
    );
    t.is(testResult, value.expected);
  });
  test(`isSavedDataSrcSrcset: should return '${value.expected}' for '${value.name}' if it has data.srcset and 'false' when it does not`, async t => {
    const { sandbox } = t.context;
    const testResult = await sandbox.evaluate(
      SaveSrcSetDataSrcSet.testFnDSS,
      value.tagName,
      value.parentElement
    );
    t.deepEqual(testResult, {
      with: value.expected,
      without: false
    });
  });
}

test('isArgumentsObj: should return T/F indicating if the supplied object is the arguments object', async t => {
  const { sandbox } = t.context;
  const testResult = await sandbox.evaluate(() => ({
    null: wombat.isArgumentsObj(null),
    undefined: wombat.isArgumentsObj(undefined),
    objToStringNotFn: wombat.isArgumentsObj({ toString: 1 }),
    objToStringNotArgumentsObject: wombat.isArgumentsObj({}),
    actualArgumentsObject: wombat.isArgumentsObj(
      (function() {
        return arguments;
      })()
    )
  }));
  t.deepEqual(testResult, {
    null: false,
    undefined: false,
    objToStringNotFn: false,
    objToStringNotArgumentsObject: false,
    actualArgumentsObject: true
  });
});

test('deproxyArrayHandlingArgumentsObj: should deproxy elements in both an array and the arguments object', async t => {
  const { sandbox } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const makeProxy = returnWhat =>
      new Proxy(
        {},
        {
          get(target, p, receiver) {
            if (p === '__WBProxyRealObj__') return returnWhat;
            return null;
          }
        }
      );
    const argumentsObjWithProxies = (function() {
      return arguments;
    })(makeProxy(1), makeProxy(2));
    const argumentsDeproxied = wombat.deproxyArrayHandlingArgumentsObj(
      argumentsObjWithProxies
    );
    const justAnArrayWithProxies = [makeProxy(3), makeProxy(4)];
    const justArrayDeproxied = wombat.deproxyArrayHandlingArgumentsObj(
      justAnArrayWithProxies
    );
    return {
      argsDeproxied:
        Array.isArray(argumentsDeproxied) &&
        argumentsDeproxied !== argumentsObjWithProxies &&
        argumentsDeproxied[0] === 1 &&
        argumentsDeproxied[1] === 2,
      arrayDeproxied:
        Array.isArray(justArrayDeproxied) &&
        justArrayDeproxied === justAnArrayWithProxies &&
        justArrayDeproxied[0] === 3 &&
        justArrayDeproxied[1] === 4
    };
  });
  t.deepEqual(testResult, {
    argsDeproxied: true,
    arrayDeproxied: true
  });
});

test('deproxyArrayHandlingArgumentsObj: should return the original argument if it is falsy, a NodeList, has not elements, or the length property is falsy', async t => {
  const { sandbox } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const nl = document.querySelectorAll('*');
    const dpNL = wombat.deproxyArrayHandlingArgumentsObj(nl);
    const zeroLenArray = [];
    const zeroLenArguments = (function() {
      return arguments;
    })();
    const falsyLength = {};
    return {
      falsey: wombat.deproxyArrayHandlingArgumentsObj(null) === null,
      nodeList: dpNL instanceof NodeList && dpNL === nl,
      zeroLenArray:
        wombat.deproxyArrayHandlingArgumentsObj(zeroLenArray) === zeroLenArray,
      zeroLenArguments:
        wombat.deproxyArrayHandlingArgumentsObj(zeroLenArguments) ===
        zeroLenArguments,
      falsyLength:
        wombat.deproxyArrayHandlingArgumentsObj(falsyLength) === falsyLength
    };
  });
  t.deepEqual(testResult, {
    falsey: true,
    nodeList: true,
    zeroLenArray: true,
    zeroLenArguments: true,
    falsyLength: true
  });
});

test('startsWith: should return the prefix if the supplied string starts with the prefix otherwise undefined', async t => {
  const { sandbox } = t.context;
  const result = await sandbox.evaluate(() => {
    const prefix = 'a';
    return {
      does: wombat.startsWith('abc', prefix) === prefix,
      doesNot: wombat.startsWith('efg', prefix) === undefined,
      nullStr: wombat.startsWith(null, prefix) === undefined,
      empty: wombat.startsWith('', prefix) === undefined
    };
  });
  t.deepEqual(result, {
    does: true,
    doesNot: true,
    nullStr: true,
    empty: true
  });
});

test('startsWithOneOf: should return the matching prefix if the supplied string starts with one of the prefixes otherwise undefined', async t => {
  const { sandbox } = t.context;
  const result = await sandbox.evaluate(() => {
    const prefixes = ['b', 'a'];
    return {
      does: wombat.startsWithOneOf('abc', prefixes) === 'a',
      doesNot: wombat.startsWithOneOf('efg', prefixes) === undefined,
      nullStr: wombat.startsWithOneOf(null, prefixes) === undefined,
      empty: wombat.startsWithOneOf('', prefixes) === undefined
    };
  });
  t.deepEqual(result, {
    does: true,
    doesNot: true,
    nullStr: true,
    empty: true
  });
});

test('endsWith: should return the matching suffix if the supplied string ends with the suffixes otherwise undefined', async t => {
  const { sandbox } = t.context;
  const result = await sandbox.evaluate(() => {
    const suffix = 'abc';
    return {
      does: wombat.endsWith('xyzabc', suffix) === suffix,
      doesNot: wombat.endsWith('abcefg', suffix) === undefined,
      nullStr: wombat.endsWith(null, suffix) === undefined,
      empty: wombat.startsWith('', suffix) === undefined
    };
  });
  t.deepEqual(result, {
    does: true,
    doesNot: true,
    nullStr: true,
    empty: true
  });
});
