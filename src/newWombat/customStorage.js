function CustomStorage (wombat) {
  this.data = {}
  this.wombat = wombat
  Object.defineProperty(this, 'length', {
    'get': function () {
      return Object.keys(this.data).length
    }
  })
}

CustomStorage.prototype.getItem = function getItem (name) {
  return this.data.hasOwnProperty(name) ? this.data[name] : null
}

CustomStorage.prototype.setItem = function setItem (name, value) {
  name = String(name)
  // if (name.length > 1000) {
  //    name = name.substr(0, 1000);
  // }
  value = String(value)
  var old_val = this.getItem(name)
  this.data[name] = value
  this.fire_event(name, old_val, value)
}

CustomStorage.prototype.removeItem = function removeItem (name) {
  var old_val = this.getItem(name)
  var res = delete this.data[name]

  this.fire_event(name, old_val, null)
  return res
}

CustomStorage.prototype.clear = function clear () {
  this.data = {}
  this.fire_event(null, null, null)
}

CustomStorage.prototype.key = function key (n) {
  var keys = Object.keys(this.data)
  if (typeof (n) === 'number' && n >= 0 && n < keys.length) {
    return keys[n]
  } else {
    return null
  }
}

CustomStorage.prototype.fire_event = function fire_event (key, old_val, new_val) {
  var sevent = new StorageEvent('storage', {
    'key': key,
    'newValue': new_val,
    'oldValue': old_val,
    'url': this.wombat.$wbwindow.WB_wombat_location.href
  })

  sevent._storageArea = this

  this.wombat.storage_listeners.map(sevent)
}

export default CustomStorage
