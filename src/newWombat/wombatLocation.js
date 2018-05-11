function WombatLocation (orig_loc, wombat) {
  this._orig_loc = orig_loc
  this._wombat = wombat

  this.init_loc_override()
  this.set_loc()

  for (var prop in orig_loc) {
    if (!this.hasOwnProperty(prop) &&
      (typeof orig_loc[prop]) !== 'function') {
      this[prop] = orig_loc[prop]
    }
  }
}

/**
 * @param {string} prop
 * @return {function}
 * @private
 */
WombatLocation.prototype._make_get_loc_prop = function _make_get_loc_prop (prop) {
  function getter () {
    if (this._no_rewrite) {
      return this.orig_getter(prop)
    }

    var curr_orig_href = this.orig_getter('href')

    if (prop === 'href') {
      return this._wombat.extract_orig(curr_orig_href)
    }

    if (this._orig_href !== curr_orig_href) {
      this.set_loc(curr_orig_href)
    }

    return this['_' + prop]
  }

  return getter
}

/**
 * @param {string} prop
 * @return {function}
 * @private
 */
WombatLocation.prototype._make_set_loc_prop = function _make_set_loc_prop (prop) {
  function setter (value) {
    if (this._no_rewrite) {
      this.orig_setter(prop, value)
      return
    }

    if (this['_' + prop] === value) {
      return
    }

    this['_' + prop] = value

    if (!this._parser) {
      var href = this.orig_getter('href')
      this._parser = this._wombat.make_parser(href, this.ownerDocument)
    }

    var rel = false

    //Special case for href="." assignment
    if (prop === 'href' && typeof(value) === 'string') {
      if (value) {
        if (value[0] === '.') {
          value = this._wombat.resolve_rel_url(value, this.ownerDocument)
        } else if (value[0] === '/' &&
          (value.length <= 1 || value[1] !== '/')) {
          rel = true
          value = WB_wombat_location.origin + value
        }
      }
    }

    try {
      this._parser[prop] = value
    } catch (e) {
      console.log('Error setting ' + prop + ' = ' + value)
    }

    if (prop === 'hash') {
      value = this._parser[prop]
      this.orig_setter('hash', value)
    } else {
      rel = rel || (value === this._parser.pathname)
      value = this._wombat.rewrite_url(this._parser.href, rel)
      this.orig_setter('href', value)
    }
  }

  return setter
}

WombatLocation.prototype.init_loc_override = function init_loc_override () {
  if (Object.defineProperty) {
    var URL_PROPS = this._wombat.URL_PROPS;
    for (var i = 0; i < URL_PROPS.length; i++) {
      var prop = URL_PROPS[i]
      var setter = this._make_set_loc_prop(prop)
      var getter = this._make_get_loc_prop(prop)
      this._wombat.def_prop(this, prop, setter, getter, true)
    }
  }
}

WombatLocation.prototype.set_loc = function set_loc () {
  var parser = this._wombat.make_parser(this._orig_loc.href, this.ownerDocument)

  this._orig_href = this._orig_loc.href
  this._parser = parser

  var href = parser.href
  this._hash = parser.hash

  this._href = href

  this._host = parser.host
  this._hostname = parser.hostname

  if (parser.origin) {
    this._origin = parser.origin
  } else {
    this._origin = parser.protocol + '//' + parser.hostname +
      (parser.port ? ':' + parser.port : '')
  }

  this._pathname = parser.pathname
  this._port = parser.port
  //this.protocol = parser.protocol;
  this._protocol = parser.protocol
  this._search = parser.search

  if (!Object.defineProperty) {
    this.href = href
    this.hash = parser.hash

    this.host = this._host
    this.hostname = this._hostname
    this.origin = this._origin
    this.pathname = this._pathname
    this.port = this._port
    this.protocol = this._protocol
    this.search = this._search
  }
}

WombatLocation.prototype.replace = function replace (url) {
  var new_url = this._wombat.rewrite_url(url)
  var orig = this._wombat.extract_orig(new_url)
  if (orig === this.href) {
    return orig
  }
  return this._orig_loc.replace(new_url)
}

WombatLocation.prototype.assign = function assign (url) {
  var new_url = this._wombat.rewrite_url(url)
  var orig = this._wombat.extract_orig(new_url)
  if (orig === this.href) {
    return orig
  }
  return this._orig_loc.assign(new_url)
}

WombatLocation.prototype.reload = function reload () {
  return this._orig_loc.reload()
}

WombatLocation.prototype.orig_getter = function orig_getter (prop) {
  return this._orig_loc[prop]
}

WombatLocation.prototype.orig_setter = function orig_setter (prop, value) {
  this._orig_loc[prop] = value
}

WombatLocation.prototype.toString = function toString () {
  return this.href
}

export default WombatLocation
