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

export default class WombatTestUtil {
  constructor () {
    this.addedSandbox = false;
    this.isSandboxReady = false;
    this.wombatMSGs = new ArrayMultimap();
  }

  /**
   * @return {Promise<HTMLIFrameElement>}
   */
  addWombatSandbox () {
    console.log('adding wombat sandbox');
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
