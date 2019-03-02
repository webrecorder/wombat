/* eslint-disable camelcase */
import { addToStringTagToClass } from './wombatUtils';

//TODO(n0tan3rd): figure out how to add ancestorOrigin to WombatLocation

/**
 *
 * @param {Location} orig_loc
 * @param {Wombat} wombat
 */
export default function WombatLocation(orig_loc, wombat) {
  // hide our values from enumeration, spreed, et al
  Object.defineProperties(this, {
    _orig_loc: {
      configurable: true,
      enumerable: false,
      value: orig_loc
    },
    wombat: {
      configurable: true,
      enumerable: false,
      value: wombat
    }
  });

  wombat.initLocOverride(this, this.orig_setter, this.orig_getter);

  wombat.setLoc(this, orig_loc.href);

  for (var prop in orig_loc) {
    if (!this.hasOwnProperty(prop) && typeof orig_loc[prop] !== 'function') {
      this[prop] = orig_loc[prop];
    }
  }
}

WombatLocation.prototype.replace = function replace(url) {
  var new_url = this.wombat.rewriteUrl(url);
  var orig = this.wombat.extractOriginalURL(new_url);
  if (orig === this.href) {
    return orig;
  }
  return this._orig_loc.replace(new_url);
};

WombatLocation.prototype.assign = function assign(url) {
  var new_url = this.wombat.rewriteUrl(url);
  var orig = this.wombat.extractOriginalURL(new_url);
  if (orig === this.href) {
    return orig;
  }
  return this._orig_loc.assign(new_url);
};

WombatLocation.prototype.reload = function reload() {
  return this._orig_loc.reload();
};

WombatLocation.prototype.orig_getter = function orig_getter(prop) {
  return this._orig_loc[prop];
};

WombatLocation.prototype.orig_setter = function orig_setter(prop, value) {
  this._orig_loc[prop] = value;
};

WombatLocation.prototype.toString = function toString() {
  return this.href;
};

WombatLocation.prototype.valueOf = function valueOf() {
  return this;
};

addToStringTagToClass(WombatLocation, 'Location');
