export default function WombatLocation (orig_loc, wombat) {
  this._orig_loc = orig_loc;
  this.wombat = wombat;

  wombat.init_loc_override(this, this.orig_setter, this.orig_getter);

  wombat.set_loc(this, orig_loc.href);

  for (var prop in orig_loc) {
    if (!this.hasOwnProperty(prop) && typeof orig_loc[prop] !== 'function') {
      this[prop] = orig_loc[prop];
    }
  }
  if (typeof self.Symbol !== 'undefined' && typeof self.Symbol.toStringTag !== 'undefined') {
    Object.defineProperty(this, self.Symbol.toStringTag, {
      get: function () {
        return 'Location';
      }
    });
  }
}

WombatLocation.prototype.replace = function replace (url) {
  var new_url = this.wombat.rewrite_url(url);
  var orig = this.wombat.extract_orig(new_url);
  if (orig === this.href) {
    return orig;
  }
  return this._orig_loc.replace(new_url);
};

WombatLocation.prototype.assign = function assign (url) {
  var new_url = this.wombat.rewrite_url(url);
  var orig = this.wombat.extract_orig(new_url);
  if (orig === this.href) {
    return orig;
  }
  return this._orig_loc.assign(new_url);
};

WombatLocation.prototype.reload = function reload () {
  return this._orig_loc.reload();
};

WombatLocation.prototype.orig_getter = function orig_getter (prop) {
  return this._orig_loc[prop];
};

WombatLocation.prototype.orig_setter = function orig_setter (prop, value) {
  this._orig_loc[prop] = value;
};

WombatLocation.prototype.toString = function toString () {
  return this.href;
};