export default function WombatLocation (orig_loc, wombat) {
  this._orig_loc = orig_loc

  this.replace = function replace (url) {
    var new_url = wombat.rewrite_url(url)
    var orig = wombat.extract_orig(new_url)
    if (orig === this.href) {
      return orig
    }
    return this._orig_loc.replace(new_url)
  }

  this.assign = function assign (url) {
    var new_url = wombat.rewrite_url(url)
    var orig = wombat.extract_orig(new_url)
    if (orig === this.href) {
      return orig
    }
    return this._orig_loc.assign(new_url)
  }

  this.reload = function reload () {
    return this._orig_loc.reload()
  }

  this.orig_getter = function orig_getter (prop) {
    return this._orig_loc[prop]
  }

  this.orig_setter = function orig_setter (prop, value) {
    this._orig_loc[prop] = value
  }

  this.toString = function toString () {
    return this.href
  }

  wombat.init_loc_override(this, this.orig_setter, this.orig_getter)

  wombat.set_loc(this, orig_loc.href)

  for (var prop in orig_loc) {
    if (!this.hasOwnProperty(prop) &&
      (typeof orig_loc[prop]) !== 'function') {
      this[prop] = orig_loc[prop]
    }
  }
}
