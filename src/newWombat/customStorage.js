export default function CustomStorage (wombat) {
  this.data = {};
  this.wombat = wombat;
  Object.defineProperty(this, 'length', {
    get: function () {
      return Object.keys(this.data).length;
    }
  });
}

CustomStorage.prototype.getItem = function getItem (name) {
  return this.data.hasOwnProperty(name) ? this.data[name] : null;
};

CustomStorage.prototype.setItem = function setItem (name, value) {
  var sname = String(name);
  var svalue = String(value);
  var old = this.getItem(sname);
  this.data[sname] = value;
  this.fireEvent(sname, old, svalue);
};

CustomStorage.prototype.removeItem = function removeItem (name) {
  var old = this.getItem(name);
  var res = delete this.data[name];
  this.fireEvent(name, old, null);
  return res;
};

CustomStorage.prototype.clear = function clear () {
  this.data = {};
  this.fireEvent(null, null, null);
};

CustomStorage.prototype.key = function key (n) {
  var keys = Object.keys(this.data);
  if (typeof n === 'number' && n >= 0 && n < keys.length) {
    return keys[n];
  } else {
    return null;
  }
};

CustomStorage.prototype.fireEvent = function fireEvent (key, oldValue, newValue) {
  var sevent = new StorageEvent('storage', {
    key: key,
    newValue: newValue,
    oldValue: oldValue,
    url: this.wombat.$wbwindow.WB_wombat_location.href
  });

  sevent._storageArea = this;

  this.wombat.storage_listeners.map(sevent);
};
