class ArrayMultimap {
  constructor () {
    this._map = new Map();
  }

  set (key, value) {
    let set = this._map.get(key);
    if (!set) {
      set = [];
      this._map.set(key, set);
    }
    set.push(value);
  }

  get (key) {
    let result = this._map.get(key);
    if (!result) { result = []; }
    return result;
  }

  has (key) {
    return this._map.has(key);
  }

  /**
   * @return {number}
   */
  get size () {
    return this._map.size;
  }

  deleteAll (key) {
    this._map.delete(key);
  }

  firstValue (key) {
    const ar = this._map.get(key);
    if (!ar) { return null; }
    return ar[0];
  }

  numValues (key) {
    return this.get(key).length;
  }

  firstKey () {
    return this._map.keys().next().value;
  }

  valuesArray () {
    const result = [];
    for (const key of this._map.keys()) { result.push(...this._map.get(key)); }
    return result;
  }

  keysArray () {
    return Array.from(this._map.keys());
  }

  clear () {
    this._map.clear();
  }
}

class WombatTestUtil {
  constructor () {
    this.addedSandbox = false;
    this.isSandboxReady = false;
    this.wombatMSGs = new ArrayMultimap();
  }

  getSandboxURL () {
    if (window.location.protocol === 'https:') {
      return `${location.origin}/live/20180803160549mp_/https://tests.wombat.io/`;
    }
    return 'wombatSandbox.html';
  }

  /**
   * @return {Promise<HTMLIFrameElement>}
   */
  addWombatSandbox () {
    this.wombatMSGs.clear();
    if (!this.addedSandbox) {
      const container = document.getElementById('wombatSandboxContainer');
      const wbif = document.createElement('iframe');
      wbif.src = this.getSandboxURL();
      wbif.id = 'wombatSandbox';
      container.appendChild(wbif);
      this.sandbox = wbif;
      this.addedSandbox = true;
      return new Promise((resolve) => {
        this.done = resolve;
      });
    }
    return Promise.resolve(this.sandbox);
  }
  removeWombatSandbox () {
    if (this.addedSandbox) {
      this.sandbox = null;
      document.getElementById('wombatSandbox').remove();
      this.addedSandbox = false;
    }
  }

  sandboxReady () {
    if (this.done) {
      this.done(this.sandbox);
      this.done = null;
    }
  }

  /**
   * @return {Promise<HTMLIFrameElement>}
   */
  refreshSandbox () {
    this.wombatMSGs.clear();
    this.sandbox.contentWindow.location.reload();
    return new Promise((resolve) => {
      this.done = resolve;
    });
  }

  wombatMSG (msg) {
    this.wombatMSGs.set(msg.wb_type, msg);
  }
}

window.wombatTestUtil = new WombatTestUtil();

window.addEventListener('message', (event) => {
  const { data } = event;
  if (data && data.type) {
    switch (event.data.type) {
      case 'wombat-sandbox-ready':
        window.wombatTestUtil.sandboxReady();
        break;
      default:
        console.log('WombatTestUtil got unhandled msg', event.data);
        break;
    }
  } else if (data && data.wb_type) {
    window.wombatTestUtil.wombatMSG(data);
  }
}, false);

window.testLogger = console.log.bind(console);

window.initTestContext = function initTestContext (options = { init: false }) {
  return async function () {
    let wombatIf = await window.wombatTestUtil.addWombatSandbox();
    /**
     * @type {{window: Window | null, document: Document | null}}
     */
    this.wombatSandbox = {
      window: wombatIf.contentWindow,
      document: wombatIf.contentDocument,
      originalLocation: wombatIf.src
    };

    this.testHelpers = {
      baseURLMP: `${window.WB_PREFIX}mp_`
    };

    Object.defineProperty(this, 'wombatMSGs', {
      get () { return window.wombatTestUtil.wombatMSGs; }
    });

    this.delay = function (dtime = 500) {
      return new Promise(resolve => setTimeout(resolve, dtime));
    };

    const testSelf = this;
    this.$internalHelper = {
      validTestTitles: {
        '"before all" hook': true,
        '"before" hook': true
      },
      _updateSandboxInfo (sandbox) {
        testSelf.wombatSandbox.window = sandbox.contentWindow;
        testSelf.wombatSandbox.document = sandbox.contentDocument;
        testSelf.originalLocation = sandbox.src;
      },
      async refresh () {
        wombatIf = await window.wombatTestUtil.refreshSandbox();
        this._updateSandboxInfo(wombatIf);
      },
      async refreshInit () {
        await this.refresh();
        this.init();
      },
      async goBackToTest () {
        await window.wombatTestUtil.removeWombatSandbox();
        wombatIf = await window.wombatTestUtil.addWombatSandbox();
        this.init(wombatIf);
      },
      init (sandbox) {
        if (sandbox != null) {
          this._updateSandboxInfo(sandbox);
        }
        testSelf.wombatSandbox.window._WBWombatInit(testSelf.wombatSandbox.window.wbinfo);
      }
    };
    if (options.init) {
      await this.$internalHelper.refreshInit();
    }
  };
};

window.untamperedWithWinDocObj = { window, document };

mocha.setup({
  ui: 'bdd',
  ignoreLeaks: true
});
