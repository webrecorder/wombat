import FuncMap from './funcMap'
import WombatLocation from './wombatLocation'

/**
 * @param {Window} $wbwindow
 * @param {Object} wbinfo
 * @constructor
 */
function Wombat ($wbwindow, wbinfo) {
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
Wombat.prototype.rewrite_url_debug = function rewrite_url_debug (
  url, use_rel, mod) {
  var rewritten = this.rewrite_url_(url, use_rel, mod)
  if (url !== rewritten) {
    console.log('REWRITE: ' + url + ' -> ' + rewritten)
  } else {
    console.log('NOT REWRITTEN ' + url)
  }
  return rewritten
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

//============================================
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

//============================================
// New Proxy Obj Override Functions
// Original Concept by John Berlin (https://github.com/N0taN3rd)
//============================================
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

//============================================
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
      return Object.getOwnPropertyNames($wbwindow).
        concat(Object.getOwnPropertySymbols($wbwindow))
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

//============================================
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