window.setupAfter = {
  EventTarget: ['addEventListener', 'removeEventListener'],
  MessageEvent: ['target', 'srcElement', 'currentTarget', 'eventPhase', 'path'],
  Document: {
    fn: ['write', 'writeln', 'open', 'createElementNS', 'evaluate', 'createTreeWalker'],
    props: ['URL', 'documentURI']
  },
  Node: {
    fn: ['compareDocumentPosition', 'contains', 'replaceChild', 'appendChild', 'insertBefore']
  },
  override_html_assign: {
    HTMLElement: ['innerHTML', 'outerHTML'],
    HTMLIFrameElement: ['srcdoc'],
    HTMLStyleElement: ['textContent']
  },
  Attr: ['nodeValue', 'value'],
  window: {
    fn: ['setTimeout', 'setInterval', 'getComputedStyle'],
    props: ['origin']
  },
  document: {
    props: ['origin', 'domain']
  },
  protoFns: {
    Element: ['getAttribute', 'setAttribute'],
    SVGImageElement: ['getAttribute', 'getAttributeNS', 'setAttribute', 'setAttributeNS']
  },
  elemAttrs: {
    HTMLLinkElement: ['href'],
    CSSStyleSheet: ['href'],
    HTMLImageElement: ['src', 'srcset'],
    HTMLIFrameElement: ['src'],
    HTMLScriptElement: ['src'],
    HTMLVideoElement: ['src', 'poster'],
    HTMLAudioElement: ['src', 'poster'],
    HTMLSourceElement: ['src', 'srcset'],
    HTMLInputElement: ['src'],
    HTMLEmbedElement: ['src'],
    HTMLObjectElement: ['data'],
    HTMLBaseElement: ['href'],
    HTMLMetaElement: ['content'],
    HTMLFormElement: ['action']
  },

  anchorElement: ['href', 'hash', 'pathname', 'host', 'hostname', 'protocol',
    'origin', 'search', 'port'],

  styleProto: {
    on: window.CSS2Properties != null ? 'CSS2Properties' : 'CSSStyleDeclaration',
    props: ['cssText', 'background', 'backgroundImage', 'cursor', 'border', 'borderImage', 'borderImageSource']
  }
};

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

  /**
   * @return {Promise<HTMLIFrameElement>}
   */
  addWombatSandbox () {
    this.wombatMSGs.clear();
    if (!this.addedSandbox) {
      const container = document.getElementById('wombatSandboxContainer');
      const wbif = document.createElement('iframe');
      if (window.location.protocol === 'https:') {
        wbif.src = '/20180803160549mp_/https://tests.wombat.io';
      } else {
        wbif.src = 'wombatSandbox.html';
      }
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
      document: wombatIf.contentDocument
    };

    Object.defineProperty(this, 'wombatMSGs', {
      get () { return window.wombatTestUtil.wombatMSGs; }
    });

    const testSelf = this;
    this._$internalHelper = {
      validTestTitles: {
        '"before all" hook': true,
        '"before" hook': true
      },
      checkValidCall () {
        if (!this.validTestTitles[testSelf.test.title]) {
          console.log(this.validTestTitles, testSelf.test.title);
          throw new Error(`Invalid usage of internal helpers at ${testSelf.test.title}`);
        }
      },
      async refresh () {
        this.checkValidCall();
        wombatIf = await window.wombatTestUtil.refreshSandbox();
        testSelf.wombatSandbox.window = wombatIf.contentWindow;
        testSelf.wombatSandbox.document = wombatIf.contentDocument;
      },
      async refreshInit () {
        await this.refresh();
        this.init();
      },
      init () {
        testSelf.wombatSandbox.window._WBWombatInit(testSelf.wombatSandbox.window.wbinfo);
      }
    };
    if (options.init) {
      await this._$internalHelper.refreshInit();
    }
  };
};

mocha.setup({
  ui: 'bdd',
  ignoreLeaks: true
});
