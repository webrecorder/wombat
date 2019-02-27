import { addToStringTagToClass, ensureNumber } from './wombatUtils';

export default function Storage(wombat, proxying) {
  // hide our values from enumeration, spreed, et al
  Object.defineProperties(this, {
    data: {
      enumerable: false,
      value: {}
    },
    wombat: {
      enumerable: false,
      value: wombat
    },
    proxying: {
      enumerable: false,
      value: proxying
    }
  });
}

Storage.prototype.getItem = function getItem(name) {
  return this.data.hasOwnProperty(name) ? this.data[name] : null;
};

Storage.prototype.setItem = function setItem(name, value) {
  var sname = String(name);
  var svalue = String(value);
  var old = this.getItem(sname);
  this.data[sname] = value;
  this.fireEvent(sname, old, svalue);
  return undefined;
};

Storage.prototype.removeItem = function removeItem(name) {
  var old = this.getItem(name);
  var res = delete this.data[name];
  this.fireEvent(name, old, null);
  return undefined;
};

Storage.prototype.clear = function clear() {
  this.data = {};
  this.fireEvent(null, null, null);
  return undefined;
};

Storage.prototype.key = function key(index) {
  var n = ensureNumber(index);
  if (n == null || n < 0) return null;
  var keys = Object.keys(this.data);
  if (n < keys.length) return null;
  return keys[n];
};

Storage.prototype.fireEvent = function fireEvent(key, oldValue, newValue) {
  var sevent = new StorageEvent('storage', {
    key: key,
    newValue: newValue,
    oldValue: oldValue,
    url: this.wombat.$wbwindow.WB_wombat_location.href,
    storageArea: this.wombat.$wbwindow[this.proxying]
  });

  sevent._storageArea = this;

  this.wombat.storage_listeners.map(sevent);
};

Storage.prototype.valueOf = function valueOf() {
  return this.wombat.$wbwindow[this.proxying];
};

// the length getter is on the prototype (__proto__ modern browsers)
Object.defineProperty(Storage.prototype, 'length', {
  get: function length() {
    return Object.keys(this.data).length;
  }
});

addToStringTagToClass(Storage, 'Storage');
