import test from 'ava';
import TestHelper from './helpers/testHelper';

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
  await t.context.sandbox.evaluate(() => {
    window.fakeWombat = {
      $wbwindow: {
        WB_wombat_location: {
          href: 'bogus url'
        }
      },
      storage_listeners: {
        sEvents: [],
        map(sEvent) {
          this.sEvents.push(sEvent);
        }
      }
    };
  });
});

test.after.always(async t => {
  await helper.stop();
});

test('Storage - creation: should not throw errors', async t => {
  const { sandbox, server } = t.context;
  const creationPromise = sandbox.evaluate(() => {
    new Storage();
  });
  await t.notThrowsAsync(creationPromise);
});

test('Storage - post creation: internal values should not be exposed', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = new Storage(window.fakeWombat, 'bogus value');
    return { ...storage };
  });
  t.deepEqual(testResult, {});
});

test('Storage - missing getItem: absent items should return null', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = new Storage(window.fakeWombat, 'bogus value');
    return storage.getItem('a') === null;
  });
  t.true(testResult);
});

test('Storage - missing dot accessor: absent items should return undefined to dot notation accessor', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = new Storage(window.fakeWombat, 'bogus value');
    return storage.a === undefined;
  });
  t.true(testResult);
});

test('Storage - missing bracket accessor: absent items should return undefined to bracket notation accessor', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = new Storage(window.fakeWombat, 'bogus value');
    return storage['a'] === undefined;
  });
  t.true(testResult);
});

test('Storage - getItem: the item set should be retrievable', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = new Storage(window.fakeWombat, 'bogus value');
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
    const storage = new Storage(window.fakeWombat, 'bogus value');
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
    const storage = new Storage(window.fakeWombat, 'bogus value');
    const key = 'a';
    const value = 'b';
    storage.setItem(key, value);
    return storage[key] === value;
  });
  t.true(testResult);
});

test('Storage - setItem: the item set should be mapped and an storage event fired', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = new Storage(window.fakeWombat, 'bogus value');
    const key = 'a';
    const value = 'b';
    storage.setItem(key, value);
    const events = window.fakeWombat.storage_listeners.sEvents;
    const event = events[0];
    return {
      stored: storage.data[key] === value,
      numEvents: events.length,
      key: event.key === key,
      newValue: event.newValue === value,
      oldValue: event.oldValue === null,
      storageArea: event.storageArea === storage,
      url: event.url === 'bogus url'
    };
  });
  t.deepEqual(testResult, {
    stored: true,
    numEvents: 1,
    key: true,
    newValue: true,
    oldValue: true,
    storageArea: true,
    url: true
  });
});

test('Storage - dot accessor set: the item set using dot notation accessor should be mapped and a storage event fired', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = new Storage(window.fakeWombat, 'bogus value');
    const key = 'a';
    const value = 'b';
    storage.a = value;
    const events = window.fakeWombat.storage_listeners.sEvents;
    const event = events[0];
    return {
      stored: storage.data[key] === value,
      numEvents: events.length,
      key: event.key === key,
      newValue: event.newValue === value,
      oldValue: event.oldValue === null,
      storageArea: event.storageArea === storage,
      url: event.url === 'bogus url'
    };
  });
  t.deepEqual(testResult, {
    stored: true,
    numEvents: 1,
    key: true,
    newValue: true,
    oldValue: true,
    storageArea: true,
    url: true
  });
});

test('Storage - bracket accessor set: the item set using bracket notation accessor should be mapped and a storage event fired', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = new Storage(window.fakeWombat, 'bogus value');
    const key = 'a';
    const value = 'b';
    storage[key] = value;
    const events = window.fakeWombat.storage_listeners.sEvents;
    const event = events[0];
    return {
      stored: storage.data[key] === value,
      numEvents: events.length,
      key: event.key === key,
      newValue: event.newValue === value,
      oldValue: event.oldValue === null,
      storageArea: event.storageArea === storage,
      url: event.url === 'bogus url'
    };
  });
  t.deepEqual(testResult, {
    stored: true,
    numEvents: 1,
    key: true,
    newValue: true,
    oldValue: true,
    storageArea: true,
    url: true
  });
});

test('Storage - removeItem: the item set should be removable and an event should be fired indicating removal', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = new Storage(window.fakeWombat, 'bogus value');
    const key = 'a';
    const value = 'b';
    storage.setItem(key, value);
    storage.removeItem(key);
    const events = window.fakeWombat.storage_listeners.sEvents;
    const event = events[1];
    return {
      stored: storage.data[key] === undefined,
      numEvents: events.length,
      key: event.key === key,
      newValue: event.newValue === null,
      oldValue: event.oldValue === value,
      storageArea: event.storageArea === storage,
      url: event.url === 'bogus url'
    };
  });
  t.deepEqual(testResult, {
    stored: true,
    numEvents: 2,
    key: true,
    newValue: true,
    oldValue: true,
    storageArea: true,
    url: true
  });
});

test('Storage - clear: should clear all stored items and an event should be fired indicating clearing', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = new Storage(window.fakeWombat, 'bogus value');
    const key = 'a';
    const value = 'b';
    storage.setItem(key, value);
    storage.clear();
    const events = window.fakeWombat.storage_listeners.sEvents;
    const event = events[1];
    return {
      numEvents: events.length,
      key: event.key === null,
      newValue: event.newValue === null,
      oldValue: event.oldValue === null,
      storageArea: event.storageArea === storage,
      url: event.url === 'bogus url'
    };
  });
  t.deepEqual(testResult, {
    numEvents: 2,
    key: true,
    newValue: true,
    oldValue: true,
    storageArea: true,
    url: true
  });
});

test('Storage - key: should return the correct key given the keys index', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = new Storage(window.fakeWombat, 'bogus value');
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
    const storage = new Storage(window.fakeWombat, 'bogus value');
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
    const storage = new Storage(window.fakeWombat, 'bogus value');
    const key = 'a';
    const value = 'b';
    storage.setItem(key, value);
    return Object.getOwnPropertyNames(storage).includes(key);
  });
  t.true(testResult);
});

test('Storage - fireEvent: should fire a StorageEvent with the supplied arguments', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = new Storage(window.fakeWombat, 'bogus value');
    storage.fireEvent('a', 'b', 'c');
    const events = window.fakeWombat.storage_listeners.sEvents;
    const event = events[0];
    return {
      numEvents: events.length,
      key: event.key === 'a',
      newValue: event.newValue === 'c',
      oldValue: event.oldValue === 'b',
      storageArea: event.storageArea === storage,
      url: event.url === 'bogus url'
    };
  });
  t.deepEqual(testResult, {
    numEvents: 1,
    key: true,
    newValue: true,
    oldValue: true,
    storageArea: true,
    url: true
  });
});

test('Storage - valueOf: should return the correct value', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = new Storage(window.fakeWombat, 'bogus value');
    fakeWombat.$wbwindow['bogus value'] = storage;
    return storage.valueOf() === storage;
  });
  t.true(testResult);
});

test('Storage - length: should return the correct value', async t => {
  const { sandbox, server } = t.context;
  const testResult = await sandbox.evaluate(() => {
    const storage = new Storage(window.fakeWombat, 'bogus value');
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
    const storage = new Storage(window.fakeWombat, 'bogus value');
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
