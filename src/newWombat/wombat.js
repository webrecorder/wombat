import FuncMap from './funcMap'
import WombatLocation from './wombatLocation'

/**
 * @param {Window} $wbwindow
 * @param {Object} wbinfo
 */
function Wombat ($wbwindow, wbinfo) {
  if (!(this instanceof Wombat)) return new Wombat($wbwindow, wbinfo)
  this.$wbwindow = $wbwindow
  this.HTTP_PREFIX = 'http://'
  this.HTTPS_PREFIX = 'https://'
  this.REL_PREFIX = '//'

  this.VALID_PREFIXES = [this.HTTP_PREFIX, this.HTTPS_PREFIX, this.REL_PREFIX]
  this.IGNORE_PREFIXES = ['#', 'about:', 'data:', 'mailto:', 'javascript:', '{',
    '*']

  this.wb_setAttribute = $wbwindow.Element.prototype.setAttribute
  this.wb_getAttribute = $wbwindow.Element.prototype.getAttribute

  this.wb_rel_prefix = ''

  this.wb_wombat_updating = false

  this.message_listeners = new FuncMap()
  this.storage_listeners = new FuncMap()

  this.URL_PROPS = ['href', 'hash', 'pathname', 'host', 'hostname', 'protocol',
    'origin', 'search', 'port']

  // Globals
  this.wb_info = wbinfo
  // custom options
  this.wb_opts = wbinfo.wombat_opts
  this.wb_replay_prefix = wbinfo.prefix
  this.wb_is_proxy = (this.wb_info.proxy_magic || !this.wb_replay_prefix)

  this.wb_info.top_host = this.wb_info.top_host || '*'

  this.wb_curr_host = $wbwindow.location.protocol + '//' +
    $wbwindow.location.host

  this.wb_info.wombat_opts = this.wb_info.wombat_opts || {}

  this.wb_orig_scheme = this.wb_info.wombat_scheme + '://'
  this.wb_orig_origin = this.wb_orig_scheme + this.wb_info.wombat_host

  this.wb_abs_prefix = this.wb_replay_prefix

  if (!this.wb_info.is_live && this.wb_info.wombat_ts) {
    this.wb_capture_date_part = '/' + this.wb_info.wombat_ts + '/'
  } else {
    this.wb_capture_date_part = ''
  }

  this.BAD_PREFIXES = ['http:' + this.wb_replay_prefix,
    'https:' + this.wb_replay_prefix,
    'http:/' + this.wb_replay_prefix, 'https:/' + this.wb_replay_prefix]

  if (!this.wb_is_proxy) {
    var wb_origin = $wbwindow.__WB_replay_top.location.origin

    if (this.wb_replay_prefix &&
      this.wb_replay_prefix.indexOf(wb_origin) === 0) {
      this.wb_rel_prefix = this.wb_replay_prefix.substring(wb_origin.length)
    } else {
      this.wb_rel_prefix = this.wb_replay_prefix
    }
    var rx = '(' + wb_origin + ')?' + this.wb_rel_prefix + '[^/]+/'
    this.wb_unrewrite_rx = new RegExp(rx, 'g')
  }

  this.hostnamePortRe = /^[\w-]+(\.[\w-_]+)+(:\d+)(\/|$)/
  this.ipPortRe = /^\d+\.\d+\.\d+\.\d+(:\d+)?(\/|$)/
  this.workerBlobRe = /__WB_pmw\(.*?\)\.(?=postMessage\()/g

  this.STYLE_REGEX = /(url\s*\(\s*[\\"']*)([^)'"]+)([\\"']*\s*\))/gi
  this.IMPORT_REGEX = /(@import\s+[\\"']*)([^)'";]+)([\\"']*\s*;?)/gi
  this.no_wombatRe = /WB_wombat_/g
  this.srcsetRe = /\s*(\S*\s+[\d\.]+[wx]),|(?:\s*,(?:\s+|(?=https?:)))/
  this.write_buff = ''

  this.rewrite_url = this.rewrite_url_.bind(this)
}

/**
 * @param {boolean} use_rel
 * @param {?string} mod
 * @param {string} url
 * @return {string}
 */
Wombat.prototype.get_final_url = function get_final_url (use_rel, mod, url) {
  var prefix = use_rel ? this.wb_rel_prefix : this.wb_abs_prefix

  if (mod == null) {
    mod = this.wb_info.mod
  }

  // if live, don't add the timestamp
  if (!this.wb_info.is_live) {
    prefix += this.wb_info.wombat_ts
  }

  prefix += mod

  if (prefix[prefix.length - 1] !== '/') {
    prefix += '/'
  }

  return prefix + url
}

/**
 * @param {string} url
 * @param {Document} [doc]
 * @return {string}
 */
Wombat.prototype.resolve_rel_url = function resolve_rel_url (url, doc) {
  doc = doc || this.$wbwindow.document
  var parser = this.make_parser(doc.baseURI, doc)
  var href = parser.href
  var hash = href.lastIndexOf('#')

  if (hash >= 0) {
    href = href.substring(0, hash)
  }

  var lastslash = href.lastIndexOf('/')

  if (lastslash >= 0 && lastslash !== (href.length - 1)) {
    href = href.substring(0, lastslash + 1)
  }

  parser.href = href + url
  return parser.href
}

/**
 * @param {string|Object} href
 * @return {string}
 */
Wombat.prototype.extract_orig = function extract_orig (href) {
  if (!href) {
    return ''
  }

  var orig_href = href

  // proxy mode: no extraction needed
  if (this.wb_is_proxy) {
    return href
  }

  href = href.toString()

  // ignore certain urls
  if (this.starts_with(href, this.IGNORE_PREFIXES)) {
    return href
  }

  // if no coll, start from beginning, otherwise could be part of coll..
  var start = this.wb_rel_prefix ? 1 : 0

  var index = href.indexOf('/http', start)
  if (index < 0) {
    index = href.indexOf('///', start)
  }

  // extract original url from wburl
  if (index >= 0) {
    href = href.substr(index + 1)
  } else {
    index = href.indexOf(this.wb_replay_prefix)
    if (index >= 0) {
      href = href.substr(index + this.wb_replay_prefix.length)
    }
    if ((href.length > 4) &&
      (href.charAt(2) === '_') &&
      (href.charAt(3) === '/')) {
      href = href.substr(4)
    }

    if (href !== orig_href && !this.starts_with(href, this.VALID_PREFIXES)) {
      href = this.HTTP_PREFIX + href
    }
  }

  if (orig_href.charAt(0) === '/' &&
    orig_href.charAt(1) !== '/' &&
    this.starts_with(href, this.wb_orig_origin)) {
    href = href.substr(this.wb_orig_origin.length)
  }

  if (this.starts_with(href, this.REL_PREFIX)) {
    href = 'http:' + href
  }

  return href
}

/**
 * @param {string} href
 * @param {Document} doc
 * @return {HTMLAnchorElement}
 */
Wombat.prototype.make_parser = function make_parser (href, doc) {
  href = this.extract_orig(href)

  if (!doc) {
    // special case: for newly opened blank windows, use the opener
    // to create parser to have the proper baseURI
    if (this.$wbwindow.location.href === 'about:blank'
      && this.$wbwindow.opener) {
      doc = this.$wbwindow.opener.document
    } else {
      doc = this.$wbwindow.document
    }
  }

  var p = doc.createElement('a')
  p._no_rewrite = true
  p.href = href
  return p
}

/**
 * @param {string} str
 * @return {boolean}
 */
Wombat.prototype.is_host_url = function is_host_url (str) {
  // Good guess that's its a hostname
  if (str.indexOf('www.') === 0) {
    return true
  }

  // hostname:port (port required)
  var matches = str.match(this.hostnamePortRe)
  if (matches && (matches[0].length < 64)) {
    return true
  }

  // ip:port
  matches = str.match(this.ipPortRe)
  if (matches && (matches[0].length < 64)) {
    return true
  }

  return false
}

/**
 * @param {string} string
 * @param {string[] | string} arr_or_prefix
 * @return {?string}
 */
Wombat.prototype.starts_with = function starts_with (
  string, arr_or_prefix) {
  if (!string) { return undefined }

  if (arr_or_prefix instanceof Array) {
    for (var i = 0; i < arr_or_prefix.length; i++) {
      if (string.indexOf(arr_or_prefix[i]) === 0) {
        return arr_or_prefix[i]
      }
    }
  } else if (string.indexOf(arr_or_prefix) === 0) {
    return arr_or_prefix
  }

  return undefined
}

/**
 * @param {string} tagName
 * @param {string} attr
 * @return {boolean}
 */
Wombat.prototype.should_rewrite_attr = function should_rewrite_attr (
  tagName, attr) {
  if (attr === 'href' || attr === 'src') {
    return true
  }

  if (tagName === 'VIDEO' && attr === 'poster') {
    return true
  }

  return tagName === 'META' && attr === 'content'
}

/**
 * @param {string} str
 * @param {string} suffix
 * @return {?string}
 */
Wombat.prototype.ends_with = function ends_with (str, suffix) {
  if (str.indexOf(suffix, str.length - suffix.length) !== -1) {
    return suffix
  } else {
    return undefined
  }
}

/**
 * @param {Object} obj
 * @param {string} prop
 * @param {?function} set_func
 * @param {function} get_func
 * @param {boolean} [enumerable]
 * @return {boolean}
 */
Wombat.prototype.def_prop = function def_prop (
  obj, prop, set_func, get_func, enumerable) {
  // if the property is marked as non-configurable in the current
  // browser, skip the override
  var existingDescriptor = Object.getOwnPropertyDescriptor(obj,
    prop)
  if (existingDescriptor && !existingDescriptor.configurable) {
    return false
  }

  // if no getter function was supplied, skip the override.
  // See https://github.com/webrecorder/pywb/issues/147 for context
  if (!get_func) {
    return false
  }

  var descriptor = {
    configurable: true,
    enumerable: enumerable || false,
    get: get_func
  }

  if (set_func) {
    descriptor.set = set_func
  }

  try {
    Object.defineProperty(obj, prop, descriptor)
    return true
  } catch (e) {
    console.warn('Failed to redefine property %s', prop, e.message)
    return false
  }
}

Wombat.prototype.get_orig_getter = function get_orig_getter (obj, prop) {
  var orig_getter

  if (obj.__lookupGetter__) {
    orig_getter = obj.__lookupGetter__(prop)
  }

  if (!orig_getter && Object.getOwnPropertyDescriptor) {
    var props = Object.getOwnPropertyDescriptor(obj, prop)
    if (props) {
      orig_getter = props.get
    }
  }

  return orig_getter
}

Wombat.prototype.get_orig_setter = function get_orig_setter (obj, prop) {
  var orig_setter

  if (obj.__lookupSetter__) {
    orig_setter = obj.__lookupSetter__(prop)
  }

  if (!orig_setter && Object.getOwnPropertyDescriptor) {
    var props = Object.getOwnPropertyDescriptor(obj, prop)
    if (props) {
      orig_setter = props.set
    }
  }

  return orig_setter
}

Wombat.prototype.send_top_message = function send_top_message (
  message, skip_top_check) {
  if (!this.$wbwindow.__WB_top_frame) {
    return
  }

  if (!skip_top_check && this.$wbwindow !== this.$wbwindow.__WB_replay_top) {
    return
  }

  this.$wbwindow.__WB_top_frame.postMessage(message, this.wbinfo.top_host)
}

Wombat.prototype.send_history_update = function send_history_update (
  url, title) {
  this.send_top_message({
    'url': url,
    'ts': this.wb_info.timestamp,
    'request_ts': this.wb_info.request_ts,
    'is_live': this.wb_info.is_live,
    'title': title,
    'wb_type': 'replace-url'
  })
}

/**
 * @param {Node} elem
 * @param {function} func
 * @return {boolean}
 */
Wombat.prototype.watch_elem = function watch_elem (elem, func) {
  if (!this.$wbwindow.MutationObserver) {
    return false
  }
  var m = new this.$wbwindow.MutationObserver(function (records, observer) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i]
      if (r.type === 'childList') {
        for (var j = 0; j < r.addedNodes.length; j++) {
          func(r.addedNodes[j])
        }
      }
    }
  })

  m.observe(elem, {
    childList: true,
    subtree: true
  })
}

Wombat.prototype.update_location = function update_location (
  req_href, orig_href, actual_location, wombat_loc) {
  if (!req_href) {
    return
  }

  if (req_href === orig_href) {
    // Reset wombat loc to the unrewritten version
    //if (wombat_loc) {
    //    wombat_loc.href = extract_orig(orig_href);
    //}
    return
  }

  var ext_orig = this.extract_orig(orig_href)
  var ext_req = this.extract_orig(req_href)

  if (!ext_orig || ext_orig === ext_req) {
    return
  }

  var final_href = this.rewrite_url(req_href)

  console.log(actual_location.href + ' -> ' + final_href)

  actual_location.href = final_href
}

Wombat.prototype.check_location_change = function check_location_change (
  wombat_loc, is_top) {
  var locType = (typeof wombat_loc)

  var actual_location = (is_top
    ? this.$wbwindow.__WB_replay_top.location
    : this.$wbwindow.location)

  // String has been assigned to location, so assign it
  if (locType === 'string') {
    this.update_location(wombat_loc, actual_location.href, actual_location)

  } else if (locType === 'object') {
    this.update_location(wombat_loc.href,
      wombat_loc._orig_href,
      actual_location)
  }
}

Wombat.prototype.check_all_locations = function check_all_locations () {
  if (this.wb_wombat_updating) {
    return false
  }

  this.wb_wombat_updating = true

  this.check_location_change(this.$wbwindow.WB_wombat_location, false)

  // Only check top if its a different $wbwindow
  if (this.$wbwindow.WB_wombat_location !==
    this.$wbwindow.__WB_replay_top.WB_wombat_location) {
    this.check_location_change(
      this.$wbwindow.__WB_replay_top.WB_wombat_location, true)
  }

  //        lochash = $wbwindow.WB_wombat_location.hash;
  //
  //        if (lochash) {
  //            $wbwindow.location.hash = lochash;
  //
  //            //if ($wbwindow.top.update_wb_url) {
  //            //    $wbwindow.top.location.hash = lochash;
  //            //}
  //        }

  this.wb_wombat_updating = false
}

Wombat.prototype.proxy_to_obj = function proxy_to_obj (source) {
  try {
    return (source && source.__WBProxyRealObj__) || source
  } catch (e) {
    return source
  }
}

Wombat.prototype.obj_to_proxy = function obj_to_proxy (obj) {
  try {
    return (obj && obj._WB_wombat_obj_proxy) || obj
  } catch (e) {
    return obj
  }
}

Wombat.prototype.getAllOwnProps = function getAllOwnProps (obj) {
  var ownProps = []

  var props = Object.getOwnPropertyNames(obj)

  for (var i = 0; i < props.length; i++) {
    var prop = props[i]

    try {
      if (obj[prop] && !obj[prop].prototype) {
        ownProps.push(prop)
      }
    } catch (e) {}
  }

  obj = Object.getPrototypeOf(obj)

  while (obj) {
    props = Object.getOwnPropertyNames(obj)
    for (var i = 0; i < props.length; i++) {
      ownProps.push(props[i])
    }
    obj = Object.getPrototypeOf(obj)
  }

  return ownProps
}

Wombat.prototype.default_proxy_get = function default_proxy_get (
  obj, prop, ownProps) {
  if (prop === '__WBProxyRealObj__') {
    return obj
  } else if (prop === 'location') {
    return obj.WB_wombat_location
  } else if (prop === '_WB_wombat_obj_proxy') {
    return obj._WB_wombat_obj_proxy
  }

  var retVal = obj[prop]

  var type = (typeof retVal)

  if (type === 'function' && ownProps.indexOf(prop) !== -1) {
    return retVal.bind(obj)
  } else if (type === 'object' && retVal && retVal._WB_wombat_obj_proxy) {
    return retVal._WB_wombat_obj_proxy
  }

  return retVal
}

Wombat.prototype.set_loc = function set_loc (loc, orig_href) {
  var parser = this.make_parser(orig_href, loc.ownerDocument)

  loc._orig_href = orig_href
  loc._parser = parser

  var href = parser.href
  loc._hash = parser.hash

  loc._href = href

  loc._host = parser.host
  loc._hostname = parser.hostname

  if (parser.origin) {
    loc._origin = parser.origin
  } else {
    loc._origin = parser.protocol + '//' + parser.hostname + (parser.port ? ':' + parser.port : '')
  }

  loc._pathname = parser.pathname
  loc._port = parser.port
  //this.protocol = parser.protocol;
  loc._protocol = parser.protocol
  loc._search = parser.search

  if (!Object.defineProperty) {
    loc.href = href
    loc.hash = parser.hash

    loc.host = loc._host
    loc.hostname = loc._hostname
    loc.origin = loc._origin
    loc.pathname = loc._pathname
    loc.port = loc._port
    loc.protocol = loc._protocol
    loc.search = loc._search
  }
}

Wombat.prototype.make_get_loc_prop = function make_get_loc_prop (prop, orig_getter) {
  var wombat = this
  var getter = function getter () {
    if (this._no_rewrite) {
      return orig_getter.call(this, prop)
    }

    var curr_orig_href = orig_getter.call(this, 'href')

    if (prop === 'href') {
      return wombat.extract_orig(curr_orig_href)
    }

    if (this._orig_href !== curr_orig_href) {
      wombat.set_loc(this, curr_orig_href)
    }
    return this['_' + prop]
  }
  return getter
}

Wombat.prototype.make_set_loc_prop = function make_set_loc_prop (prop, orig_setter, orig_getter) {
  var wombat = this

  var setter = function setter (value) {
    if (this._no_rewrite) {
      orig_setter.call(this, prop, value)
      return
    }

    if (this['_' + prop] === value) {
      return
    }

    this['_' + prop] = value

    if (!this._parser) {
      var href = orig_getter.call(this)
      this._parser = wombat.make_parser(href, this.ownerDocument)
    }

    var rel = false

    //Special case for href="." assignment
    if (prop === 'href' && typeof(value) === 'string') {
      if (value) {
        if (value[0] === '.') {
          value = wombat.resolve_rel_url(value, this.ownerDocument)
        } else if (value[0] === '/' && (value.length <= 1 || value[1] !== '/')) {
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
      orig_setter.call(this, 'hash', value)
    } else {
      rel = rel || (value === this._parser.pathname)
      value = wombat.rewrite_url(this._parser.href, rel)
      orig_setter.call(this, 'href', value)
    }
  }

  return setter
}

/**
 * @param {?string | ?Object} url
 * @param {boolean} use_rel
 * @param {string} mod
 * @return {?string}
 * @private
 */
Wombat.prototype.rewrite_url_ = function rewrite_url_ (url, use_rel, mod) {
  // If undefined, just return it
  if (!url) {
    return url
  }

  var urltype_ = (typeof url)

  // If object, use toString
  if (urltype_ === 'object') {
    url = url.toString()
  } else if (urltype_ !== 'string') {
    return url
  }

  // proxy mode: If no wb_replay_prefix, only rewrite scheme
  if (this.wb_is_proxy) {
    if (this.wb_orig_scheme === this.HTTP_PREFIX &&
      this.starts_with(url, this.HTTPS_PREFIX)) {
      return this.HTTP_PREFIX + url.substr(this.HTTPS_PREFIX.length)
    } else if (this.wb_orig_scheme === this.HTTPS_PREFIX &&
      this.starts_with(url, this.HTTP_PREFIX)) {
      return this.HTTPS_PREFIX + url.substr(this.HTTP_PREFIX.length)
    } else {
      return url
    }
  }

  // just in case wombat reference made it into url!
  url = url.replace('WB_wombat_', '')

  // ignore anchors, about, data
  if (this.starts_with(url, this.IGNORE_PREFIXES)) {
    return url
  }

  // OPTS: additional ignore prefixes
  if (this.wb_opts.no_rewrite_prefixes &&
    this.starts_with(url, this.wb_opts.no_rewrite_prefixes)) {
    return url
  }

  // If starts with prefix, no rewriting needed
  // Only check replay prefix (no date) as date may be different for each
  // capture

  // if scheme relative, prepend current scheme
  var check_url

  if (url.indexOf('//') === 0) {
    check_url = window.location.protocol + url
  } else {
    check_url = url
  }

  if (this.starts_with(check_url, this.wb_replay_prefix) ||
    this.starts_with(check_url, this.$wbwindow.location.origin +
      this.wb_replay_prefix)) {
    return url
  }

  // A special case where the port somehow gets dropped
  // Check for this and add it back in, eg http://localhost/path/ -> http://localhost:8080/path/
  if (this.$wbwindow.location.host !== this.$wbwindow.location.hostname) {
    if (this.starts_with(url, this.$wbwindow.location.protocol + '//' +
      this.$wbwindow.location.hostname + '/')) {
      url = url.replace('/' + this.$wbwindow.location.hostname + '/', '/' +
        this.$wbwindow.location.host + '/')
      return url
    }
  }

  // If server relative url, add prefix and original host
  if (url.charAt(0) === '/' && !this.starts_with(url, this.REL_PREFIX)) {

    // Already a relative url, don't make any changes!
    if (this.wb_capture_date_part &&
      url.indexOf(this.wb_capture_date_part) >= 0) {
      return url
    }

    // relative collection
    if ((url.indexOf(this.wb_rel_prefix) === 0) && (url.indexOf('http') > 1)) {
      var scheme_sep = url.indexOf(':/')
      if (scheme_sep > 0 && url[scheme_sep + 2] !== '/') {
        url = url.substring(0, scheme_sep + 2) + '/' +
          url.substring(scheme_sep + 2)
      }
      return url
    }

    return this.get_final_url(true, mod, this.wb_orig_origin + url)
  }

  // Use a parser
  if (url.charAt(0) === '.') {
    url = this.resolve_rel_url(url)
  }

  // If full url starting with http://, https:// or //
  // add rewrite prefix
  var prefix = this.starts_with(url, this.VALID_PREFIXES)

  if (prefix) {
    var orig_host = this.$wbwindow.__WB_replay_top.location.host
    var orig_protocol = this.$wbwindow.__WB_replay_top.location.protocol

    var prefix_host = prefix + orig_host + '/'

    // if already rewritten url, must still check scheme
    if (this.starts_with(url, prefix_host)) {
      if (this.starts_with(url, this.wb_replay_prefix)) {
        return url
      }

      var curr_scheme = orig_protocol + '//'
      var path = url.substring(prefix_host.length)
      var rebuild = false

      if (path.indexOf(this.wb_rel_prefix) < 0 && url.indexOf('/static/') < 0) {
        path = this.get_final_url(true, mod, this.WB_wombat_location.origin +
          '/' + path)
        rebuild = true
      }

      // replace scheme to ensure using the correct server scheme
      //if (starts_with(url, wb_orig_scheme) && (wb_orig_scheme != curr_scheme)) {
      if (prefix !== curr_scheme && prefix !== this.REL_PREFIX) {
        rebuild = true
      }

      if (rebuild) {
        if (!use_rel) {
          url = curr_scheme + orig_host
        } else {
          url = ''
        }
        if (path && path[0] !== '/') {
          url += '/'
        }
        url += path
      }

      return url
    }
    return this.get_final_url(use_rel, mod, url)
  }

  // Check for common bad prefixes and remove them
  prefix = this.starts_with(url, this.BAD_PREFIXES)

  if (prefix) {
    url = this.extract_orig(url)
    return this.get_final_url(use_rel, mod, url)
  }

  // May or may not be a hostname, call function to determine
  // If it is, add the prefix and make sure port is removed
  if (this.is_host_url(url) &&
    !this.starts_with(url, this.$wbwindow.location.host + '/')) {
    return this.get_final_url(use_rel, mod, this.wb_orig_scheme + url)
  }

  return url
}

/**
 * @param {?string | ?Object} url
 * @param {boolean} use_rel
 * @param {string} mod
 * @return {?string}
 * @private
 */
Wombat.prototype.rewrite_url_degug = function rewrite_url_debug (
  url, use_rel, mod) {
  var rewritten = this.rewrite_url_(url, use_rel, mod)
  if (url !== rewritten) {
    console.log('REWRITE: ' + url + ' -> ' + rewritten)
  } else {
    console.log('NOT REWRITTEN ' + url)
  }
  return rewritten
}

Wombat.prototype.rewrite_blob = function rewrite_blob (url) {
  // use sync ajax request to get the contents, remove postMessage() rewriting
  var x = new XMLHttpRequest()
  x.open('GET', url, false)
  x.send()

  var resp = x.responseText.replace(this.workerBlobRe, '')

  if (this.wb_info.static_prefix || this.wb_info.ww_rw_script) {
    var ww_rw = this.wb_info.ww_rw_script || this.wb_info.static_prefix + 'ww_rw.js'
    var rw = '(function() { ' +
      'self.importScripts(\'' + ww_rw + '\');' +

      'new WBWombat({\'prefix\': \'' + this.wb_abs_prefix + this.wb_info.mod + '/\'}); ' +

      '})();'
    resp = rw + resp
  }

  if (resp !== x.responseText) {
    return URL.createObjectURL(new Blob([resp], {'type': 'text/javascript'}))
  } else {
    return url
  }
}

Wombat.prototype.rewrite_attr = function rewrite_attr (elem, name, abs_url_only) {
  if (!elem || !elem.getAttribute) {
    return
  }

  if (elem._no_rewrite) {
    return
  }

  // already overwritten
  if (elem['_' + name]) {
    return
  }

  var value = this.wb_getAttribute.call(elem, name)

  if (!value || this.starts_with(value, 'javascript:')) {
    return
  }

  var new_value

  if (name === 'style') {
    new_value = this.rewrite_style(value)
  } else if (name === 'srcset') {
    new_value = this.rewrite_srcset(value)
  } else {
    // Only rewrite if absolute url
    if (abs_url_only && !this.starts_with(value, this.VALID_PREFIXES)) {
      return
    }

    var mod = undefined

    if (elem.tagName === 'SCRIPT') {
      mod = 'js_'
    }
    new_value = this.rewrite_url(value, false, mod)
  }

  if (new_value != value) {
    this.wb_setAttribute.call(elem, name, new_value)
    return true
  }
}

Wombat.prototype.style_replacer = function style_replacer (match, n1, n2, n3, offset, string) {
  return n1 + this.rewrite_url(n2) + n3
}

Wombat.prototype.rewrite_style = function rewrite_style (value) {
  if (!value) {
    return value
  }

  if (typeof(value) === 'object') {
    value = value.toString()
  }

  if (typeof(value) === 'string') {
    value = value.replace(this.STYLE_REGEX, this.style_replacer)
    value = value.replace(this.IMPORT_REGEX, this.style_replacer)
    value = value.replace(this.no_wombatRe, '')
  }

  return value
}

Wombat.prototype.rewrite_srcset = function rewrite_srcset (value) {
  if (!value) {
    return ''
  }
  // Filter removes non-truthy values like null, undefined, and ""
  var values = value.split(this.srcsetRe).filter(Boolean)

  for (var i = 0; i < values.length; i++) {
    values[i] = this.rewrite_url(values[i].trim())
  }

  return values.join(', ')
}

Wombat.prototype.rewrite_frame_src = function rewrite_frame_src (elem, name) {
  var value = this.wb_getAttribute.call(elem, name)
  var new_value = undefined

  // special case for rewriting javascript: urls that contain WB_wombat_
  // must insert wombat init first!
  if (this.starts_with(value, 'javascript:')) {
    if (value.indexOf('WB_wombat_') >= 0) {
      var JS = 'javascript:'
      new_value = JS
      new_value += 'window.parent._wb_wombat.init_new_window_wombat(window);'
      new_value += value.substr(JS.length)
    }
  }

  if (!new_value) {
    new_value = this.rewrite_url(value, false)
  }

  if (new_value !== value) {
    this.wb_setAttribute.call(elem, name, new_value)
    return true
  }

  return false
}

Wombat.prototype.rewrite_script = function rewrite_script (elem) {
  if (elem.getAttribute('src') || !elem.textContent || !this.$wbwindow.Proxy) {
    return this.rewrite_attr(elem, 'src')
  }

  if (elem.textContent.indexOf('_____WB$wombat$assign$function_____') >= 0) {
    return false
  }

  var text = elem.textContent.trim()

  if (!text || text.indexOf('<') === 0) {
    return false
  }

  var override_props = ['window', 'self', 'document', 'location', 'top',
    'parent', 'frames', 'opener']

  var contains_props = false

  for (var i = 0; i < override_props.length; i++) {
    if (text.indexOf(override_props[i]) >= 0) {
      contains_props = true
      break
    }
  }

  if (!contains_props) {
    return false
  }

  var insert_str =
    'var _____WB$wombat$assign$function_____ = function(name) {return (self._wb_wombat && self._wb_wombat.local_init && self._wb_wombat.local_init(name)) || self[name]; }\n' +
    'if (!self.__WB_pmw) { self.__WB_pmw = function(obj) { return obj; } }\n' +
    '{\n'

  var prop

  for (i = 0; i < override_props.length; i++) {
    prop = override_props[i]
    insert_str += 'let ' + prop + ' = _____WB$wombat$assign$function_____("' + prop + '");\n'
  }

  var content = elem.textContent.replace(/(.postMessage\s*\()/, '.__WB_pmw(self.window)$1')
  elem.textContent = insert_str + content + '\n\n}'
  return true
}

Wombat.prototype.rewrite_elem = function rewrite_elem (elem) {
  if (!elem) {
    return
  }

  var changed

  if (elem.tagName === 'STYLE') {
    var new_content = this.rewrite_style(elem.textContent)
    if (elem.textContent !== new_content) {
      elem.textContent = new_content
      changed = true
    }
  } else if (elem.tagName === 'OBJECT') {
    changed = this.rewrite_attr(elem, 'data', true)
  } else if (elem.tagName === 'FORM') {
    changed = this.rewrite_attr(elem, 'action', true)
    //} else if (elem.tagName == "INPUT") {
    //    changed = rewrite_attr(elem, "value", true);
  } else if (elem.tagName === 'IFRAME' || elem.tagName === 'FRAME') {
    changed = this.rewrite_frame_src(elem, 'src')
  } else if (elem.tagName === 'SCRIPT') {
    changed = this.rewrite_script(elem)
  } else if (elem.tagName === 'image') {
    changed = this.rewrite_attr(elem, 'xlink:href')
  } else {
    changed = this.rewrite_attr(elem, 'src')
    changed = this.rewrite_attr(elem, 'srcset') || changed
    changed = this.rewrite_attr(elem, 'href') || changed
    changed = this.rewrite_attr(elem, 'style') || changed
    changed = this.rewrite_attr(elem, 'poster') || changed
  }

  if (elem.getAttribute) {
    if (elem.getAttribute('crossorigin')) {
      elem.removeAttribute('crossorigin')
      changed = true
    }

    if (elem.getAttribute('integrity')) {
      elem.removeAttribute('integrity')
      changed = true
    }
  }

  return changed
}

Wombat.prototype.rewrite_html = function rewrite_html (string, check_end_tag) {
  if (!string) {
    return string
  }

  if (typeof string !== 'string') {
    string = string.toString()
  }

  if (this.write_buff) {
    string = this.write_buff + string
    this.write_buff = ''
  }

  if (string.indexOf('<script') <= 0) {
    //string = string.replace(/WB_wombat_/g, "");
    string = string.replace(/((id|class)=".*)WB_wombat_([^"]+)/, '$1$3')
  }

  if (!this.$wbwindow.HTMLTemplateElement
    || this.starts_with(string, ['<html', '<head', '<body'])) {
    return this.rewrite_html_full(string, check_end_tag)
  }

  var inner_doc = new DOMParser().parseFromString('<template>' + string + '</template>', 'text/html')

  if (!inner_doc || !inner_doc.head || !inner_doc.head.children || !inner_doc.head.children[0].content) {
    return string
  }

  var template = inner_doc.head.children[0]

  if (this.recurse_rewrite_elem(template.content)) {
    template._no_rewrite = true
    var new_html = template.innerHTML

    if (check_end_tag) {
      var first_elem = template.content.children && template.content.children[0]
      if (first_elem) {
        var end_tag = '</' + first_elem.tagName.toLowerCase() + '>'
        if (this.ends_with(new_html, end_tag) && !this.ends_with(string, end_tag)) {
          new_html = new_html.substring(0, new_html.length - end_tag.length)
        }
      } else if (string[0] !== '<' || string[string.length - 1] !== '>') {
        this.write_buff += string
        return
      }
    }
    return new_html
  }

  return string
}

Wombat.prototype.rewrite_html_full = function rewrite_html_full (string, check_end_tag) {
  var inner_doc = new DOMParser().parseFromString(string, 'text/html')

  if (!inner_doc) {
    return string
  }

  var changed = false

  for (var i = 0; i < inner_doc.all.length; i++) {
    changed = this.rewrite_elem(inner_doc.all[i]) || changed
  }

  if (changed) {
    var new_html

    // if original had <html> tag, add full document HTML
    if (string && string.indexOf('<html') >= 0) {
      inner_doc.documentElement._no_rewrite = true
      new_html = inner_doc.documentElement.outerHTML
    } else {
      // otherwise, just add contents of head and body
      inner_doc.head._no_rewrite = true
      inner_doc.body._no_rewrite = true

      new_html = inner_doc.head.innerHTML
      new_html += inner_doc.body.innerHTML

      if (check_end_tag) {
        if (inner_doc.all.length > 3) {
          var end_tag = '</' + inner_doc.all[3].tagName.toLowerCase() + '>'
          if (this.ends_with(new_html, end_tag)
            && !this.ends_with(string, end_tag)) {
            new_html = new_html.substring(0, new_html.length - end_tag.length)
          }
        } else if (string[0] !== '<' || string[string.length - 1] !== '>') {
          this.write_buff += string
          return
        }
      }
    }

    return new_html
  }

  return string
}

Wombat.prototype.rewrite_inline_style = function rewrite_inline_style (orig) {
  var decoded

  try {
    decoded = decodeURIComponent(orig)
  } catch (e) {
    decoded = orig
  }

  var val
  if (decoded !== orig) {
    val = this.rewrite_style(decoded)
    var parts = val.split(',', 2)
    val = parts[0] + ',' + encodeURIComponent(parts[1])
  } else {
    val = this.rewrite_style(orig)
  }

  return val
}

Wombat.prototype.recurse_rewrite_elem = function recurse_rewrite_elem (curr) {
  var changed = false

  var children = curr && (curr.children || curr.childNodes);

  if (children) {
    for (var i = 0; i < children.length; i++) {
      if (children[i].nodeType === Node.ELEMENT_NODE) {
        changed = this.rewrite_elem(children[i]) || changed
        changed = this.recurse_rewrite_elem(children[i]) || changed
      }
    }
  }

  return changed
}

Wombat.prototype.override_attr_props = function override_attr_props () {
  var wombat = this

  function is_rw_attr (attr) {
    if (!attr) {
      return false
    }

    var tagName = attr.ownerElement && attr.ownerElement.tagName

    return wombat.should_rewrite_attr(tagName, attr.nodeName)
  }

  this.override_prop_extract(this.$wbwindow.Attr.prototype, 'nodeValue', is_rw_attr)
  this.override_prop_extract(this.$wbwindow.Attr.prototype, 'value', is_rw_attr)
}

Wombat.prototype.override_attr = function override_attr (obj, attr, mod, default_to_setget) {
  var orig_getter = this.get_orig_getter(obj, attr)
  var orig_setter = this.get_orig_setter(obj, attr)

  var wombat = this

  var setter = function (orig) {
    var val

    if (mod === 'cs_' && orig.indexOf('data:text/css') == 0) {
      val = wombat.rewrite_inline_style(orig)
    } else if (attr === 'srcset') {
      val = wombat.rewrite_srcset(orig)
    } else {
      val = wombat.rewrite_url(orig, false, mod)
    }

    if (orig_setter) {
      return orig_setter.call(this, val)
    } else if (default_to_setget) {
      return wombat.wb_setAttribute.call(this, attr, val)
    }
  }

  var getter = function () {
    var res = undefined

    if (orig_getter) {
      res = orig_getter.call(this)
    } else if (default_to_setget) {
      res = wombat.wb_getAttribute.call(this, attr)
    }
    res = wombat.extract_orig(res)

    return res
  }

  this.def_prop(obj, attr, setter, getter)
}

Wombat.prototype.override_prop_extract = function override_prop_extract (
  proto, prop, cond) {
  var orig_getter = this.get_orig_getter(proto, prop)
  var wombat = this
  if (orig_getter) {
    var new_getter = function () {
      var obj = wombat.proxy_to_obj(this)
      var res = orig_getter.call(obj)
      if (!cond || cond(obj)) {
        res = wombat.extract_orig(res)
      }
      return res
    }

    this.def_prop(proto, prop, undefined, new_getter)
  }
}

Wombat.prototype.override_prop_to_proxy = function override_prop_to_proxy (proto, prop) {
  var orig_getter = this.get_orig_getter(proto, prop)

  if (orig_getter) {
    var wombat = this

    function new_getter () {
      return wombat.obj_to_proxy(orig_getter.call(this))
    }

    this.def_prop(proto, prop, undefined, new_getter)
  }
}

Wombat.prototype.override_history_func = function override_history_func (func_name) {
  if (!this.$wbwindow.history) {
    return
  }

  var orig_func = this.$wbwindow.history[func_name]

  if (!orig_func) {
    return
  }

  this.$wbwindow.history['_orig_' + func_name] = orig_func
  var wombat = this

  function rewritten_func (state_obj, title, url) {
    var rewritten_url = undefined

    if (url) {
      var parser = wombat.$wbwindow.document.createElement('a')
      parser.href = url
      url = parser.href

      rewritten_url = wombat.rewrite_url(url)

      if (url && (url !== wombat.$wbwindow.WB_wombat_location.origin
        && wombat.$wbwindow.WB_wombat_location.href !== 'about:blank') &&
        !wombat.starts_with(url, wombat.$wbwindow.WB_wombat_location.origin +
          '/')) {
        throw new DOMException('Invalid history change: ' + url)
      }
    } else {
      url = wombat.$wbwindow.WB_wombat_location.href
    }

    orig_func.call(this, state_obj, title, rewritten_url)

    wombat.send_history_update(url, title)
  }

  this.$wbwindow.history[func_name] = rewritten_func
  if (this.$wbwindow.History && this.$wbwindow.History.prototype) {
    this.$wbwindow.History.prototype[func_name] = rewritten_func
  }

  return rewritten_func
}

Wombat.prototype.override_style_attr = function override_style_attr (obj, attr, prop_name) {
  var orig_getter = this.get_orig_getter(obj, attr)
  var orig_setter = this.get_orig_setter(obj, attr)

  var wombat = this

  var setter = function (orig) {
    var val = wombat.rewrite_style(orig)
    if (orig_setter) {
      orig_setter.call(this, val)
    } else {
      this.setProperty(prop_name, val)
    }

    return val
  }

  var getter = orig_getter

  if (!getter) {
    getter = function () {
      return this.getPropertyValue(prop_name)
    }
  }

  if ((orig_setter && orig_getter) || prop_name) {
    this.def_prop(obj, attr, setter, getter)
  }
}

Wombat.prototype.init_seeded_random = function init_seeded_random (seed) {
  // Adapted from:
  // http://indiegamr.com/generate-repeatable-random-numbers-in-js/

  this.$wbwindow.Math.seed = parseInt(seed)
  var self = this

  function seeded_random () {
    self.$wbwindow.Math.seed = (self.$wbwindow.Math.seed * 9301 + 49297) %
      233280
    return self.$wbwindow.Math.seed / 233280
  }

  this.$wbwindow.Math.random = seeded_random
}

Wombat.prototype.init_crypto_random = function init_crypto_random () {
  if (!this.$wbwindow.crypto || !this.$wbwindow.Crypto) {
    return
  }

  var orig_getrandom = this.$wbwindow.Crypto.prototype.getRandomValues
  var self = this
  var new_getrandom = function (array) {
    for (var i = 0; i < array.length; i++) {
      array[i] = parseInt(self.$wbwindow.Math.random() * 4294967296)
    }
    return array
  }

  this.$wbwindow.Crypto.prototype.getRandomValues = new_getrandom
  this.$wbwindow.crypto.getRandomValues = new_getrandom
}

Wombat.prototype.init_fixed_ratio = function init_fixed_ratio () {
  // otherwise, just set it
  this.$wbwindow.devicePixelRatio = 1

  // prevent changing, if possible
  if (Object.defineProperty) {
    try {
      // fixed pix ratio
      Object.defineProperty(this.$wbwindow, 'devicePixelRatio',
        {value: 1, writable: false})
    } catch (e) { }
  }
}

Wombat.prototype.init_history_overrides = function init_history_overrides () {
  this.override_history_func('pushState')
  this.override_history_func('replaceState')
  var wombat = this
  this.$wbwindow.addEventListener('popstate', function (event) {
    wombat.send_history_update(wombat.$wbwindow.WB_wombat_location.href,
      wombat.$wbwindow.document.title)
  })
}

Wombat.prototype.init_doc_title_override = function init_doc_title_override () {
  var orig_get_title = this.get_orig_getter(this.$wbwindow.document, 'title')
  var orig_set_title = this.get_orig_setter(this.$wbwindow.document, 'title')

  var wombat = this

  function set_title (value) {
    var res = orig_set_title.call(this, value)

    var message = {
      'wb_type': 'title',
      'title': value
    }

    wombat.send_top_message(message)

    return res
  }

  this.def_prop(this.$wbwindow.document, 'title', set_title, orig_get_title)
}

Wombat.prototype.init_ajax_rewrite = function init_ajax_rewrite () {
  if (!this.$wbwindow.XMLHttpRequest ||
    !this.$wbwindow.XMLHttpRequest.prototype ||
    !this.$wbwindow.XMLHttpRequest.prototype.open) {
    return
  }

  var orig = this.$wbwindow.XMLHttpRequest.prototype.open

  var wombat = this

  function open_rewritten (method, url, async, user, password) {
    if (!this._no_rewrite) {
      url = wombat.rewrite_url(url)
    }

    // defaults to true
    if (async !== false) {
      async = true
    }

    var result = orig.call(this, method, url, async, user, password)
    if (!wombat.starts_with(url, 'data:')) {
      this.setRequestHeader('X-Pywb-Requested-With', 'XMLHttpRequest')
    }
  }

  // attempt to hide our override
  open_rewritten.toString = orig.toString.bind(orig)

  this.$wbwindow.XMLHttpRequest.prototype.open = open_rewritten

  // responseURL override
  this.override_prop_extract(this.$wbwindow.XMLHttpRequest.prototype,
    'responseURL')
}

Wombat.prototype.init_fetch_rewrite = function init_fetch_rewrite () {
  if (!this.$wbwindow.fetch) {
    return
  }

  var orig_fetch = this.$wbwindow.fetch

  var wombat = this
  this.$wbwindow.fetch = function (input, init_opts) {
    var inputType = typeof(input)
    if (inputType === 'string') {
      input = wombat.rewrite_url(input)
    } else if (inputType === 'object' && input.url) {
      var new_url = wombat.rewrite_url(input.url)
      if (new_url !== input.url) {
        input = new Request(new_url, input)
      }
    } else if (inputType === 'object' && input.href) {
      // it is likely that input is either window.location or window.URL
      input = wombat.rewrite_url(input.href)
    }

    init_opts = init_opts || {}
    init_opts['credentials'] = 'include'

    return orig_fetch.call(wombat.proxy_to_obj(this), input, init_opts)
  }
  // attempt to hide our override
  this.$wbwindow.fetch.toString = orig_fetch.toString.bind(orig_fetch)
}

Wombat.prototype.init_request_override = function init_request_override () {
  var orig_request = this.$wbwindow.Request

  if (!orig_request) {
    return
  }
  var womabt = this
  this.$wbwindow.Request = (function (Request) {
    return function (input, init_opts) {
      if (typeof(input) === 'string') {
        input = womabt.rewrite_url(input)
      } else if (typeof(input) === 'object' && input.url) {
        var new_url = womabt.rewrite_url(input.url)

        if (new_url !== input.url) {
          //    input = new Request(new_url, input);
          input.url = new_url
        }
      }

      init_opts = init_opts || {}
      init_opts['credentials'] = 'include'

      return new Request(input, init_opts)
    }

  })(this.$wbwindow.Request)

  this.$wbwindow.Request.prototype = orig_request.prototype
}

Wombat.prototype.init_setAttribute_override = function init_setAttribute_override () {
  if (!this.$wbwindow.Element ||
    !this.$wbwindow.Element.prototype ||
    !this.$wbwindow.Element.prototype.setAttribute) {
    return
  }

  var orig_setAttribute = this.$wbwindow.Element.prototype.setAttribute
  this.wb_setAttribute = orig_setAttribute

  this.$wbwindow.Element.prototype._orig_setAttribute = orig_setAttribute
  var wombat = this
  this.$wbwindow.Element.prototype.setAttribute = function setAttribute (name, value) {
    if (name && typeof(value) === 'string') {
      var lowername = name.toLowerCase()

      if (this.tagName === 'LINK'
        && lowername === 'href'
        && value.indexOf('data:text/css') === 0) {
        value = wombat.rewrite_inline_style(value)

      } else if (wombat.should_rewrite_attr(this.tagName, lowername)) {
        if (!this._no_rewrite) {
          var old_value = value

          var mod = undefined
          if (this.tagName === 'SCRIPT') {
            mod = 'js_'
          }
          value = wombat.rewrite_url(value, false, mod)
        }
      } else if (lowername === 'style') {
        value = wombat.rewrite_style(value)
      } else if (lowername === 'srcset') {
        value = wombat.rewrite_srcset(value)
      }
    }
    orig_setAttribute.call(this, name, value)
  }
}

Wombat.prototype.init_getAttribute_override = function init_getAttribute_override () {
  if (!this.$wbwindow.Element ||
    !this.$wbwindow.Element.prototype ||
    !this.$wbwindow.Element.prototype.setAttribute) {
    return
  }

  var orig_getAttribute = this.$wbwindow.Element.prototype.getAttribute
  this.wb_getAttribute = orig_getAttribute
  var wombat = this
  this.$wbwindow.Element.prototype.getAttribute = function (name) {
    var result = orig_getAttribute.call(this, name)

    if (wombat.should_rewrite_attr(this.tagName, name)) {
      result = wombat.extract_orig(result)
    } else if (wombat.starts_with(name, 'data-') && wombat.starts_with(result, wombat.VALID_PREFIXES)) {
      result = wombat.extract_orig(result)
    }

    return result
  }

}

Wombat.prototype.init_svg_image_overrides = function init_svg_image_overrides () {
  if (!this.$wbwindow.SVGImageElement) {
    return
  }

  var orig_getAttr = this.$wbwindow.SVGImageElement.prototype.getAttribute
  var orig_getAttrNS = this.$wbwindow.SVGImageElement.prototype.getAttributeNS
  var orig_setAttr = this.$wbwindow.SVGImageElement.prototype.setAttribute
  var orig_setAttrNS = this.$wbwindow.SVGImageElement.prototype.setAttributeNS
  var wombat = this
  this.$wbwindow.SVGImageElement.prototype.getAttribute = function getAttribute (name) {
    var value = orig_getAttr.call(this, name)

    if (name.indexOf('xlink:href') >= 0 || name === 'href') {
      value = wombat.extract_orig(value)
    }

    return value
  }

  this.$wbwindow.SVGImageElement.prototype.getAttributeNS = function getAttributeNS (ns, name) {
    var value = orig_getAttrNS.call(this, ns, name)

    if (name === 'href') {
      value = wombat.extract_orig(value)
    }

    return value
  }

  this.$wbwindow.SVGImageElement.prototype.setAttribute = function setAttribute (name, value) {
    if (name.indexOf('xlink:href') >= 0 || name === 'href') {
      value = wombat.rewrite_url(value)
    }

    return orig_setAttr.call(this, name, value)
  }

  this.$wbwindow.SVGImageElement.prototype.setAttributeNS = function setAttributeNS (ns, name, value) {
    if (name === 'href') {
      value = womabat.rewrite_url(value)
    }

    return orig_setAttrNS.call(this, ns, name, value)
  }
}

Wombat.prototype.init_createElementNS_fix = function init_createElementNS_fix () {
  if (!this.$wbwindow.document.createElementNS ||
    !this.$wbwindow.Document.prototype.createElementNS) {
    return
  }
  var orig_createElementNS = this.$wbwindow.document.createElementNS
  var wombat = this

  function createElementNS_fix (namespaceURI, qualifiedName) {
    namespaceURI = wombat.extract_orig(namespaceURI)
    return orig_createElementNS.call(this, namespaceURI, qualifiedName)
  }

  this.$wbwindow.Document.prototype.createElementNS = createElementNS_fix
  this.$wbwindow.document.createElementNS = createElementNS_fix
}

Wombat.prototype.init_date_override = function init_date_override (timestamp) {
  if (this.$wbwindow.__wb_Date_now) {
    return
  }
  timestamp = parseInt(timestamp) * 1000
  //var timezone = new Date().getTimezoneOffset() * 60 * 1000;
  // Already UTC!
  var timezone = 0
  var start_now = this.$wbwindow.Date.now()
  var timediff = start_now - (timestamp - timezone)

  var orig_date = this.$wbwindow.Date

  var orig_utc = this.$wbwindow.Date.UTC
  var orig_parse = this.$wbwindow.Date.parse
  var orig_now = this.$wbwindow.Date.now

  this.$wbwindow.__wb_Date_now = orig_now

  this.$wbwindow.Date = (function (Date) {
    return function (A, B, C, D, E, F, G) {
      // Apply doesn't work for constructors and Date doesn't
      // seem to like undefined args, so must explicitly
      // call constructor for each possible args 0..7
      if (A === undefined) {
        return new Date(orig_now() - timediff)
      } else if (B === undefined) {
        return new Date(A)
      } else if (C === undefined) {
        return new Date(A, B)
      } else if (D === undefined) {
        return new Date(A, B, C)
      } else if (E === undefined) {
        return new Date(A, B, C, D)
      } else if (F === undefined) {
        return new Date(A, B, C, D, E)
      } else if (G === undefined) {
        return new Date(A, B, C, D, E, F)
      } else {
        return new Date(A, B, C, D, E, F, G)
      }
    }
  })(this.$wbwindow.Date)

  this.$wbwindow.Date.prototype = orig_date.prototype

  this.$wbwindow.Date.now = function now () {
    return orig_now() - timediff
  }

  this.$wbwindow.Date.UTC = orig_utc
  this.$wbwindow.Date.parse = orig_parse

  this.$wbwindow.Date.__WB_timediff = timediff

  Object.defineProperty(this.$wbwindow.Date.prototype, 'constructor', {value: this.$wbwindow.Date})
}

Wombat.prototype.init_audio_override = function init_audio_override () {
  if (!this.$wbwindow.Audio) {
    return
  }

  var orig_audio = this.$wbwindow.Audio
  var wombat = this
  this.$wbwindow.Audio = (function (Audio) {
    return function (url) {
      return new Audio(wombat.rewrite_url(url))
    }

  })(this.$wbwindow.Audio)

  this.$wbwindow.Audio.prototype = orig_audio.prototype
  Object.defineProperty(this.$wbwindow.Audio.prototype, 'constructor', {value: this.$wbwindow.Audio})
}

Wombat.prototype.init_web_worker_override = function init_web_worker_override () {
  if (!this.$wbwindow.Worker) {
    return
  }

  // for now, disabling workers until override of worker content can be supported
  // hopefully, pages depending on workers will have a fallback
  //$wbwindow.Worker = undefined;

  // Worker unrewrite postMessage
  var orig_worker = this.$wbwindow.Worker
  var wombat = this
  this.$wbwindow.Worker = (function (Worker) {
    return function (url) {
      if (wombat.starts_with(url, 'blob:')) {
        url = wombat.rewrite_blob(url)
      }
      return new Worker(url)
    }

  })(this.$wbwindow.Worker)

  this.$wbwindow.Worker.prototype = orig_worker.prototype
}

Wombat.prototype.init_service_worker_override = function init_service_worker_override () {
  if (!this.$wbwindow.ServiceWorkerContainer ||
    !this.$wbwindow.ServiceWorkerContainer.prototype ||
    !this.$wbwindow.ServiceWorkerContainer.prototype.register) {
    return
  }
  var orig_register = this.$wbwindow.ServiceWorkerContainer.prototype.register
  var wombat = this
  this.$wbwindow.ServiceWorkerContainer.prototype.register = function register (scriptURL, options) {
    scriptURL = wombat.rewrite_url(scriptURL, false, 'id_')
    if (options && options.scope) {
      options.scope = wombat.rewrite_url(options.scope, false, 'id_')
    }
    return orig_register.call(this, scriptURL, options)
  }
}

Wombat.prototype.init_attr_overrides = function init_attr_overrides () {
  this.override_attr(this.$wbwindow.HTMLLinkElement.prototype, 'href', 'cs_')
  this.override_attr(this.$wbwindow.CSSStyleSheet.prototype, 'href', 'cs_')
  this.override_attr(this.$wbwindow.HTMLImageElement.prototype, 'src', 'im_')
  this.override_attr(this.$wbwindow.HTMLImageElement.prototype, 'srcset', 'im_')
  this.override_attr(this.$wbwindow.HTMLIFrameElement.prototype, 'src', 'if_')
  this.override_attr(this.$wbwindow.HTMLScriptElement.prototype, 'src', 'js_')
  this.override_attr(this.$wbwindow.HTMLVideoElement.prototype, 'src', 'oe_')
  this.override_attr(this.$wbwindow.HTMLVideoElement.prototype, 'poster', 'im_')
  this.override_attr(this.$wbwindow.HTMLAudioElement.prototype, 'src', 'oe_')
  this.override_attr(this.$wbwindow.HTMLAudioElement.prototype, 'poster', 'im_')
  this.override_attr(this.$wbwindow.HTMLSourceElement.prototype, 'src', 'oe_')
  this.override_attr(this.$wbwindow.HTMLSourceElement.prototype, 'srcset', 'oe_')
  this.override_attr(this.$wbwindow.HTMLInputElement.prototype, 'src', 'oe_')
  this.override_attr(this.$wbwindow.HTMLEmbedElement.prototype, 'src', 'oe_')
  this.override_attr(this.$wbwindow.HTMLObjectElement.prototype, 'data', 'oe_')

  this.override_attr(this.$wbwindow.HTMLBaseElement.prototype, 'href', 'mp_')
  this.override_attr(this.$wbwindow.HTMLMetaElement.prototype, 'content', 'mp_')

  this.override_attr(this.$wbwindow.HTMLFormElement.prototype, 'action', 'mp_')

  this.override_attr()

  var style_proto = this.$wbwindow.CSSStyleDeclaration.prototype

  // For FF
  if (this.$wbwindow.CSS2Properties) {
    style_proto = this.$wbwindow.CSS2Properties.prototype
  }

  this.override_style_attr(style_proto, 'cssText')

  this.override_style_attr(style_proto, 'background', 'background')
  this.override_style_attr(style_proto, 'backgroundImage', 'background-image')

  this.override_style_attr(style_proto, 'cursor', 'cursor')

  this.override_style_attr(style_proto, 'listStyle', 'list-style')
  this.override_style_attr(style_proto, 'listStyleImage', 'list-style-image')

  this.override_style_attr(style_proto, 'border', 'border')
  this.override_style_attr(style_proto, 'borderImage', 'border-image')
  this.override_style_attr(style_proto, 'borderImageSource', 'border-image-source')

  this.override_style_setProp(style_proto)
}

Wombat.prototype.init_loc_override = function init_loc_override (loc_obj, orig_setter, orig_getter) {
  if (Object.defineProperty) {
    for (var i = 0; i < this.URL_PROPS.length; i++) {
      var prop = this.URL_PROPS[i]
      this.def_prop(loc_obj, prop, this.make_set_loc_prop(prop, orig_setter, orig_getter), this.make_get_loc_prop(prop, orig_getter), true)
    }
  }
}

Wombat.prototype.init_wombat_loc = function init_wombat_loc (win) {

  if (!win || (win.WB_wombat_location && win.document.WB_wombat_location)) {
    return
  }

  // Location
  var wombat_location = new WombatLocation(win.location)

  if (Object.defineProperty) {

    var setter = function (value) {
      var loc = this._WB_wombat_location ||
        (this.defaultView && this.defaultView._WB_wombat_location) ||
        this.location

      if (loc) {
        loc.href = value
      }
    }

    var getter = function () {
      return this._WB_wombat_location ||
        (this.defaultView && this.defaultView._WB_wombat_location) ||
        this.location
    }

    this.def_prop(win.Object.prototype, 'WB_wombat_location', setter, getter)

    this.init_proto_pm_origin(win)

    win._WB_wombat_location = wombat_location
  } else {
    win.WB_wombat_location = wombat_location

    // Check quickly after page load
    setTimeout(this.check_all_locations, 500)

    // Check periodically every few seconds
    setInterval(this.check_all_locations, 500)
  }
}

Wombat.prototype.init_insertAdjacentHTML_override = function init_insertAdjacentHTML_override () {
  if (!this.$wbwindow.Element ||
    !this.$wbwindow.Element.prototype ||
    !this.$wbwindow.Element.prototype.insertAdjacentHTML) {
    return
  }

  var orig_insertAdjacentHTML = this.$wbwindow.Element.prototype.insertAdjacentHTML
  var wombat = this
  var insertAdjacent_override = function insertAdjacent_override (position, text) {
    if (!this._no_rewrite) {
      // inserting adjacent, so must observe parent
      //if (this.parentElement) {
      //    init_iframe_insert_obs(this.parentElement);
      //}
      text = wombat.rewrite_html(text)
    }
    return orig_insertAdjacentHTML.call(this, position, text)
  }

  this.$wbwindow.Element.prototype.insertAdjacentHTML = insertAdjacent_override
}

Wombat.prototype.init_window_obj_proxy = function init_window_obj_proxy ($wbwindow) {
  if (!$wbwindow.Proxy) {
    return undefined
  }

  var ownProps = this.getAllOwnProps($wbwindow)
  var wombat = this
  $wbwindow._WB_wombat_obj_proxy = new $wbwindow.Proxy({}, {
    get: function (target, prop) {
      if (prop === 'top') {
        return wombat.$wbwindow.WB_wombat_top._WB_wombat_obj_proxy
      }

      return wombat.default_proxy_get($wbwindow, prop, ownProps)
    },

    set: function (target, prop, value) {
      if (prop === 'location') {
        $wbwindow.WB_wombat_location = value
        return true
      } else if (prop === 'postMessage' || prop === 'document') {
        return true
      } else {
        try {
          if (!Reflect.set(target, prop, value)) {
            return false
          }
        } catch (e) {}

        return Reflect.set($wbwindow, prop, value)
      }
    },
    has: function (target, prop) {
      return prop in $wbwindow
    },
    ownKeys: function (target) {
      return Object.getOwnPropertyNames($wbwindow).concat(Object.getOwnPropertySymbols($wbwindow))
    },
    getOwnPropertyDescriptor: function (target, key) {
      // first try the underlying object's descriptor
      // (to match defineProperty() behavior)
      var descriptor = Object.getOwnPropertyDescriptor(target, key)
      if (!descriptor) {
        descriptor = Object.getOwnPropertyDescriptor($wbwindow, key)
        // if using window's descriptor, must ensure it's configurable
        if (descriptor) {
          descriptor.configurable = true
        }
      }

      return descriptor
    },
    getPrototypeOf: function (target) {
      return Object.getPrototypeOf($wbwindow)
    },
    setPrototypeOf: function (target, newProto) {
      return false
    },
    isExtensible: function (target) {
      return Object.isExtensible($wbwindow)
    },
    preventExtensions: function (target) {
      Object.preventExtensions($wbwindow)
      return true
    },
    deleteProperty: function (target, prop) {
      var propDescriptor = Object.getOwnPropertyDescriptor($wbwindow, prop)
      if (propDescriptor === undefined) {
        return true
      }
      if (propDescriptor.configurable === false) {
        return false
      }
      delete $wbwindow[prop]
      return true
    },
    defineProperty: function (target, prop, desc) {
      desc = desc || {}
      if (!desc.value && !desc.get) {
        desc.value = $wbwindow[prop]
      }

      var res = Reflect.defineProperty($wbwindow, prop, desc)

      return Reflect.defineProperty(target, prop, desc)
    }
  })

  return $wbwindow._WB_wombat_obj_proxy
}

Wombat.prototype.init_document_obj_proxy = function init_document_obj_proxy ($document) {
  this.init_doc_overrides($document)

  if (!this.$wbwindow.Proxy) {
    return undefined
  }

  var ownProps = this.getAllOwnProps($document)
  var wombat = this
  $document._WB_wombat_obj_proxy = new this.$wbwindow.Proxy($document, {
    get: function (target, prop) {
      return wombat.default_proxy_get($document, prop, ownProps)
    },

    set: function (target, prop, value) {
      if (prop === 'location') {
        $document.WB_wombat_location = value
        return true
      } else {
        target[prop] = value
        return true
      }
    }
  })

  return $document._WB_wombat_obj_proxy
}

Wombat.prototype.override_style_setProp = function override_style_setProp (style_proto) {
  var orig_setProp = style_proto.setProperty
  var wombat = this
  style_proto.setProperty = function (name, value, priority) {
    value = wombat.rewrite_style(value)
    return orig_setProp.call(this, name, value, priority)
  }
}

Wombat.prototype.override_anchor_elem = function override_anchor_elem () {
  var anchor_orig = {}

  for (var i = 0; i < this.URL_PROPS.length; i++) {
    var prop = this.URL_PROPS[i]
    anchor_orig['get_' + prop] = this.get_orig_getter(this.$wbwindow.HTMLAnchorElement.prototype, prop)
    anchor_orig['set_' + prop] = this.get_orig_setter(this.$wbwindow.HTMLAnchorElement.prototype, prop)
  }

  var anchor_setter = function (prop, value) {
    var func = anchor_orig['set_' + prop]
    if (func) {
      return func.call(this, value)
    } else {
      return ''
    }
  }

  var anchor_getter = function (prop) {
    var func = anchor_orig['get_' + prop]
    if (func) {
      return func.call(this)
    } else {
      return ''
    }
  }

  this.init_loc_override(this.$wbwindow.HTMLAnchorElement.prototype,
    anchor_setter, anchor_getter)
  this.$wbwindow.HTMLAnchorElement.prototype.toString = function () {
    return this.href
  }
}

Wombat.prototype.override_html_assign = function override_html_assign (elemtype, prop, rewrite_getter) {
  if (!this.$wbwindow.DOMParser ||
    !elemtype ||
    !elemtype.prototype) {
    return
  }

  var obj = elemtype.prototype

  var orig_getter = this.get_orig_getter(obj, prop)
  var orig_setter = this.get_orig_setter(obj, prop)

  if (!orig_setter) {
    return
  }

  var wombat = this
  var setter = function (orig) {
    var res = orig
    if (!this._no_rewrite) {
      //init_iframe_insert_obs(this);
      if (this.tagName == 'STYLE') {
        res = wombat.rewrite_style(orig)
      } else {
        res = wombat.rewrite_html(orig)
      }
    }
    orig_setter.call(this, res)
  }

  var getter = function () {
    var res = orig_getter.call(this)
    if (!this._no_rewrite) {
      res = res.replace(wombat.wb_unrewrite_rx, '')
    }
    return res
  }

  this.def_prop(obj, prop, setter, rewrite_getter ? getter : orig_getter)
}

Wombat.prototype.override_iframe_content_access = function override_iframe_content_access (prop) {
  if (!this.$wbwindow.HTMLIFrameElement ||
    !this.$wbwindow.HTMLIFrameElement.prototype) {
    return
  }

  var obj = this.$wbwindow.HTMLIFrameElement.prototype

  var orig_getter = this.get_orig_getter(obj, prop)

  if (!orig_getter) {
    return
  }

  var orig_setter = this.get_orig_setter(obj, prop)

  var wombat = this

  var getter = function () {
    wombat.init_iframe_wombat(this)
    return wombat.obj_to_proxy(orig_getter.call(this))
  }

  this.def_prop(obj, prop, orig_setter, getter)
  obj['_get_' + prop] = orig_getter
}

Wombat.prototype.override_frames_access = function override_frames_access ($wbwindow) {
  $wbwindow.__wb_frames = $wbwindow.frames
  var wombat = this
  var getter = function () {
    for (var i = 0; i < this.__wb_frames.length; i++) {
      try {
        wombat.init_new_window_wombat(this.__wb_frames[i])
      } catch (e) {}
    }
    return this.__wb_frames
  }

  this.def_prop($wbwindow, 'frames', undefined, getter)
  this.def_prop($wbwindow.Window.prototype, 'frames', undefined, getter)
}
