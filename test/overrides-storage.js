import test from 'ava';
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

test('Storage - creation: should throw error, direct construction not allowed', async t => {
  const { sandbox, server } = t.context;
  const creationPromise = sandbox.evaluate(() => {
    new Storage();
  });
  await t.throwsAsync(creationPromise);
});

test('Storage - empty on init, internal values should not be exposed', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    return {...window.storage};
  });

  t.deepEqual(testResult, {});
});

test('Storage - missing getItem: absent items should return null', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = localStorage;
    return storage.getItem('a') === null;
  });
  t.true(testResult);
});

test('Storage - missing dot accessor: absent items should return undefined to dot notation accessor', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = localStorage;
    return storage.a === undefined;
  });
  t.true(testResult);
});

test('Storage - missing bracket accessor: absent items should return undefined to bracket notation accessor', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = localStorage;
    return storage['a'] === undefined;
  });
  t.true(testResult);
});

test('Storage - getItem: the item set should be retrievable', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = localStorage;
    const key = 'a';
    const value = 'b';
    storage.setItem(key, value);
    return storage.getItem(key) === value;
  });
  t.true(testResult);
});

test('Storage - dot accessor get: the item set should be retrievable with dot notation accessor', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = localStorage;
    const key = 'a';
    const value = 'b';
    storage.setItem(key, value);
    return storage.a === value;
  });
  t.true(testResult);
});

test('Storage - bracket accessor get: the item set should be retrievable with bracket notation accessor', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = localStorage;
    const key = 'a';
    const value = 'b';
    storage.setItem(key, value);
    return storage[key] === value;
  });
  t.true(testResult);
});

test('Storage - dot accessor set: the item set using dot notation accessor should be mapped', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = localStorage;
    const key = 'a';
    const value = 'b';
    storage.a = value;
    return storage.getItem(key) === value;
  });
  t.true(testResult);
});

test('Storage - bracket accessor set: the item set using bracket notation accessor should be mapped', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = localStorage;
    const key = 'a';
    const value = 'b';
    storage[key] = value;
    storage.a = value;
    return storage.getItem(key) === value;
  });
  t.true(testResult);
});

test('Storage - removeItem: the item set should be removable', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = localStorage;
    const key = 'a';
    const value = 'b';
    storage.setItem(key, value);
    storage.removeItem(key);
    return storage[key] === undefined;
  });
  t.true(testResult);
});

test('Storage - clear: should clear all stored items', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = localStorage;
    const key = 'a';
    const value = 'b';
    storage.setItem(key, value);
    storage.clear();
    return Object.keys(storage);
  });
  t.deepEqual(testResult, []);


});

test('Storage - key: should return the correct key given the keys index', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = localStorage;
    const key1 = 'a1';
    const key2 = 'a2';
    const value1 = 'b1';
    const value2 = 'b2';
    storage.setItem(key1, value1);
    storage.setItem(key2, value2);
    return (
      storage.key(0) === key1 &&
      storage.key(1) === key2 &&
      storage.key(2) === null
    );
  });
  t.true(testResult);
});

test('Storage - keys: object keys should contain stored item key', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = localStorage;
    const key = 'a';
    const value = 'b';
    storage.setItem(key, value);
    return Object.keys(storage).includes(key);
  });
  t.true(testResult);
});

test('Storage - property: object own property name should contain stored item key', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = localStorage;
    const key = 'a';
    const value = 'b';
    storage.setItem(key, value);
    return Object.getOwnPropertyNames(storage).includes(key);
  });
  t.true(testResult);
});

test('Storage - valueOf: should return the correct value', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = sessionStorage;
    return storage.valueOf() === storage;
  });
  t.true(testResult);
});

test('Storage - toString: should return the correct value', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = sessionStorage;
    return storage.toString() === '[object Storage]';
  });
  t.true(testResult);
});


test('Storage - length: should return the correct value', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = sessionStorage;
    const key1 = 'a1';
    const key2 = 'a2';
    const value1 = 'b1';
    const value2 = 'b2';
    storage.setItem(key1, value1);
    storage.setItem(key2, value2);
    return storage.length;
  });
  t.is(testResult, 2);
});

test('Storage - assorted length: should return the correct length of various setters', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = localStorage;
    storage.clear();
    const key1 = 'a1';
    const key2 = 'a2';
    const key3 = 'a3';
    const value1 = 'b1';
    const value2 = 'b2';
    const value3 = 'b3';
    storage.setItem(key1, value1);
    storage[key2] = value2;
    storage.a3 = value3;
    return storage.length;
  });
  t.is(testResult, 3);
});

test('Storage - getPrototypeOf() and __proto__ equivalence', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    return Object.getPrototypeOf(localStorage) === Object.getPrototypeOf(sessionStorage) &&
           Object.getPrototypeOf(localStorage) === localStorage.__proto__ &&
           Object.getPrototypeOf(localStorage) === Storage.prototype;
  });
  t.is(testResult, true);
});
