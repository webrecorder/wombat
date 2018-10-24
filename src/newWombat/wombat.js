/* eslint-disable camelcase */

import FuncMap from './funcMap';
import CustomStorage from './customStorage';
import WombatLocation from './wombatLocation';
import AutoFetchWorker from './autoFetchWorker';
import { SameOriginListener, WrappedListener } from './listeners';

/**
 * @param {Window} $wbwindow
 * @param {Object} wbinfo
 */
export default function Wombat ($wbwindow, wbinfo) {
  if (!(this instanceof Wombat)) return new Wombat($wbwindow, wbinfo);
  this.actual = false;
  this.debug_rw = false;
  this.$wbwindow = $wbwindow;
  this.HTTP_PREFIX = 'http://';
  this.HTTPS_PREFIX = 'https://';
  this.REL_PREFIX = '//';

  this.VALID_PREFIXES = [this.HTTP_PREFIX, this.HTTPS_PREFIX, this.REL_PREFIX];
  this.IGNORE_PREFIXES = [
    '#', 'about:', 'data:', 'mailto:', 'javascript:', '{', '*'
  ];

  this.wb_setAttribute = $wbwindow.Element.prototype.setAttribute;
  this.wb_getAttribute = $wbwindow.Element.prototype.getAttribute;
  this.wb_funToString = Function.prototype.toString;
  this.WBAutoFetchWorker = null;
  this.wbSheetMediaQChecker = null;
  this.wbUseAFWorker = wbinfo.enable_auto_fetch && ($wbwindow.Worker != null && wbinfo.is_live);

  this.wb_rel_prefix = '';

  this.wb_wombat_updating = false;

  this.message_listeners = new FuncMap();
  this.storage_listeners = new FuncMap();

  // <link as="x"> types for proper rewriting of link rel=[import, preload]
  this.linkAsTypes = {
    script: 'js_',
    worker: 'js_',
    style: 'cs_',
    image: 'im_',
    document: 'if_',
    fetch: 'mp_',
    font: 'oe_',
    audio: 'oe_',
    video: 'oe_',
    embed: 'oe_',
    object: 'oe_',
    track: 'oe_'
  };
  // pre-computed modifiers for each tag
  this.tagToMod = {
    A: { href: undefined },
    AREA: { href: undefined },
    IMG: { src: 'im_', srcset: 'im_' },
    IFRAME: { src: 'if_' },
    FRAME: { src: 'if_' },
    SCRIPT: { src: 'js_' },
    VIDEO: { src: 'oe_', poster: 'im_' },
    AUDIO: { src: 'oe_', poster: 'im_' },
    SOURCE: { src: 'oe_', srcset: 'oe_' },
    INPUT: { src: 'oe_' },
    EMBED: { src: 'oe_' },
    OBJECT: { data: 'oe_' },
    BASE: { href: 'mp_' },
    META: { content: 'mp_' },
    FORM: { action: 'mp_' },
    TRACK: { src: 'oe_' }
  };

  this.URL_PROPS = [
    'href', 'hash', 'pathname', 'host', 'hostname', 'protocol',
    'origin', 'search', 'port' ];

  // Globals
  this.wb_info = wbinfo;
  // custom options
  this.wb_opts = wbinfo.wombat_opts;
  this.wb_replay_prefix = wbinfo.prefix;
  this.wb_is_proxy = this.wb_info.proxy_magic || !this.wb_replay_prefix;

  this.wb_info.top_host = this.wb_info.top_host || '*';

  this.wb_curr_host =
    $wbwindow.location.protocol + '//' + $wbwindow.location.host;

  this.wb_info.wombat_opts = this.wb_info.wombat_opts || {};

  this.wb_orig_scheme = this.wb_info.wombat_scheme + '://';
  this.wb_orig_origin = this.wb_orig_scheme + this.wb_info.wombat_host;

  this.wb_abs_prefix = this.wb_replay_prefix;

  if (!this.wb_info.is_live && this.wb_info.wombat_ts) {
    this.wb_capture_date_part = '/' + this.wb_info.wombat_ts + '/';
  } else {
    this.wb_capture_date_part = '';
  }

  this.BAD_PREFIXES = [
    'http:' + this.wb_replay_prefix,
    'https:' + this.wb_replay_prefix,
    'http:/' + this.wb_replay_prefix,
    'https:/' + this.wb_replay_prefix
  ];

  this.hostnamePortRe = /^[\w-]+(\.[\w-_]+)+(:\d+)(\/|$)/;
  this.ipPortRe = /^\d+\.\d+\.\d+\.\d+(:\d+)?(\/|$)/;
  this.workerBlobRe = /__WB_pmw\(.*?\)\.(?=postMessage\()/g;
  this.STYLE_REGEX = /(url\s*\(\s*[\\"']*)([^)'"]+)([\\"']*\s*\))/gi;
  this.IMPORT_REGEX = /(@import\s+[\\"']*)([^)'";]+)([\\"']*\s*;?)/gi;
  this.no_wombatRe = /WB_wombat_/g;
  this.srcsetRe = /\s*(\S*\s+[\d.]+[wx]),|(?:\s*,(?:\s+|(?=https?:)))/;
  this.cookie_path_regex = /\bPath='?"?([^;'"\s]+)/i;
  this.cookie_domain_regex = /\bDomain=([^;'"\s]+)/i;
  this.cookie_expires_regex = /\bExpires=([^;'"]+)/gi;
  this.IP_RX = /^(\d)+\.(\d)+\.(\d)+\.(\d)+$/;
  this.FullHTMLRegex = /^\s*<(?:html|head|body|!doctype html)/i;

  this.write_buff = '';
  this.style_replacer = this.style_replacer.bind(this);
  this.utilFns = {};
}

Wombat.prototype.rwModForElement = function (elem, attrName) {
  // this function was created to help add in retrial of element attribute rewrite modifiers
  if (!elem) {
    return undefined;
  }
  var mod;
  if (elem.tagName === 'LINK' && attrName === 'href') {
    // special case for link tags: check if import / preload with maybe as
    // otherwise check for rel=stylesheet
    var relV = elem.rel;
    if (relV === 'import' || relV === 'preload') {
      var maybeAs = this.linkAsTypes[elem.as];
      mod = maybeAs != null ? maybeAs : 'mp_';
    } else if (relV === 'stylesheet') {
      mod = 'cs_';
    }
  } else {
    // see if we know this element has rewrite modifiers
    var maybeMod = this.tagToMod[elem.tagName];
    if (maybeMod != null) {
      mod = maybeMod[attrName]; // set mod to the correct modffier
    }
  }
  return mod;
};

Wombat.prototype.removeWBOSRC = function (elem) {
  if (elem.tagName === 'SCRIPT' && !elem.__$removedWBOSRC$__) {
    if (elem.hasAttribute('__wb_orig_src')) {
      elem.removeAttribute('__wb_orig_src');
    }
    elem.__$removedWBOSRC$__ = true;
  }
};

Wombat.prototype.retrieveWBOSRC = function (elem) {
  if (elem.tagName === 'SCRIPT' && !elem.__$removedWBOSRC$__) {
    var maybeWBOSRC;
    if (this.wb_getAttribute) {
      maybeWBOSRC = this.wb_getAttribute.call(elem, '__wb_orig_src');
    } else {
      maybeWBOSRC = elem.getAttribute('__wb_orig_src');
    }
    return maybeWBOSRC;
  }
  return undefined;
};

Wombat.prototype.wrapScriptTextJsProxy = function (scriptText) {
  return 'var _____WB$wombat$assign$function_____ = function(name) {return (self._wb_wombat && ' + 'self._wb_wombat.local_init &&self._wb_wombat.local_init(name)) || self[name]; };\n' +
    'if (!self.__WB_pmw) { self.__WB_pmw = function(obj) { return obj; } }\n{\n' +
    'let window = _____WB$wombat$assign$function_____("window");\n' +
    'let self = _____WB$wombat$assign$function_____("self");\n' +
    'let document = _____WB$wombat$assign$function_____("document");\n' +
    'let location = _____WB$wombat$assign$function_____("location");\n' +
    'let top = _____WB$wombat$assign$function_____("top");\n' +
    'let parent = _____WB$wombat$assign$function_____("parent");\n' +
    'let frames = _____WB$wombat$assign$function_____("frames");\n' +
    'let opener = _____WB$wombat$assign$function_____("opener");\n' + scriptText + '\n\n}';
};

Wombat.prototype.get_final_url = function (use_rel, mod, url) {
  var prefix = use_rel ? this.wb_rel_prefix : this.wb_abs_prefix;

  if (mod == null) {
    mod = this.wb_info.mod;
  }

  // if live, don't add the timestamp
  if (!this.wb_info.is_live) {
    prefix += this.wb_info.wombat_ts;
  }

  prefix += mod;

  if (prefix[prefix.length - 1] !== '/') {
    prefix += '/';
  }

  return prefix + url;
};

Wombat.prototype.resolve_rel_url = function (url, doc) {
  doc = doc || this.$wbwindow.document;
  var parser = this.make_parser(doc.baseURI, doc);
  var href = parser.href;
  var hash = href.lastIndexOf('#');

  if (hash >= 0) {
    href = href.substring(0, hash);
  }

  var lastslash = href.lastIndexOf('/');

  if (lastslash >= 0 && lastslash !== href.length - 1) {
    href = href.substring(0, lastslash + 1);
  }

  parser.href = href + url;
  return parser.href;
};

Wombat.prototype.extract_orig = function (href) {
  if (!href) {
    return '';
  }

  var orig_href = href;

  // proxy mode: no extraction needed
  if (this.wb_is_proxy) {
    return href;
  }

  href = href.toString();

  // ignore certain urls
  if (this.starts_with(href, this.IGNORE_PREFIXES)) {
    return href;
  }

  // if no coll, start from beginning, otherwise could be part of coll..
  var start = this.wb_rel_prefix ? 1 : 0;

  var index = href.indexOf('/http', start);
  if (index < 0) {
    index = href.indexOf('///', start);
  }

  // extract original url from wburl
  if (index >= 0) {
    href = href.substr(index + 1);
  } else {
    index = href.indexOf(this.wb_replay_prefix);
    if (index >= 0) {
      href = href.substr(index + this.wb_replay_prefix.length);
    }
    if (href.length > 4 && href.charAt(2) === '_' && href.charAt(3) === '/') {
      href = href.substr(4);
    }

    if (href !== orig_href && !this.starts_with(href, this.VALID_PREFIXES)) {
      href = this.HTTP_PREFIX + href;
    }
  }

  if (
    orig_href.charAt(0) === '/' &&
    orig_href.charAt(1) !== '/' &&
    this.starts_with(href, this.wb_orig_origin)
  ) {
    href = href.substr(this.wb_orig_origin.length);
  }

  if (this.starts_with(href, this.REL_PREFIX)) {
    href = 'http:' + href;
  }

  return href;
};

Wombat.prototype.make_parser = function (href, doc) {
  href = this.extract_orig(href);

  if (!doc) {
    // special case: for newly opened blank windows, use the opener
    // to create parser to have the proper baseURI
    if (
      this.$wbwindow.location.href === 'about:blank' &&
      this.$wbwindow.opener
    ) {
      doc = this.$wbwindow.opener.document;
    } else {
      doc = this.$wbwindow.document;
    }
  }

  var p = doc.createElement('a');
  p._no_rewrite = true;
  p.href = href;
  return p;
};

Wombat.prototype.is_host_url = function (str) {
  // Good guess that's its a hostname
  if (str.indexOf('www.') === 0) {
    return true;
  }

  // hostname:port (port required)
  var matches = str.match(this.hostnamePortRe);
  if (matches && matches[0].length < 64) {
    return true;
  }

  // ip:port
  matches = str.match(this.ipPortRe);
  if (matches) {
    return matches[0].length < 64;
  }
  return false;
};

Wombat.prototype.starts_with = function (string, arr_or_prefix) {
  if (!string) {
    return undefined;
  }

  if (arr_or_prefix instanceof Array) {
    for (var i = 0; i < arr_or_prefix.length; i++) {
      if (string.indexOf(arr_or_prefix[i]) === 0) {
        return arr_or_prefix[i];
      }
    }
  } else if (string.indexOf(arr_or_prefix) === 0) {
    return arr_or_prefix;
  }

  return undefined;
};

Wombat.prototype.should_rewrite_attr = function (tagName, attr) {
  if (attr === 'href' || attr === 'src') {
    return true;
  }

  if (tagName === 'VIDEO' && attr === 'poster') {
    return true;
  }

  return tagName === 'META' && attr === 'content';
};

Wombat.prototype.ends_with = function (str, suffix) {
  if (str.indexOf(suffix, str.length - suffix.length) !== -1) {
    return suffix;
  } else {
    return undefined;
  }
};

Wombat.prototype.def_prop = function (obj, prop, set_func, get_func, enumerable) {
  // if the property is marked as non-configurable in the current
  // browser, skip the override
  var existingDescriptor = Object.getOwnPropertyDescriptor(obj, prop);
  if (existingDescriptor && !existingDescriptor.configurable) {
    return false;
  }

  // if no getter function was supplied, skip the override.
  // See https://github.com/webrecorder/pywb/issues/147 for context
  if (!get_func) {
    return false;
  }

  var descriptor = {
    configurable: true,
    enumerable: enumerable || false,
    get: get_func
  };

  if (set_func) {
    descriptor.set = set_func;
  }

  try {
    Object.defineProperty(obj, prop, descriptor);
    return true;
  } catch (e) {
    console.warn('Failed to redefine property %s', prop, e.message);
    return false;
  }
};

Wombat.prototype.get_orig_getter = function get_orig_getter (obj, prop) {
  var orig_getter;

  if (obj.__lookupGetter__) {
    orig_getter = obj.__lookupGetter__(prop);
  }

  if (!orig_getter && Object.getOwnPropertyDescriptor) {
    var props = Object.getOwnPropertyDescriptor(obj, prop);
    if (props) {
      orig_getter = props.get;
    }
  }

  return orig_getter;
};

Wombat.prototype.get_orig_setter = function (obj, prop) {
  var orig_setter;

  if (obj.__lookupSetter__) {
    orig_setter = obj.__lookupSetter__(prop);
  }

  if (!orig_setter && Object.getOwnPropertyDescriptor) {
    var props = Object.getOwnPropertyDescriptor(obj, prop);
    if (props) {
      orig_setter = props.set;
    }
  }

  return orig_setter;
};

Wombat.prototype.send_top_message = function (message, skip_top_check) {
  if (!this.$wbwindow.__WB_top_frame) {
    return;
  }

  if (!skip_top_check && this.$wbwindow !== this.$wbwindow.__WB_replay_top) {
    return;
  }

  this.$wbwindow.__WB_top_frame.postMessage(message, this.wb_info.top_host);
};

Wombat.prototype.send_history_update = function (url, title) {
  this.send_top_message({
    url: url,
    ts: this.wb_info.timestamp,
    request_ts: this.wb_info.request_ts,
    is_live: this.wb_info.is_live,
    title: title,
    wb_type: 'replace-url'
  });
};

Wombat.prototype.addEventOverride = function (attr, event_proto) {
  if (!event_proto) {
    event_proto = this.$wbwindow.MessageEvent.prototype;
  }

  var orig_getter = this.get_orig_getter(event_proto, attr);

  if (!orig_getter) {
    return;
  }

  function getter () {
    if (this['_' + attr] != null) {
      return this['_' + attr];
    }
    return orig_getter.call(this);
  }

  this.def_prop(event_proto, attr, undefined, getter);
};

Wombat.prototype.watch_elem = function (elem, func) {
  if (!this.$wbwindow.MutationObserver) {
    return false;
  }
  var m = new this.$wbwindow.MutationObserver(function (records, observer) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === 'childList') {
        for (var j = 0; j < r.addedNodes.length; j++) {
          func(r.addedNodes[j]);
        }
      }
    }
  });

  m.observe(elem, {
    childList: true,
    subtree: true
  });
};

Wombat.prototype.update_location = function (req_href, orig_href, actual_location, wombat_loc) {
  if (!req_href) {
    return;
  }

  if (req_href === orig_href) {
    // Reset wombat loc to the unrewritten version
    // if (wombat_loc) {
    //    wombat_loc.href = extract_orig(orig_href);
    // }
    return;
  }

  var ext_orig = this.extract_orig(orig_href);
  var ext_req = this.extract_orig(req_href);

  if (!ext_orig || ext_orig === ext_req) {
    return;
  }

  var final_href = this.rewrite_url(req_href);

  console.log(actual_location.href + ' -> ' + final_href);

  actual_location.href = final_href;
};

Wombat.prototype.check_location_change = function (wombat_loc, is_top) {
  var locType = typeof wombat_loc;

  var actual_location = is_top
    ? this.$wbwindow.__WB_replay_top.location
    : this.$wbwindow.location;

  // String has been assigned to location, so assign it
  if (locType === 'string') {
    this.update_location(wombat_loc, actual_location.href, actual_location);
  } else if (locType === 'object') {
    this.update_location(
      wombat_loc.href,
      wombat_loc._orig_href,
      actual_location
    );
  }
};

Wombat.prototype.check_all_locations = function () {
  if (this.wb_wombat_updating) {
    return false;
  }

  this.wb_wombat_updating = true;

  this.check_location_change(this.$wbwindow.WB_wombat_location, false);

  // Only check top if its a different $wbwindow
  if (
    this.$wbwindow.WB_wombat_location !==
    this.$wbwindow.__WB_replay_top.WB_wombat_location
  ) {
    this.check_location_change(
      this.$wbwindow.__WB_replay_top.WB_wombat_location,
      true
    );
  }

  this.wb_wombat_updating = false;
};

Wombat.prototype.proxy_to_obj = function (source) {
  try {
    return (source && source.__WBProxyRealObj__) || source;
  } catch (e) {
    return source;
  }
};

Wombat.prototype.obj_to_proxy = function (obj) {
  try {
    return (obj && obj._WB_wombat_obj_proxy) || obj;
  } catch (e) {
    return obj;
  }
};

Wombat.prototype.getAllOwnProps = function (obj) {
  var ownProps = [];

  var props = Object.getOwnPropertyNames(obj);
  var i = 0;
  for (; i < props.length; i++) {
    var prop = props[i];

    try {
      if (obj[prop] && !obj[prop].prototype) {
        ownProps.push(prop);
      }
    } catch (e) {}
  }

  var traverseObj = Object.getPrototypeOf(obj);

  while (traverseObj) {
    props = Object.getOwnPropertyNames(traverseObj);
    for (i = 0; i < props.length; i++) {
      ownProps.push(props[i]);
    }
    traverseObj = Object.getPrototypeOf(traverseObj);
  }

  return ownProps;
};

Wombat.prototype.default_proxy_get = function (obj, prop, ownProps) {
  switch (prop) {
    case '__WBProxyRealObj__':
      return obj;
    case 'location':
      return obj.WB_wombat_location;
    case '_WB_wombat_obj_proxy':
      return obj._WB_wombat_obj_proxy;
  }
  var retVal = obj[prop];

  var type = typeof retVal;

  if (type === 'function' && ownProps.indexOf(prop) !== -1) {
    // certain sites (e.g. facebook) are applying polyfills to native functions
    // treating the polyfill as a native function [fn.bind(obj)] causes incorrect execution of the polyfill
    // also depending on the site, the site can detect we "tampered" with the polyfill by binding it to obj
    // to avoid these situations, we do not bind the returned fn if we detect they were polyfilled
    switch (prop) {
      case 'requestAnimationFrame':
      case 'cancelAnimationFrame': {
        var str = this.wb_funToString.call(retVal);
        if (str.indexOf('[native code]') === -1) {
          return retVal;
        }
      }
      default: {
        return retVal.bind(obj);
      }
    }
  } else if (type === 'object' && retVal && retVal._WB_wombat_obj_proxy) {
    return retVal._WB_wombat_obj_proxy;
  }

  return retVal;
};

Wombat.prototype.set_loc = function (loc, orig_href) {
  var parser = this.make_parser(orig_href, loc.ownerDocument);

  loc._orig_href = orig_href;
  loc._parser = parser;

  var href = parser.href;
  loc._hash = parser.hash;

  loc._href = href;

  loc._host = parser.host;
  loc._hostname = parser.hostname;

  if (parser.origin) {
    loc._origin = parser.origin;
  } else {
    loc._origin =
      parser.protocol + '//' +
      parser.hostname + (parser.port ? ':' + parser.port : '');
  }

  loc._pathname = parser.pathname;
  loc._port = parser.port;
  // this.protocol = parser.protocol;
  loc._protocol = parser.protocol;
  loc._search = parser.search;

  if (!Object.defineProperty) {
    loc.href = href;
    loc.hash = parser.hash;

    loc.host = loc._host;
    loc.hostname = loc._hostname;
    loc.origin = loc._origin;
    loc.pathname = loc._pathname;
    loc.port = loc._port;
    loc.protocol = loc._protocol;
    loc.search = loc._search;
  }
};

Wombat.prototype.make_get_loc_prop = function (prop, orig_getter) {
  var wombat = this;
  return function () {
    if (this._no_rewrite) {
      return orig_getter.call(this, prop);
    }

    var curr_orig_href = orig_getter.call(this, 'href');

    if (prop === 'href') {
      return wombat.extract_orig(curr_orig_href);
    }

    if (this._orig_href !== curr_orig_href) {
      wombat.set_loc(this, curr_orig_href);
    }
    return this['_' + prop];
  };
};

Wombat.prototype.make_set_loc_prop = function (prop, orig_setter, orig_getter) {
  var wombat = this;

  return function (value) {
    if (this._no_rewrite) {
      orig_setter.call(this, prop, value);
      return;
    }

    if (this['_' + prop] === value) {
      return;
    }

    this['_' + prop] = value;

    if (!this._parser) {
      var href = orig_getter.call(this);
      this._parser = wombat.make_parser(href, this.ownerDocument);
    }

    var rel = false;

    // Special case for href="." assignment
    if (prop === 'href' && typeof value === 'string') {
      if (value) {
        if (value[0] === '.') {
          value = wombat.resolve_rel_url(value, this.ownerDocument);
        } else if (
          value[0] === '/' &&
          (value.length <= 1 || value[1] !== '/')
        ) {
          rel = true;
          value = WB_wombat_location.origin + value;
        }
      }
    }

    try {
      this._parser[prop] = value;
    } catch (e) {
      console.log('Error setting ' + prop + ' = ' + value);
    }

    if (prop === 'hash') {
      value = this._parser[prop];
      orig_setter.call(this, 'hash', value);
    } else {
      rel = rel || value === this._parser.pathname;
      value = wombat.rewrite_url(this._parser.href, rel);
      orig_setter.call(this, 'href', value);
    }
  };
};

Wombat.prototype.rewrite_url_ = function (url, use_rel, mod) {
  // If undefined, just return it
  if (!url) {
    return url;
  }

  var urltype_ = typeof url;

  // If object, use toString
  if (urltype_ === 'object') {
    url = url.toString();
  } else if (urltype_ !== 'string') {
    return url;
  }

  // proxy mode: If no wb_replay_prefix, only rewrite scheme
  if (this.wb_is_proxy) {
    if (
      this.wb_orig_scheme === this.HTTP_PREFIX &&
      this.starts_with(url, this.HTTPS_PREFIX)
    ) {
      return this.HTTP_PREFIX + url.substr(this.HTTPS_PREFIX.length);
    } else if (
      this.wb_orig_scheme === this.HTTPS_PREFIX &&
      this.starts_with(url, this.HTTP_PREFIX)
    ) {
      return this.HTTPS_PREFIX + url.substr(this.HTTP_PREFIX.length);
    } else {
      return url;
    }
  }

  // just in case wombat reference made it into url!
  url = url.replace('WB_wombat_', '');

  // ignore anchors, about, data
  if (this.starts_with(url, this.IGNORE_PREFIXES)) {
    return url;
  }

  // OPTS: additional ignore prefixes
  if (
    this.wb_opts.no_rewrite_prefixes &&
    this.starts_with(url, this.wb_opts.no_rewrite_prefixes)
  ) {
    return url;
  }

  // If starts with prefix, no rewriting needed
  // Only check replay prefix (no date) as date may be different for each
  // capture

  // if scheme relative, prepend current scheme
  var check_url;

  if (url.indexOf('//') === 0) {
    check_url = window.location.protocol + url;
  } else {
    check_url = url;
  }

  if (
    this.starts_with(check_url, this.wb_replay_prefix) ||
    this.starts_with(
      check_url,
      this.$wbwindow.location.origin + this.wb_replay_prefix
    )
  ) {
    return url;
  }

  // A special case where the port somehow gets dropped
  // Check for this and add it back in, eg http://localhost/path/ -> http://localhost:8080/path/
  if (this.$wbwindow.location.host !== this.$wbwindow.location.hostname) {
    if (
      this.starts_with(
        url,
        this.$wbwindow.location.protocol +
        '//' +
        this.$wbwindow.location.hostname +
        '/'
      )
    ) {
      url = url.replace(
        '/' + this.$wbwindow.location.hostname + '/',
        '/' + this.$wbwindow.location.host + '/'
      );
      return url;
    }
  }

  // If server relative url, add prefix and original host
  if (url.charAt(0) === '/' && !this.starts_with(url, this.REL_PREFIX)) {
    // Already a relative url, don't make any changes!
    if (
      this.wb_capture_date_part &&
      url.indexOf(this.wb_capture_date_part) >= 0
    ) {
      return url;
    }

    // relative collection
    if (url.indexOf(this.wb_rel_prefix) === 0 && url.indexOf('http') > 1) {
      var scheme_sep = url.indexOf(':/');
      if (scheme_sep > 0 && url[scheme_sep + 2] !== '/') {
        url =
          url.substring(0, scheme_sep + 2) + '/' + url.substring(scheme_sep + 2);
      }
      return url;
    }

    return this.get_final_url(true, mod, this.wb_orig_origin + url);
  }

  // Use a parser
  if (url.charAt(0) === '.') {
    url = this.resolve_rel_url(url);
  }

  // If full url starting with http://, https:// or //
  // add rewrite prefix
  var prefix = this.starts_with(url, this.VALID_PREFIXES);

  if (prefix) {
    var orig_host = this.$wbwindow.__WB_replay_top.location.host;
    var orig_protocol = this.$wbwindow.__WB_replay_top.location.protocol;

    var prefix_host = prefix + orig_host + '/';

    // if already rewritten url, must still check scheme
    if (this.starts_with(url, prefix_host)) {
      if (this.starts_with(url, this.wb_replay_prefix)) {
        return url;
      }

      var curr_scheme = orig_protocol + '//';
      var path = url.substring(prefix_host.length);
      var rebuild = false;

      if (path.indexOf(this.wb_rel_prefix) < 0 && url.indexOf('/static/') < 0) {
        path = this.get_final_url(
          true,
          mod,
          this.WB_wombat_location.origin + '/' + path
        );
        rebuild = true;
      }

      // replace scheme to ensure using the correct server scheme
      // if (starts_with(url, wb_orig_scheme) && (wb_orig_scheme != curr_scheme)) {
      if (prefix !== curr_scheme && prefix !== this.REL_PREFIX) {
        rebuild = true;
      }

      if (rebuild) {
        if (!use_rel) {
          url = curr_scheme + orig_host;
        } else {
          url = '';
        }
        if (path && path[0] !== '/') {
          url += '/';
        }
        url += path;
      }

      return url;
    }
    return this.get_final_url(use_rel, mod, url);
  }

  // Check for common bad prefixes and remove them
  prefix = this.starts_with(url, this.BAD_PREFIXES);

  if (prefix) {
    url = this.extract_orig(url);
    return this.get_final_url(use_rel, mod, url);
  }

  // May or may not be a hostname, call function to determine
  // If it is, add the prefix and make sure port is removed
  if (
    this.is_host_url(url) &&
    !this.starts_with(url, this.$wbwindow.location.host + '/')
  ) {
    return this.get_final_url(use_rel, mod, this.wb_orig_scheme + url);
  }

  return url;
};

Wombat.prototype.rewrite_url = function (url, use_rel, mod) {
  var rewritten = this.rewrite_url_(url, use_rel, mod);
  if (this.debug_rw) {
    if (url !== rewritten) {
      console.log('REWRITE: ' + url + ' -> ' + rewritten);
    } else {
      console.log('NOT REWRITTEN ' + url);
    }
  }
  return rewritten;
};

Wombat.prototype.rewrite_blob = function (url) {
  // use sync ajax request to get the contents, remove postMessage() rewriting
  var x = new XMLHttpRequest();
  x.open('GET', url, false);
  x.send();

  var resp = x.responseText.replace(this.workerBlobRe, '');

  if (this.wb_info.static_prefix || this.wb_info.ww_rw_script) {
    var ww_rw =
      this.wb_info.ww_rw_script || this.wb_info.static_prefix + 'ww_rw.js';
    var rw =
      '(function() { ' +
      'self.importScripts(\'' +
      ww_rw +
      '\');' +
      'new WBWombat({\'prefix\': \'' +
      this.wb_abs_prefix +
      this.wb_info.mod +
      '/\'}); ' +
      '})();';
    resp = rw + resp;
  }

  if (resp !== x.responseText) {
    return URL.createObjectURL(new Blob([resp], { type: 'text/javascript' }));
  } else {
    return url;
  }
};

Wombat.prototype.rewrite_attr = function (elem, name, abs_url_only) {
  if (!elem || !elem.getAttribute) {
    return;
  }

  if (elem._no_rewrite) {
    return;
  }

  // already overwritten
  if (elem['_' + name]) {
    return;
  }

  var value = this.wb_getAttribute.call(elem, name);

  if (!value || this.starts_with(value, 'javascript:')) {
    return;
  }

  var new_value;

  if (name === 'filter') {
    // for svg filter attribute which is url(...)
    new_value = this.rewrite_inline_style(value);
  } else if (name === 'style') {
    new_value = this.rewrite_style(value);
  } else if (name === 'srcset') {
    new_value = this.rewrite_srcset(value);
  } else {
    // Only rewrite if absolute url
    if (abs_url_only && !this.starts_with(value, this.VALID_PREFIXES)) {
      return;
    }
    var mod = this.rwModForElement(elem, name);
    new_value = this.rewrite_url(value, false, mod);
  }

  if (new_value !== value) {
    this.removeWBOSRC(elem);
    this.wb_setAttribute.call(elem, name, new_value);
    return true;
  }
};

Wombat.prototype.style_replacer = function (match, n1, n2, n3, offset, string) {
  return n1 + this.rewrite_url(n2) + n3;
};

Wombat.prototype.replace_dom_func = function (funcname) {
  var orig = this.$wbwindow.Node.prototype[funcname];
  var wombat = this;
  this.$wbwindow.Node.prototype[funcname] = function () {
    var child = arguments[0];
    if (child) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        wombat.rewrite_elem(child);
        // special check for nested elements
        if (child.children || child.childNodes) {
          wombat.recurse_rewrite_elem(child);
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        if (this.tagName === 'STYLE') {
          child.textContent = wombat.rewrite_style(child.textContent);
        }
      } else if (child.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        wombat.recurse_rewrite_elem(child);
      }
    }

    var created;
    if (orig.__WB_orig_apply) {
      created = orig.__WB_orig_apply(wombat.proxy_to_obj(this), arguments);
    } else {
      created = orig.apply(this, arguments);
    }

    if (created && created.tagName === 'IFRAME') {
      wombat.init_iframe_wombat(created);
    }
    return created;
  };
};

Wombat.prototype.rewrite_style = function (value) {
  if (!value) {
    return value;
  }

  if (typeof value === 'object') {
    value = value.toString();
  }

  if (typeof value === 'string') {
    value = value.replace(this.STYLE_REGEX, this.style_replacer);
    value = value.replace(this.IMPORT_REGEX, this.style_replacer);
    value = value.replace(this.no_wombatRe, '');
  }

  return value;
};

Wombat.prototype.rewrite_srcset = function (value) {
  if (!value) {
    return '';
  }
  // Filter removes non-truthy values like null, undefined, and ""
  var values = value.split(this.srcsetRe).filter(Boolean);

  for (var i = 0; i < values.length; i++) {
    values[i] = this.rewrite_url(values[i].trim());
  }

  if (this.wbUseAAWorker) {
    // send post split values to preservation worker
    this.WBAutoFetchWorker.preserveSrcset(values);
  }

  return values.join(', ');
};

Wombat.prototype.rewrite_frame_src = function (elem, name) {
  var value = this.wb_getAttribute.call(elem, name);
  var new_value;

  // special case for rewriting javascript: urls that contain WB_wombat_
  // must insert wombat init first!
  if (this.starts_with(value, 'javascript:')) {
    if (value.indexOf('WB_wombat_') >= 0) {
      var JS = 'javascript:';
      new_value = JS;
      new_value += 'window.parent._wb_wombat.init_new_window_wombat(window);';
      new_value += value.substr(JS.length);
    }
  }

  if (!new_value) {
    new_value = this.rewrite_url(value, false);
  }

  if (new_value !== value) {
    this.wb_setAttribute.call(elem, name, new_value);
    return true;
  }

  return false;
};

Wombat.prototype.rewrite_script = function (elem) {
  if (elem.getAttribute('src') || !elem.textContent || !this.$wbwindow.Proxy) {
    return this.rewrite_attr(elem, 'src');
  }

  if (elem.textContent.indexOf('_____WB$wombat$assign$function_____') >= 0) {
    return false;
  }

  var text = elem.textContent.trim();

  if (!text || text.indexOf('<') === 0) {
    return false;
  }

  var override_props = [
    'window',
    'self',
    'document',
    'location',
    'top',
    'parent',
    'frames',
    'opener'
  ];

  var contains_props = false;

  for (var i = 0; i < override_props.length; i++) {
    if (text.indexOf(override_props[i]) >= 0) {
      contains_props = true;
      break;
    }
  }

  if (!contains_props) {
    return false;
  }
  elem.textContent = this.wrapScriptTextJsProxy(elem.textContent.replace(/(.postMessage\s*\()/, '.__WB_pmw(self.window)$1'));
  return true;
};

Wombat.prototype.rewrite_elem = function (elem) {
  if (!elem) {
    return;
  }

  var changed;

  switch (elem.tagName) {
    case 'STYLE':
      var new_content = this.rewrite_style(elem.textContent);
      if (elem.textContent !== new_content) {
        elem.textContent = new_content;
        changed = true;
        if (this.wbUseAAWorker && elem.sheet != null) {
          // we have a stylesheet so lets be nice to UI thread
          // and defer extraction
          this.WBAutoFetchWorker.deferredSheetExtraction(elem.sheet);
        }
      }
      break;
    case 'LINK':
      changed = this.rewrite_attr(elem, 'href');
      if (this.wbUseAAWorker && elem.rel === 'stylesheet') {
        // we can only check link[rel='stylesheet'] when it loads
        elem.addEventListener('load', this.utilFns.wbSheetMediaQChecker);
      }
      break;
    case 'IMG':
      changed = this.rewrite_attr(elem, 'src');
      changed = this.rewrite_attr(elem, 'srcset') || changed;
      changed = this.rewrite_attr(elem, 'style') || changed;
      break;
    case 'OBJECT':
      changed = this.rewrite_attr(elem, 'data', true);
      break;
    case 'FORM':
      changed = this.rewrite_attr(elem, 'action', true);
      break;
    case 'IFRAME':
    case 'FRAME':
      changed = this.rewrite_frame_src(elem, 'src');
      break;
    case 'image':
      changed = this.rewrite_attr(elem, 'xlink:href');
      break;
    default: {
      if (elem instanceof SVGElement && elem.hasAttribute('filter')) {
        changed = this.rewrite_attr(elem, 'filter');
      } else {
        changed = this.rewrite_attr(elem, 'src');
        changed = this.rewrite_attr(elem, 'srcset') || changed;
        changed = this.rewrite_attr(elem, 'href') || changed;
        changed = this.rewrite_attr(elem, 'style') || changed;
        changed = this.rewrite_attr(elem, 'poster') || changed;
      }
      break;
    }
  }

  if (elem.getAttribute) {
    if (elem.hasAttribute('crossorigin')) {
      elem.removeAttribute('crossorigin');
      changed = true;
    }

    if (elem.hasAttribute('integrity')) {
      elem.removeAttribute('integrity');
      changed = true;
    }
  }

  return changed;
};

Wombat.prototype.rewrite_html = function (string, check_end_tag) {
  if (!string) {
    return string;
  }
  var rwString = string;
  if (typeof string !== 'string') {
    rwString = string.toString();
  }

  if (this.write_buff) {
    rwString = this.write_buff + rwString;
    this.write_buff = '';
  }

  if (rwString.indexOf('<script') <= 0) {
    // string = string.replace(/WB_wombat_/g, "");
    rwString = rwString.replace(/((id|class)=".*)WB_wombat_([^"]+)/, '$1$3');
  }

  if (
    !this.$wbwindow.HTMLTemplateElement ||
    this.starts_with(rwString, ['<html', '<head', '<body'])
  ) {
    return this.rewrite_html_full(rwString, check_end_tag);
  }

  var inner_doc = new DOMParser().parseFromString(
    '<template>' + rwString + '</template>',
    'text/html'
  );

  if (
    !inner_doc ||
    !inner_doc.head ||
    !inner_doc.head.children ||
    !inner_doc.head.children[0].content
  ) {
    return rwString;
  }

  var template = inner_doc.head.children[0];

  if (this.recurse_rewrite_elem(template.content)) {
    template._no_rewrite = true;
    var new_html = template.innerHTML;

    if (check_end_tag) {
      var first_elem = template.content.children && template.content.children[0];
      if (first_elem) {
        var end_tag = '</' + first_elem.tagName.toLowerCase() + '>';
        if (
          this.ends_with(new_html, end_tag) &&
          !this.ends_with(rwString, end_tag)
        ) {
          new_html = new_html.substring(0, new_html.length - end_tag.length);
        }
      } else if (rwString[0] !== '<' || rwString[rwString.length - 1] !== '>') {
        this.write_buff += rwString;
        return;
      }
    }
    return new_html;
  }

  return rwString;
};

Wombat.prototype.rewrite_html_full = function (string, check_end_tag) {
  var inner_doc = new DOMParser().parseFromString(string, 'text/html');

  if (!inner_doc) {
    return string;
  }

  var changed = false;

  for (var i = 0; i < inner_doc.all.length; i++) {
    changed = this.rewrite_elem(inner_doc.all[i]) || changed;
  }

  if (changed) {
    var new_html;

    // if original had <html> tag, add full document HTML
    if (string && string.indexOf('<html') >= 0) {
      inner_doc.documentElement._no_rewrite = true;
      new_html = inner_doc.documentElement.outerHTML;
    } else {
      // otherwise, just add contents of head and body
      inner_doc.head._no_rewrite = true;
      inner_doc.body._no_rewrite = true;

      new_html = inner_doc.head.innerHTML;
      new_html += inner_doc.body.innerHTML;

      if (check_end_tag) {
        if (inner_doc.all.length > 3) {
          var end_tag = '</' + inner_doc.all[3].tagName.toLowerCase() + '>';
          if (
            this.ends_with(new_html, end_tag) &&
            !this.ends_with(string, end_tag)
          ) {
            new_html = new_html.substring(0, new_html.length - end_tag.length);
          }
        } else if (string[0] !== '<' || string[string.length - 1] !== '>') {
          this.write_buff += string;
          return;
        }
      }
    }

    return new_html;
  }

  return string;
};

Wombat.prototype.rewrite_inline_style = function (orig) {
  var decoded;

  try {
    decoded = decodeURIComponent(orig);
  } catch (e) {
    decoded = orig;
  }

  var val;
  if (decoded !== orig) {
    val = this.rewrite_style(decoded);
    var parts = val.split(',', 2);
    val = parts[0] + ',' + encodeURIComponent(parts[1]);
  } else {
    val = this.rewrite_style(orig);
  }

  return val;
};

Wombat.prototype.recurse_rewrite_elem = function (curr) {
  var changed = false;

  var children = curr && (curr.children || curr.childNodes);

  if (children) {
    for (var i = 0; i < children.length; i++) {
      if (children[i].nodeType === Node.ELEMENT_NODE) {
        changed = this.rewrite_elem(children[i]) || changed;
        changed = this.recurse_rewrite_elem(children[i]) || changed;
      }
    }
  }

  return changed;
};

Wombat.prototype.rewrite_cookie = function (cookie) {
  var rwCookie = cookie.replace(this.wb_abs_prefix, '');
  rwCookie = rwCookie.replace(this.wb_rel_prefix, '');
  var wombat = this;
  // rewrite domain
  rwCookie = rwCookie.replace(this.cookie_domain_regex, function (m, m1) {
    var message = {
      domain: m1,
      cookie: rwCookie,
      wb_type: 'cookie'
    };

    // norify of cookie setting to allow server-side tracking
    wombat.send_top_message(message, true);

    // if no subdomain, eg. "localhost", just remove domain altogether
    if (
      wombat.$wbwindow.location.hostname.indexOf('.') >= 0 &&
      !wombat.IP_RX.test(wombat.$wbwindow.location.hostname)
    ) {
      return 'Domain=.' + wombat.$wbwindow.location.hostname;
    }
    return '';
  });

  // rewrite path
  rwCookie = rwCookie.replace(this.cookie_path_regex, function (m, m1) {
    var rewritten = wombat.rewrite_url(m1);

    if (rewritten.indexOf(wombat.wb_curr_host) === 0) {
      rewritten = rewritten.substring(wombat.wb_curr_host.length);
    }

    return 'Path=' + rewritten;
  });

  // rewrite secure, if needed
  if (wombat.$wbwindow.location.protocol !== 'https:') {
    rwCookie = rwCookie.replace('secure', '');
  }

  rwCookie = rwCookie.replace(',|', ',');

  return rwCookie;
};

Wombat.prototype.rewriteWorker = function (workerUrl) {
  var fetch = true;
  var makeBlob = false;
  var rwURL;
  if (!this.starts_with(workerUrl, 'blob:')) {
    if (this.starts_with(workerUrl, 'javascript:')) {
      // JS url, just strip javascript:
      fetch = false;
      rwURL = workerUrl.replace('javascript:', '');
    } else if (!this.starts_with(workerUrl, this.VALID_PREFIXES.concat('/')) &&
      !this.starts_with(workerUrl, this.BAD_PREFIXES)) {
      // super relative url assets/js/xyz.js
      var rurl = this.resolve_rel_url(workerUrl, this.$wbwindow.document);
      rwURL = this.rewrite_url(rurl, false, 'wkr_');
    } else {
      // just rewrite it
      rwURL = this.rewrite_url(workerUrl, false, 'wkr_');
    }
  } else {
    // blob
    rwURL = workerUrl;
  }

  var workerCode;
  if (fetch) {
    // fetching only skipped if it was JS url
    var x = new XMLHttpRequest();
    // use sync ajax request to get the contents, remove postMessage() rewriting
    x.open('GET', rwURL, false);
    x.send();
    workerCode = x.responseText.replace(/__WB_pmw\(.*?\)\.(?=postMessage\()/g, '');
  } else {
    // was JS url, simply make workerCode the JS string
    workerCode = workerUrl;
  }

  if (this.wbinfo.static_prefix || this.wbinfo.ww_rw_script) {
    // if we are here we can must return blob so set makeBlob to true
    var ww_rw = this.wbinfo.ww_rw_script || this.wbinfo.static_prefix + 'ww_rw.js';
    var rw = '(function() { ' + "self.importScripts('" + ww_rw + "');" +
      "new WBWombat({'prefix': '" + this.wb_abs_prefix + 'wkr_' + "/'}); " + '})();';
    workerCode = rw + workerCode;
    makeBlob = true;
  }

  if (makeBlob) {
    var blob = new Blob([workerCode], { 'type': 'text/javascript' });
    return URL.createObjectURL(blob);
  } else {
    return workerUrl;
  }
};

Wombat.prototype.override_attr_props = function () {
  var wombat = this;

  function is_rw_attr (attr) {
    if (!attr) {
      return false;
    }

    var tagName = attr.ownerElement && attr.ownerElement.tagName;

    return wombat.should_rewrite_attr(tagName, attr.nodeName);
  }

  this.override_prop_extract(
    this.$wbwindow.Attr.prototype,
    'nodeValue',
    is_rw_attr
  );
  this.override_prop_extract(this.$wbwindow.Attr.prototype, 'value', is_rw_attr);
};

Wombat.prototype.override_attr = function (obj, attr, mod, default_to_setget) {
  var orig_getter = this.get_orig_getter(obj, attr);
  var orig_setter = this.get_orig_setter(obj, attr);

  var wombat = this;

  var setter = function (orig) {
    var val;
    if (mod === 'js_') {
      wombat.removeWBOSRC(this);
    }
    val = wombat.rewrite_url(orig, false, mod);

    if (orig_setter) {
      return orig_setter.call(this, val);
    } else if (wombat.wb_setAttribute) {
      return wombat.wb_setAttribute.call(this, attr, val);
    }
  };

  var getter = function () {
    var res;
    if (orig_getter) {
      res = orig_getter.call(this);
    } else if (wombat.wb_getAttribute) {
      res = wombat.wb_getAttribute.call(this, attr);
    }
    return wombat.extract_orig(res);
  };

  this.def_prop(obj, attr, setter, getter);
};

Wombat.prototype.override_prop_extract = function (proto, prop, cond) {
  var orig_getter = this.get_orig_getter(proto, prop);
  var wombat = this;
  if (orig_getter) {
    var new_getter = function () {
      var obj = wombat.proxy_to_obj(this);
      var res = orig_getter.call(obj);
      if (!cond || cond(obj)) {
        res = wombat.extract_orig(res);
      }
      return res;
    };

    this.def_prop(proto, prop, undefined, new_getter);
  }
};

Wombat.prototype.override_prop_to_proxy = function (proto, prop) {
  var orig_getter = this.get_orig_getter(proto, prop);

  if (orig_getter) {
    var wombat = this;

    var new_getter = function new_getter () {
      return wombat.obj_to_proxy(orig_getter.call(this));
    };

    this.def_prop(proto, prop, undefined, new_getter);
  }
};

Wombat.prototype.override_history_func = function (func_name) {
  if (!this.$wbwindow.history) {
    return;
  }

  var orig_func = this.$wbwindow.history[func_name];

  if (!orig_func) {
    return;
  }

  this.$wbwindow.history['_orig_' + func_name] = orig_func;
  var wombat = this;

  function rewritten_func (state_obj, title, url) {
    var rewritten_url;

    if (url) {
      var parser = wombat.$wbwindow.document.createElement('a');
      parser.href = url;
      url = parser.href;

      rewritten_url = wombat.rewrite_url(url);

      if (
        url &&
        (url !== wombat.$wbwindow.WB_wombat_location.origin &&
          wombat.$wbwindow.WB_wombat_location.href !== 'about:blank') &&
        !wombat.starts_with(url, wombat.$wbwindow.WB_wombat_location.origin + '/')
      ) {
        throw new DOMException('Invalid history change: ' + url);
      }
    } else {
      url = wombat.$wbwindow.WB_wombat_location.href;
    }

    orig_func.call(this, state_obj, title, rewritten_url);

    wombat.send_history_update(url, title);
  }

  this.$wbwindow.history[func_name] = rewritten_func;
  if (this.$wbwindow.History && this.$wbwindow.History.prototype) {
    this.$wbwindow.History.prototype[func_name] = rewritten_func;
  }

  return rewritten_func;
};

Wombat.prototype.override_style_attr = function (obj, attr, prop_name) {
  var orig_getter = this.get_orig_getter(obj, attr);
  var orig_setter = this.get_orig_setter(obj, attr);

  var wombat = this;

  var setter = function (orig) {
    var val = wombat.rewrite_style(orig);
    if (orig_setter) {
      orig_setter.call(this, val);
    } else {
      this.setProperty(prop_name, val);
    }

    return val;
  };

  var getter = orig_getter;

  if (!getter) {
    getter = function () {
      return this.getPropertyValue(prop_name);
    };
  }

  if ((orig_setter && orig_getter) || prop_name) {
    this.def_prop(obj, attr, setter, getter);
  }
};

Wombat.prototype.override_style_setProp = function (style_proto) {
  var orig_setProp = style_proto.setProperty;
  var wombat = this;
  style_proto.setProperty = function (name, value, priority) {
    value = wombat.rewrite_style(value);
    return orig_setProp.call(this, name, value, priority);
  };
};

Wombat.prototype.override_anchor_elem = function () {
  var anchor_orig = {};

  for (var i = 0; i < this.URL_PROPS.length; i++) {
    var prop = this.URL_PROPS[i];
    anchor_orig['get_' + prop] = this.get_orig_getter(
      this.$wbwindow.HTMLAnchorElement.prototype,
      prop
    );
    anchor_orig['set_' + prop] = this.get_orig_setter(
      this.$wbwindow.HTMLAnchorElement.prototype,
      prop
    );
  }

  var anchor_setter = function (prop, value) {
    var func = anchor_orig['set_' + prop];
    if (func) {
      return func.call(this, value);
    } else {
      return '';
    }
  };

  var anchor_getter = function (prop) {
    var func = anchor_orig['get_' + prop];
    if (func) {
      return func.call(this);
    } else {
      return '';
    }
  };

  this.init_loc_override(
    this.$wbwindow.HTMLAnchorElement.prototype,
    anchor_setter,
    anchor_getter
  );
  this.$wbwindow.HTMLAnchorElement.prototype.toString = function () {
    return this.href;
  };
};

Wombat.prototype.overrideAreaElem = function () {
  if (!this.$wbwindow.HTMLAreaElement || !this.$wbwindow.HTMLAreaElement.prototype) {
    return;
  }
  var area_orig = {};

  for (var i = 0; i < this.URL_PROPS.length; i++) {
    var prop = this.URL_PROPS[i];
    area_orig['get_' + prop] = this.get_orig_getter(
      this.$wbwindow.HTMLAreaElement.prototype,
      prop
    );
    area_orig['set_' + prop] = this.get_orig_setter(
      this.$wbwindow.HTMLAreaElement.prototype,
      prop
    );
  }

  var anchor_setter = function (prop, value) {
    var func = area_orig['set_' + prop];
    if (func) {
      return func.call(this, value);
    } else {
      return '';
    }
  };

  var anchor_getter = function (prop) {
    var func = area_orig['get_' + prop];
    if (func) {
      return func.call(this);
    } else {
      return '';
    }
  };

  this.init_loc_override(
    this.$wbwindow.HTMLAreaElement.prototype,
    anchor_setter,
    anchor_getter
  );
  this.$wbwindow.HTMLAreaElement.prototype.toString = function () {
    return this.href;
  };
};

Wombat.prototype.override_html_assign = function (elem, prop, rewrite_getter) {
  if (!this.$wbwindow.DOMParser || !elem || !elem.prototype) {
    return;
  }

  var obj = elem.prototype;

  var orig_getter = this.get_orig_getter(obj, prop);
  var orig_setter = this.get_orig_setter(obj, prop);

  if (!orig_setter) {
    return;
  }

  var wombat = this;
  var setter = function (orig) {
    var res = orig;
    if (!this._no_rewrite) {
      // init_iframe_insert_obs(this);
      if (this.tagName === 'STYLE') {
        res = wombat.rewrite_style(orig);
      } else {
        res = wombat.rewrite_html(orig);
      }
    }
    orig_setter.call(this, res);
  };

  var getter = function () {
    var res = orig_getter.call(this);
    if (!this._no_rewrite) {
      res = res.replace(wombat.wb_unrewrite_rx, '');
    }
    return res;
  };

  this.def_prop(obj, prop, setter, rewrite_getter ? getter : orig_getter);
};

Wombat.prototype.override_iframe_content_access = function (prop) {
  if (
    !this.$wbwindow.HTMLIFrameElement ||
    !this.$wbwindow.HTMLIFrameElement.prototype
  ) {
    return;
  }

  var obj = this.$wbwindow.HTMLIFrameElement.prototype;

  var orig_getter = this.get_orig_getter(obj, prop);

  if (!orig_getter) {
    return;
  }

  var orig_setter = this.get_orig_setter(obj, prop);

  var wombat = this;

  var getter = function () {
    wombat.init_iframe_wombat(this);
    return wombat.obj_to_proxy(orig_getter.call(this));
  };

  this.def_prop(obj, prop, orig_setter, getter);
  obj['_get_' + prop] = orig_getter;
};

Wombat.prototype.override_frames_access = function ($wbwindow) {
  $wbwindow.__wb_frames = $wbwindow.frames;
  var wombat = this;
  var getter = function () {
    for (var i = 0; i < this.__wb_frames.length; i++) {
      try {
        wombat.init_new_window_wombat(this.__wb_frames[i]);
      } catch (e) {}
    }
    return this.__wb_frames;
  };

  this.def_prop($wbwindow, 'frames', undefined, getter);
  this.def_prop($wbwindow.Window.prototype, 'frames', undefined, getter);
};

Wombat.prototype.override_func_this_proxy_to_obj = function (cls, method, obj) {
  if (!cls) {
    return;
  }
  var ovrObj = obj;
  if (!obj && cls.prototype && cls.prototype[method]) {
    ovrObj = cls.prototype;
  } else if (!obj && cls[method]) {
    ovrObj = cls;
  }

  if (!ovrObj) {
    return;
  }

  var orig = ovrObj[method];

  var wombat = this;

  function deproxy () {
    if (orig.__WB_orig_apply) {
      return orig.__WB_orig_apply(wombat.proxy_to_obj(this), arguments);
    }
    return orig.apply(wombat.proxy_to_obj(this), arguments);
  }

  ovrObj[method] = deproxy;
};

Wombat.prototype.copyArgsDeproxyFirst = function (args) {
  var newArgs = new Array(args.length);
  newArgs[0] = this.proxy_to_obj(args[0]);
  for (var i = 1; i < args.length; ++i) {
    newArgs[i] = args[i];
  }
  return newArgs;
};

Wombat.prototype.override_func_first_arg_proxy_to_obj = function (cls, method) {
  if (!cls || !cls.prototype) {
    return;
  }
  var prototype = cls.prototype;
  var orig = prototype[method];
  var wombat = this;

  function deproxy () {
    var newArgs = wombat.copyArgsDeproxyFirst(arguments);
    var thisObj = wombat.proxy_to_obj(this);
    if (orig.__WB_orig_apply) {
      return orig.__WB_orig_apply(thisObj, newArgs);
    }
    return orig.apply(thisObj, arguments);
  }

  prototype[method] = deproxy;
};

Wombat.prototype.override_apply_func = function ($wbwindow) {
  if ($wbwindow.Function.prototype.__WB_orig_apply) {
    return;
  }

  var orig_apply = $wbwindow.Function.prototype.apply;

  $wbwindow.Function.prototype.__WB_orig_apply = orig_apply;

  var wombat = this;

  function deproxy (obj, args) {
    if (wombat.wb_funToString.call(this).indexOf('[native code]') >= 0) {
      if (args) {
        for (var i = 0; i < args.length; i++) {
          args[i] = wombat.proxy_to_obj(args[i]);
        }
      }
      obj = wombat.proxy_to_obj(obj);
    }
    return this.__WB_orig_apply(obj, args);
  }

  $wbwindow.Function.prototype.apply = deproxy;
  this.wb_funToString.apply = orig_apply;
};

Wombat.prototype.overrideSrcsetAttr = function (obj, mod) {
  var orig_getter = this.get_orig_getter(obj, 'srcset');
  var orig_setter = this.get_orig_setter(obj, 'srcset');

  var wombat = this;

  var setter = function (orig) {
    var val = wombat.rewrite_srcset(orig);
    if (orig_setter) {
      return orig_setter.call(this, val);
    } else if (wombat.wb_setAttribute) {
      return wombat.wb_setAttribute.call(this, 'srcset', val);
    }
  };

  var getter = function () {
    var res;

    if (orig_getter) {
      res = orig_getter.call(this);
    } else if (wombat.wb_getAttribute) {
      res = wombat.wb_getAttribute.call(this, 'srcset');
    }
    res = wombat.extract_orig(res);

    return res;
  };

  this.def_prop(obj, 'srcset', setter, getter);
};

Wombat.prototype.overrideHrefAttr = function (obj, mod) {
  var orig_getter = this.get_orig_getter(obj, 'href');
  var orig_setter = this.get_orig_setter(obj, 'href');

  var wombat = this;

  var setter = function (orig) {
    var val;
    if (mod === 'cs_' && orig.indexOf('data:text/css') === 0) {
      val = wombat.rewrite_inline_style(orig);
    } else if (this.tagName === 'LINK') {
      var relV = this.rel;
      if (relV === 'import' || relV === 'preload') {
        var maybeAs = wombat.linkAsTypes[this.as];
        mod = maybeAs != null ? maybeAs : 'mp_';
      } else if (relV === 'stylesheet' && mod !== 'cs_') {
        mod = 'cs_';
      }
      val = wombat.rewrite_url(orig, false, mod);
    } else {
      val = wombat.rewrite_url(orig, false, mod);
    }
    if (orig_setter) {
      return orig_setter.call(this, val);
    } else if (wombat.wb_setAttribute) {
      return wombat.wb_setAttribute.call(this, 'href', val);
    }
  };

  var getter = function () {
    var res;

    if (orig_getter) {
      res = orig_getter.call(this);
    } else if (wombat.wb_getAttribute) {
      res = wombat.wb_getAttribute.call(this, 'href');
    }
    res = wombat.extract_orig(res);

    return res;
  };

  this.def_prop(obj, 'href', setter, getter);
};

Wombat.prototype.init_ajax_rewrite = function () {
  if (
    !this.$wbwindow.XMLHttpRequest ||
    !this.$wbwindow.XMLHttpRequest.prototype ||
    !this.$wbwindow.XMLHttpRequest.prototype.open
  ) {
    return;
  }

  var orig = this.$wbwindow.XMLHttpRequest.prototype.open;

  var wombat = this;

  function open_rewritten (method, url, async, user, password) {
    var rwURL = url;
    if (!this._no_rewrite) {
      rwURL = wombat.rewrite_url(url);
    }

    // defaults to true
    if (async !== false) {
      async = true;
    }

    orig.call(this, method, rwURL, async, user, password);
    if (!wombat.starts_with(rwURL, 'data:')) {
      this.setRequestHeader('X-Pywb-Requested-With', 'XMLHttpRequest');
    }
  }

  // // attempt to hide our override
  // open_rewritten.toString = orig.toString.bind(orig)

  this.$wbwindow.XMLHttpRequest.prototype.open = open_rewritten;

  // responseURL override
  this.override_prop_extract(
    this.$wbwindow.XMLHttpRequest.prototype,
    'responseURL'
  );
};

Wombat.prototype.init_attr_overrides = function () {
  this.overrideHrefAttr(this.$wbwindow.HTMLLinkElement.prototype, 'cs_');
  this.overrideHrefAttr(this.$wbwindow.CSSStyleSheet.prototype, 'cs_');
  this.overrideHrefAttr(this.$wbwindow.HTMLBaseElement.prototype, 'mp_');
  // this.overrideHrefAttr(this.$wbwindow.HTMLAreaElement.prototype);
  this.overrideSrcsetAttr(this.$wbwindow.HTMLImageElement.prototype, 'im_');
  this.overrideSrcsetAttr(this.$wbwindow.HTMLSourceElement.prototype, 'oe_');
  this.override_attr(this.$wbwindow.HTMLVideoElement.prototype, 'poster', 'im_');
  this.override_attr(this.$wbwindow.HTMLAudioElement.prototype, 'poster', 'im_');
  this.override_attr(this.$wbwindow.HTMLImageElement.prototype, 'src', 'im_');
  this.override_attr(this.$wbwindow.HTMLInputElement.prototype, 'src', 'oe_');
  this.override_attr(this.$wbwindow.HTMLEmbedElement.prototype, 'src', 'oe_');
  this.override_attr(this.$wbwindow.HTMLVideoElement.prototype, 'src', 'oe_');
  this.override_attr(this.$wbwindow.HTMLAudioElement.prototype, 'src', 'oe_');
  this.override_attr(this.$wbwindow.HTMLSourceElement.prototype, 'src', 'oe_');
  if (window.HTMLTrackElement && window.HTMLTrackElement.prototype) {
    this.override_attr(this.$wbwindow.HTMLTrackElement.prototype, 'src', 'oe_');
  }
  this.override_attr(this.$wbwindow.HTMLObjectElement.prototype, 'data', 'oe_');
  this.override_attr(this.$wbwindow.HTMLMetaElement.prototype, 'content', 'mp_');
  this.override_attr(this.$wbwindow.HTMLFormElement.prototype, 'action', 'mp_');
  this.override_attr(this.$wbwindow.HTMLIFrameElement.prototype, 'src', 'if_');
  if (this.$wbwindow.HTMLFrameElement && this.$wbwindow.HTMLFrameElement.prototype) {
    this.override_attr(this.$wbwindow.HTMLFrameElement.prototype, 'src', 'if_');
  }
  this.override_attr(this.$wbwindow.HTMLScriptElement.prototype, 'src', 'js_');

  this.override_anchor_elem();
  this.overrideAreaElem();

  var style_proto = this.$wbwindow.CSSStyleDeclaration.prototype;

  // For FF
  if (this.$wbwindow.CSS2Properties) {
    style_proto = this.$wbwindow.CSS2Properties.prototype;
  }

  this.override_style_attr(style_proto, 'cssText');

  this.override_style_attr(style_proto, 'background', 'background');
  this.override_style_attr(style_proto, 'backgroundImage', 'background-image');

  this.override_style_attr(style_proto, 'cursor', 'cursor');

  this.override_style_attr(style_proto, 'listStyle', 'list-style');
  this.override_style_attr(style_proto, 'listStyleImage', 'list-style-image');

  this.override_style_attr(style_proto, 'border', 'border');
  this.override_style_attr(style_proto, 'borderImage', 'border-image');
  this.override_style_attr(
    style_proto,
    'borderImageSource',
    'border-image-source'
  );

  this.override_style_setProp(style_proto);
};

Wombat.prototype.init_audio_override = function () {
  if (!this.$wbwindow.Audio) {
    return;
  }

  var orig_audio = this.$wbwindow.Audio;
  var wombat = this;
  this.$wbwindow.Audio = (function (Audio) {
    return function (url) {
      return new Audio(wombat.rewrite_url(url));
    };
  })(this.$wbwindow.Audio);

  this.$wbwindow.Audio.prototype = orig_audio.prototype;
  Object.defineProperty(this.$wbwindow.Audio.prototype, 'constructor', {
    value: this.$wbwindow.Audio
  });
};

Wombat.prototype.init_bad_prefixes = function (prefix) {
  this.BAD_PREFIXES = [
    'http:' + prefix,
    'https:' + prefix,
    'http:/' + prefix,
    'https:/' + prefix
  ];
};

Wombat.prototype.init_crypto_random = function () {
  if (!this.$wbwindow.crypto || !this.$wbwindow.Crypto) {
    return;
  }

  // var orig_getrandom = this.$wbwindow.Crypto.prototype.getRandomValues
  var self = this;
  var new_getrandom = function (array) {
    for (var i = 0; i < array.length; i++) {
      array[i] = parseInt(self.$wbwindow.Math.random() * 4294967296);
    }
    return array;
  };

  this.$wbwindow.Crypto.prototype.getRandomValues = new_getrandom;
  this.$wbwindow.crypto.getRandomValues = new_getrandom;
};

Wombat.prototype.init_date_override = function (timestamp) {
  if (this.$wbwindow.__wb_Date_now) {
    return;
  }
  timestamp = parseInt(timestamp) * 1000;
  // var timezone = new Date().getTimezoneOffset() * 60 * 1000;
  // Already UTC!
  var timezone = 0;
  var start_now = this.$wbwindow.Date.now();
  var timediff = start_now - (timestamp - timezone);

  var orig_date = this.$wbwindow.Date;

  var orig_utc = this.$wbwindow.Date.UTC;
  var orig_parse = this.$wbwindow.Date.parse;
  var orig_now = this.$wbwindow.Date.now;

  this.$wbwindow.__wb_Date_now = orig_now;

  this.$wbwindow.Date = (function (Date) {
    return function (A, B, C, D, E, F, G) {
      // Apply doesn't work for constructors and Date doesn't
      // seem to like undefined args, so must explicitly
      // call constructor for each possible args 0..7
      if (A === undefined) {
        return new Date(orig_now() - timediff);
      } else if (B === undefined) {
        return new Date(A);
      } else if (C === undefined) {
        return new Date(A, B);
      } else if (D === undefined) {
        return new Date(A, B, C);
      } else if (E === undefined) {
        return new Date(A, B, C, D);
      } else if (F === undefined) {
        return new Date(A, B, C, D, E);
      } else if (G === undefined) {
        return new Date(A, B, C, D, E, F);
      } else {
        return new Date(A, B, C, D, E, F, G);
      }
    };
  })(this.$wbwindow.Date);

  this.$wbwindow.Date.prototype = orig_date.prototype;

  this.$wbwindow.Date.now = function now () {
    return orig_now() - timediff;
  };

  this.$wbwindow.Date.UTC = orig_utc;
  this.$wbwindow.Date.parse = orig_parse;

  this.$wbwindow.Date.__WB_timediff = timediff;

  Object.defineProperty(this.$wbwindow.Date.prototype, 'constructor', {
    value: this.$wbwindow.Date
  });
};

Wombat.prototype.init_doc_title_override = function () {
  var orig_get_title = this.get_orig_getter(this.$wbwindow.document, 'title');
  var orig_set_title = this.get_orig_setter(this.$wbwindow.document, 'title');

  var wombat = this;

  function set_title (value) {
    var res = orig_set_title.call(this, value);

    var message = {
      wb_type: 'title',
      title: value
    };

    wombat.send_top_message(message);

    return res;
  }

  this.def_prop(this.$wbwindow.document, 'title', set_title, orig_get_title);
};

Wombat.prototype.initFontFaceOverride = function () {
  if (!this.$wbwindow.FontFace || this.$wbwindow.FontFace.__wboverriden__) {
    return;
  }
  // per https://drafts.csswg.org/css-font-loading/#FontFace-interface and Chrome, FF, Opera Support
  var wombat = this;
  var origFontFace = this.$wbwindow.FontFace;
  this.$wbwindow.FontFace = (function (FontFace) {
    return function (family, source, descriptors) {
      var rwSource = source;
      if (source != null) {
        if (typeof source !== 'string') {
          source = source.toString(); // is CSSOMString or ArrayBuffer or ArrayBufferView
        }
        rwSource = wombat.rewrite_inline_style(source);
      }
      return new FontFace(family, rwSource, descriptors);
    };
  })(this.$wbwindow.FontFace);
  this.$wbwindow.FontFace.prototype = origFontFace.prototype;
  Object.defineProperty(this.$wbwindow.FontFace.prototype, 'constructor', {
    value: this.$wbwindow.FontFace
  });
  this.$wbwindow.FontFace.__wboverriden__ = true;
};

Wombat.prototype.init_fixed_ratio = function () {
  // otherwise, just set it
  this.$wbwindow.devicePixelRatio = 1;

  // prevent changing, if possible
  if (Object.defineProperty) {
    try {
      // fixed pix ratio
      Object.defineProperty(this.$wbwindow, 'devicePixelRatio', {
        value: 1,
        writable: false
      });
    } catch (e) {}
  }
};

Wombat.prototype.init_paths = function (wbinfo) {
  this.wb_info = wbinfo;
  this.wb_opts = wbinfo.wombat_opts;
  this.wb_replay_prefix = wbinfo.prefix;
  this.wb_is_proxy = wbinfo.proxy_magic || !this.wb_replay_prefix;

  this.wb_info.top_host = this.wb_info.top_host || '*';

  this.wb_curr_host =
    this.$wbwindow.location.protocol + '//' + this.$wbwindow.location.host;

  wbinfo.wombat_opts = wbinfo.wombat_opts || {};

  this.wb_orig_scheme = wbinfo.wombat_scheme + '://';
  this.wb_orig_origin = this.wb_orig_scheme + wbinfo.wombat_host;

  this.wb_abs_prefix = this.wb_replay_prefix;

  if (!wbinfo.is_live && wbinfo.wombat_ts) {
    this.wb_capture_date_part = '/' + wbinfo.wombat_ts + '/';
  } else {
    this.wb_capture_date_part = '';
  }

  this.init_bad_prefixes(this.wb_replay_prefix);
};

Wombat.prototype.init_seeded_random = function (seed) {
  // Adapted from:
  // http://indiegamr.com/generate-repeatable-random-numbers-in-js/

  this.$wbwindow.Math.seed = parseInt(seed);
  var self = this;

  function seeded_random () {
    self.$wbwindow.Math.seed =
      (self.$wbwindow.Math.seed * 9301 + 49297) % 233280;
    return self.$wbwindow.Math.seed / 233280;
  }

  this.$wbwindow.Math.random = seeded_random;
};

Wombat.prototype.init_history_overrides = function () {
  this.override_history_func('pushState');
  this.override_history_func('replaceState');
  var wombat = this;
  this.$wbwindow.addEventListener('popstate', function () {
    wombat.send_history_update(
      wombat.$wbwindow.WB_wombat_location.href,
      wombat.$wbwindow.document.title
    );
  });
};

Wombat.prototype.init_fetch_rewrite = function () {
  if (!this.$wbwindow.fetch) {
    return;
  }

  var orig_fetch = this.$wbwindow.fetch;

  var wombat = this;
  this.$wbwindow.fetch = function (input, init_opts) {
    var inputType = typeof input;
    if (inputType === 'string') {
      input = wombat.rewrite_url(input);
    } else if (inputType === 'object' && input.url) {
      var new_url = wombat.rewrite_url(input.url);
      if (new_url !== input.url) {
        input = new Request(new_url, input);
      }
    } else if (inputType === 'object' && input.href) {
      // it is likely that input is either window.location or window.URL
      input = wombat.rewrite_url(input.href);
    }

    init_opts = init_opts || {};
    init_opts['credentials'] = 'include';

    return orig_fetch.call(wombat.proxy_to_obj(this), input, init_opts);
  };
  // // attempt to hide our override
  // this.$wbwindow.fetch.toString = orig_fetch.toString.bind(orig_fetch)
};

Wombat.prototype.init_request_override = function () {
  var orig_request = this.$wbwindow.Request;

  if (!orig_request) {
    return;
  }
  var womabt = this;
  this.$wbwindow.Request = (function (Request) {
    return function (input, init_opts) {
      if (typeof input === 'string') {
        input = womabt.rewrite_url(input);
      } else if (typeof input === 'object' && input.url) {
        var new_url = womabt.rewrite_url(input.url);

        if (new_url !== input.url) {
          //    input = new Request(new_url, input);
          input.url = new_url;
        }
      }

      init_opts = init_opts || {};
      init_opts['credentials'] = 'include';

      return new Request(input, init_opts);
    };
  })(this.$wbwindow.Request);

  this.$wbwindow.Request.prototype = orig_request.prototype;
};

Wombat.prototype.init_setAttribute_override = function () {
  if (
    !this.$wbwindow.Element ||
    !this.$wbwindow.Element.prototype ||
    !this.$wbwindow.Element.prototype.setAttribute
  ) {
    return;
  }

  var wombat = this;
  var orig_setAttribute = this.$wbwindow.Element.prototype.setAttribute;
  this.wb_setAttribute = orig_setAttribute;

  this.$wbwindow.Element.prototype._orig_setAttribute = orig_setAttribute;
  this.$wbwindow.Element.prototype.setAttribute = function setAttribute (
    name,
    value
  ) {
    var rwValue = value;
    if (name && typeof rwValue === 'string') {
      var lowername = name.toLowerCase();

      if (
        this.tagName === 'LINK' &&
        lowername === 'href' &&
        rwValue.indexOf('data:text/css') === 0
      ) {
        rwValue = wombat.rewrite_inline_style(rwValue);
      } else if (wombat.should_rewrite_attr(this.tagName, lowername)) {
        wombat.removeWBOSRC(this);
        if (!this._no_rewrite) {
          var mod = wombat.rwModForElement(this, lowername);
          rwValue = wombat.rewrite_url(rwValue, false, mod);
        }
      } else if (lowername === 'style') {
        rwValue = wombat.rewrite_style(rwValue);
      } else if (lowername === 'srcset') {
        rwValue = wombat.rewrite_srcset(rwValue);
      }
    }
    orig_setAttribute.call(this, name, rwValue);
  };
};

Wombat.prototype.init_getAttribute_override = function () {
  if (
    !this.$wbwindow.Element ||
    !this.$wbwindow.Element.prototype ||
    !this.$wbwindow.Element.prototype.getAttribute
  ) {
    return;
  }

  var orig_getAttribute = this.$wbwindow.Element.prototype.getAttribute;
  this.wb_getAttribute = orig_getAttribute;
  var wombat = this;
  this.$wbwindow.Element.prototype.getAttribute = function (name) {
    var result = orig_getAttribute.call(this, name);

    if (wombat.should_rewrite_attr(this.tagName, name)) {
      var maybeWBOSRC = wombat.retrieveWBOSRC(this);
      if (maybeWBOSRC) {
        return maybeWBOSRC;
      }
      result = wombat.extract_orig(result);
    } else if (
      wombat.starts_with(name, 'data-') &&
      wombat.starts_with(result, wombat.VALID_PREFIXES)
    ) {
      result = wombat.extract_orig(result);
    }

    return result;
  };
};

Wombat.prototype.init_svg_image_overrides = function () {
  if (!this.$wbwindow.SVGImageElement) {
    return;
  }

  var orig_getAttr = this.$wbwindow.SVGImageElement.prototype.getAttribute;
  var orig_getAttrNS = this.$wbwindow.SVGImageElement.prototype.getAttributeNS;
  var orig_setAttr = this.$wbwindow.SVGImageElement.prototype.setAttribute;
  var orig_setAttrNS = this.$wbwindow.SVGImageElement.prototype.setAttributeNS;
  var wombat = this;
  this.$wbwindow.SVGImageElement.prototype.getAttribute = function getAttribute (
    name
  ) {
    var value = orig_getAttr.call(this, name);

    if (name.indexOf('xlink:href') >= 0 || name === 'href') {
      value = wombat.extract_orig(value);
    }

    return value;
  };

  this.$wbwindow.SVGImageElement.prototype.getAttributeNS = function getAttributeNS (
    ns,
    name
  ) {
    var value = orig_getAttrNS.call(this, ns, name);

    if (name === 'href') {
      value = wombat.extract_orig(value);
    }

    return value;
  };

  this.$wbwindow.SVGImageElement.prototype.setAttribute = function setAttribute (
    name,
    value
  ) {
    if (name.indexOf('xlink:href') >= 0 || name === 'href') {
      value = wombat.rewrite_url(value);
    }

    return orig_setAttr.call(this, name, value);
  };

  this.$wbwindow.SVGImageElement.prototype.setAttributeNS = function setAttributeNS (
    ns,
    name,
    value
  ) {
    if (name === 'href') {
      value = wombat.rewrite_url(value);
    }

    return orig_setAttrNS.call(this, ns, name, value);
  };
};

Wombat.prototype.init_createElementNS_fix = function () {
  if (
    !this.$wbwindow.document.createElementNS ||
    !this.$wbwindow.Document.prototype.createElementNS
  ) {
    return;
  }
  var orig_createElementNS = this.$wbwindow.document.createElementNS;
  var wombat = this;

  function createElementNS_fix (namespaceURI, qualifiedName) {
    namespaceURI = wombat.extract_orig(namespaceURI);
    return orig_createElementNS.call(this, namespaceURI, qualifiedName);
  }

  this.$wbwindow.Document.prototype.createElementNS = createElementNS_fix;
  this.$wbwindow.document.createElementNS = createElementNS_fix;
};

Wombat.prototype.init_insertAdjacentHTML_override = function () {
  if (
    !this.$wbwindow.Element ||
    !this.$wbwindow.Element.prototype ||
    !this.$wbwindow.Element.prototype.insertAdjacentHTML
  ) {
    return;
  }

  var orig_insertAdjacentHTML = this.$wbwindow.Element.prototype.insertAdjacentHTML;
  var wombat = this;
  this.$wbwindow.Element.prototype.insertAdjacentHTML = function insertAdjacentHTML (
    position,
    text
  ) {
    if (!this._no_rewrite) {
      text = wombat.rewrite_html(text);
    }
    return orig_insertAdjacentHTML.call(this, position, text);
  };
};

Wombat.prototype.initInsertAdjacentElementOverride = function () {
  if (
    !this.$wbwindow.Element ||
    !this.$wbwindow.Element.prototype ||
    !this.$wbwindow.Element.prototype.insertAdjacentElement
  ) {
    return;
  }
  var wombat = this;
  var origIAdjElem = this.$wbwindow.Element.prototype.insertAdjacentElement;
  this.$wbwindow.Element.prototype.insertAdjacentElement = function insertAdjacentElement (
    position,
    element
  ) {
    if (!this._no_rewrite) {
      wombat.rewrite_elem(element);
      // special check for nested elements
      if (element.children || element.childNodes) {
        wombat.recurse_rewrite_elem(element);
      }
      return origIAdjElem.call(this, position, element);
    }
    return origIAdjElem.call(this, position, element);
  };
};

Wombat.prototype.init_dom_override = function () {
  if (!this.$wbwindow.Node || !this.$wbwindow.Node.prototype) {
    return;
  }

  this.replace_dom_func('appendChild');
  this.replace_dom_func('insertBefore');
  this.replace_dom_func('replaceChild');

  this.override_prop_to_proxy(this.$wbwindow.Node.prototype, 'ownerDocument');
  this.override_prop_to_proxy(
    this.$wbwindow.HTMLHtmlElement.prototype,
    'parentNode'
  );
  this.override_prop_to_proxy(this.$wbwindow.Event.prototype, 'target');
};

Wombat.prototype.init_doc_overrides = function ($document) {
  if (!Object.defineProperty) {
    return;
  }

  // referrer
  this.override_prop_extract($document, 'referrer');

  // origin
  this.def_prop($document, 'origin', undefined, function () {
    return this.WB_wombat_location.origin;
  });
  // https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/origin, chrome 59+ and ff 54+
  this.def_prop(this.$wbwindow, 'origin', undefined, function () { return this.WB_wombat_location.origin; });

  var wombat = this;
  // domain
  var domain_setter = function (val) {
    var loc = this.WB_wombat_location;

    if (loc && wombat.ends_with(loc.hostname, val)) {
      this.__wb_domain = val;
    }
  };

  var domain_getter = function () {
    return this.__wb_domain || this.WB_wombat_location.hostname;
  };

  this.def_prop($document, 'domain', domain_setter, domain_getter);
};

Wombat.prototype.init_write_override = function () {
  if (!this.$wbwindow.DOMParser) {
    return;
  }

  // Write
  var orig_doc_write = this.$wbwindow.document.write;
  var wombat = this;

  function new_write () {
    var argLen = arguments.length;
    var string;
    if (argLen === 0) {
      return orig_doc_write.call(this);
    } else if (argLen === 1) {
      string = arguments[0];
    } else {
      // use Array.join rather than Array.apply because join works with array like objects
      string = wombat.$wbwindow.Array.prototype.join.call(arguments, '');
    }
    var new_buff = wombat.rewrite_html(string, true);
    if (!new_buff) {
      return;
    }
    var res = orig_doc_write.call(this, new_buff);
    wombat.init_new_window_wombat(this.defaultView);
    return res;
  }

  this.$wbwindow.document.write = new_write;
  this.$wbwindow.Document.prototype.write = new_write;

  // Writeln
  var orig_doc_writeln = this.$wbwindow.document.writeln;

  var new_writeln = function () {
    var argLen = arguments.length;
    var string;
    if (argLen === 0) {
      return orig_doc_writeln.call(this);
    } else if (argLen === 1) {
      string = arguments[0];
    } else {
      string = wombat.$wbwindow.Array.prototype.join.call(arguments, '');
    }
    var new_buff = wombat.rewrite_html(string, true);
    if (!new_buff) {
      return;
    }
    var res = orig_doc_writeln.call(this, new_buff);
    wombat.init_new_window_wombat(this.defaultView);
    return res;
  };

  this.$wbwindow.document.writeln = new_writeln;
  this.$wbwindow.Document.prototype.writeln = new_writeln;

  // Open
  var orig_doc_open = this.$wbwindow.document.open;

  var new_open = function () {
    var res = orig_doc_open.call(this);
    wombat.init_new_window_wombat(this.defaultView);
    return res;
  };

  this.$wbwindow.document.open = new_open;
  this.$wbwindow.Document.prototype.open = new_open;
};

Wombat.prototype.init_iframe_wombat = function (iframe) {
  var win;

  if (iframe._get_contentWindow) {
    win = iframe._get_contentWindow.call(iframe);
  } else {
    win = iframe.contentWindow;
  }

  try {
    if (!win || win === this.$wbwindow || win._skip_wombat || win._wb_wombat) {
      return;
    }
  } catch (e) {
    return;
  }

  // var src = iframe.src;
  var src = this.wb_getAttribute.call(iframe, 'src');

  this.init_new_window_wombat(win, src);
};

Wombat.prototype.init_new_window_wombat = function (win, src) {
  if (!win || win._wb_wombat) {
    return;
  }

  if (!src || src === '' || src === 'about:blank' || src.indexOf('javascript:') >= 0) {
    // win._WBWombat = wombat_internal(win);
    // win._wb_wombat = new win._WBWombat(wb_info);
    var wb = new Wombat(win, this.wb_info);
    win._wb_wombat = wb.wombat_init();
  } else {
    // These should get overriden when content is loaded, but just in case...
    // win._WB_wombat_location = win.location;
    // win.document.WB_wombat_location = win.document.location;
    // win._WB_wombat_top = $wbwindow.WB_wombat_top;

    this.init_proto_pm_origin(win);
    this.init_postmessage_override(win);
    this.init_messageevent_override(win);
  }
};

Wombat.prototype.initTimeoutIntervalOverrides = function (which) {
  // because [setTimeout|setInterval]('document.location.href = "xyz.com"', time) is legal and used
  if (this.$wbwindow[which] && !this.$wbwindow[which].__$wbpatched$__) {
    var original = this.$wbwindow[which];
    var wombat = this;
    this.$wbwindow[which] = function () {
      // strings are primitives with a prototype or __proto__ of String depending on the browser
      var rw = arguments[0] != null && Object.getPrototypeOf(arguments[0]) === String.prototype;
      // do not mess with the arguments object unless you want instant de-optimization
      var args = rw ? new Array(arguments.length) : arguments;
      if (rw) {
        if (wombat.$wbwindow.Proxy) {
          args[0] = wombat.wrapScriptTextJsProxy(arguments[0]);
        } else {
          args[0] = arguments[0].replace(/\blocation\b/g, 'WB_wombat_$&');
        }
        for (var i = 1; i < arguments.length; ++i) {
          args[i] = wombat.proxy_to_obj(arguments[i]);
        }
      }
      // setTimeout|setInterval does not require its this arg to be window so just in case
      // someone got funky with it
      if (original.__WB_orig_apply) {
        return original.__WB_orig_apply(null, args);
      }
      return original.apply(null, args);
    };
    this.$wbwindow[which].__$wbpatched$__ = true;
  }
};

Wombat.prototype.initAutoFetchWorker = function () {
  if (!this.wbUseAAWorker) {
    return;
  }
  this.WBAutoFetchWorker = new AutoFetchWorker(this);
  var wombat = this;
  this.utilFns.wbSheetMediaQChecker = function checkStyle () {
    // used only for link[rel='stylesheet'] so we remove our listener
    this.removeEventListener('load', wombat.utilFns.wbSheetMediaQChecker);
    // check no op condition
    if (this.sheet == null) return;
    // defer extraction to be nice :)
    wombat.WBAutoFetchWorker.deferredSheetExtraction(this.sheet);
  };
};

Wombat.prototype.init_web_worker_override = function () {
  if (!this.$wbwindow.Worker) {
    return;
  }
  // Worker unrewrite postMessage
  var orig_worker = this.$wbwindow.Worker;
  var wombat = this;
  this.$wbwindow.Worker = (function (Worker) {
    return function (url) {
      return new Worker(wombat.rewriteWorker(url));
    };
  })(orig_worker);

  this.$wbwindow.Worker.prototype = orig_worker.prototype;
};

Wombat.prototype.initSharedWorkerOverride = function () {
  if (!this.$wbwindow.SharedWorker) {
    return;
  }
  // per https://html.spec.whatwg.org/multipage/workers.html#sharedworker
  var oSharedWorker = this.$wbwindow.SharedWorker;
  var wombat = this;
  this.$wbwindow.SharedWorker = (function (SharedWorker) {
    return function (url) {
      return new SharedWorker(wombat.rewriteWorker(url));
    };
  })(oSharedWorker);

  this.$wbwindow.SharedWorker.prototype = oSharedWorker.prototype;
};

Wombat.prototype.init_service_worker_override = function () {
  if (
    !this.$wbwindow.ServiceWorkerContainer ||
    !this.$wbwindow.ServiceWorkerContainer.prototype ||
    !this.$wbwindow.ServiceWorkerContainer.prototype.register
  ) {
    return;
  }
  var orig_register = this.$wbwindow.ServiceWorkerContainer.prototype.register;
  var wombat = this;
  this.$wbwindow.ServiceWorkerContainer.prototype.register = function register (scriptURL, options) {
    scriptURL = new URL(scriptURL, wombat.$wbwindow.document.baseURI).href;
    scriptURL = wombat.rewrite_url(scriptURL, false, 'sw_');
    if (options && options.scope) {
      options.scope = wombat.rewrite_url(options.scope, false, 'mp_');
    } else {
      options = { scope: wombat.rewrite_url('/', false, 'mp_') };
    }
    return orig_register.call(this, scriptURL, options);
  };
};

Wombat.prototype.init_loc_override = function (loc, oSetter, oGetter) {
  if (Object.defineProperty) {
    for (var i = 0; i < this.URL_PROPS.length; i++) {
      var prop = this.URL_PROPS[i];
      this.def_prop(
        loc,
        prop,
        this.make_set_loc_prop(prop, oSetter, oGetter),
        this.make_get_loc_prop(prop, oGetter),
        true
      );
    }
  }
};

Wombat.prototype.init_wombat_loc = function (win) {
  if (!win || (win.WB_wombat_location && win.document.WB_wombat_location)) {
    return;
  }

  // Location
  var wombat_location = new WombatLocation(win.location, this);

  if (Object.defineProperty) {
    var setter = function (value) {
      var loc =
        this._WB_wombat_location ||
        (this.defaultView && this.defaultView._WB_wombat_location) ||
        this.location;

      if (loc) {
        loc.href = value;
      }
    };

    var getter = function () {
      return (
        this._WB_wombat_location ||
        (this.defaultView && this.defaultView._WB_wombat_location) ||
        this.location
      );
    };

    this.def_prop(win.Object.prototype, 'WB_wombat_location', setter, getter);

    this.init_proto_pm_origin(win);

    win._WB_wombat_location = wombat_location;
  } else {
    win.WB_wombat_location = wombat_location;

    // Check quickly after page load
    setTimeout(this.check_all_locations, 500);

    // Check periodically every few seconds
    setInterval(this.check_all_locations, 500);
  }
};

Wombat.prototype.init_proto_pm_origin = function (win) {
  if (win.Object.prototype.__WB_pmw) {
    return;
  }

  function pm_origin (origin_window) {
    this.__WB_source = origin_window;
    return this;
  }

  try {
    win.Object.defineProperty(win.Object.prototype, '__WB_pmw', {
      get: function () {
        return pm_origin;
      },
      set: function () {},
      configurable: true,
      enumerable: false
    });
  } catch (e) {}

  win.__WB_check_loc = function (loc) {
    if (loc instanceof Location || loc instanceof WombatLocation) {
      return this.WB_wombat_location;
    } else {
      return {};
    }
  };
};

Wombat.prototype.init_hash_change = function () {
  if (!this.$wbwindow.__WB_top_frame) {
    return;
  }

  var wombat = this;

  function receive_hash_change (event) {
    var source = wombat.proxy_to_obj(event.source);

    if (!event.data || source !== wombat.$wbwindow.__WB_top_frame) {
      return;
    }

    var message = event.data;

    if (!message.wb_type) {
      return;
    }

    if (message.wb_type === 'outer_hashchange') {
      if (wombat.$wbwindow.location.hash !== message.hash) {
        wombat.$wbwindow.location.hash = message.hash;
      }
    }
  }

  function send_hash_change () {
    var message = {
      wb_type: 'hashchange',
      hash: wombat.$wbwindow.location.hash
    };

    wombat.send_top_message(message);
  }

  this.$wbwindow.addEventListener('message', receive_hash_change);

  this.$wbwindow.addEventListener('hashchange', send_hash_change);
};

Wombat.prototype.init_postmessage_override = function ($wbwindow) {
  if (!$wbwindow.postMessage || $wbwindow.__orig_postMessage) {
    return;
  }

  var orig = $wbwindow.postMessage;

  $wbwindow.__orig_postMessage = orig;

  var wombat = this;
  // use this_obj.__WB_source not window to fix google calendar embeds, pm_origin sets this.__WB_source
  var postmessage_rewritten = function (message, targetOrigin, transfer, from_top) {
    var from;
    var src_id;
    var this_obj = wombat.proxy_to_obj(this);

    if (this_obj.__WB_source && this_obj.__WB_source.WB_wombat_location) {
      var source = this_obj.__WB_source;

      from = source.WB_wombat_location.origin;

      if (!this_obj.__WB_win_id) {
        this_obj.__WB_win_id = {};
        this_obj.__WB_counter = 0;
      }

      if (!source.__WB_id) {
        this_obj.__WB_counter += 1;
        source.__WB_id =
          this_obj.__WB_counter + source.WB_wombat_location.href;
      }
      this_obj.__WB_win_id[source.__WB_id] = source;

      src_id = source.__WB_id;

      this_obj.__WB_source = undefined;
    } else {
      from = window.WB_wombat_location.origin;
    }

    var to_origin = targetOrigin;

    // if passed in origin is the replay (rewriting missed somewhere?)
    // set origin to current 'from' origin
    if (to_origin === this_obj.location.origin) {
      to_origin = from;
    }

    var new_message = {
      from: from,
      to_origin: to_origin,
      src_id: src_id,
      message: message,
      from_top: from_top
    };

    // set to 'real' origin if not '*'
    if (targetOrigin !== '*') {
      // if target origin is null (about:blank) or empty, don't pass event at all
      // as it would never succeed
      if (
        this_obj.location.origin === 'null' ||
        this_obj.location.origin === ''
      ) {
        return;
      }
      // set to actual (rewritten) origin
      targetOrigin = this_obj.location.origin;
    }

    // console.log("Sending " + from + " -> " + to + " (" + targetOrigin + ") " + message);

    return orig.call(this_obj, new_message, targetOrigin, transfer);
  };

  $wbwindow.postMessage = postmessage_rewritten;

  $wbwindow.Window.prototype.postMessage = postmessage_rewritten;

  var event_target = null;
  if ($wbwindow.EventTarget && $wbwindow.EventTarget.prototype) {
    event_target = $wbwindow.EventTarget.prototype;
  } else {
    event_target = $wbwindow;
  }

  // ADD
  var _orig_addEventListener = event_target.addEventListener;

  var _orig_removeEventListener = event_target.removeEventListener;

  event_target.addEventListener = function (type, listener, useCapture) {
    var obj = wombat.proxy_to_obj(this);

    if (type === 'message') {
      listener = wombat.message_listeners.add_or_get(listener, function () {
        return new WrappedListener(listener, obj, wombat).listen;
      });

      return _orig_addEventListener.call(obj, type, listener, useCapture);
    } else if (type === 'storage') {
      listener = wombat.storage_listeners.add_or_get(listener, function () {
        return new SameOriginListener(listener, obj).listen;
      });
    } else {
      return _orig_addEventListener.call(obj, type, listener, useCapture);
    }
  };

  // REMOVE
  event_target.removeEventListener = function (type, listener, useCapture) {
    var obj = wombat.proxy_to_obj(this);

    if (type === 'message') {
      listener = wombat.message_listeners.remove(listener);
    } else if (type === 'storage') {
      listener = wombat.storage_listeners.remove(listener);
    }

    if (listener) {
      return _orig_removeEventListener.call(obj, type, listener, useCapture);
    }
  };

  // ONMESSAGE & ONSTORAGE
  function override_on_prop (onevent, Listener_cls) {
    // var orig_getter = wombat.get_orig_getter($wbwindow, onevent)
    var orig_setter = wombat.get_orig_setter($wbwindow, onevent);

    function setter (value) {
      this['__orig_' + onevent] = value;
      var obj = wombat.proxy_to_obj(this);
      var listener = value ? new Listener_cls(value, obj).listen : value;
      return orig_setter.call(obj, listener);
    }

    function getter () {
      return this['__orig_' + onevent];
    }

    wombat.def_prop($wbwindow, onevent, setter, getter);
  }

  override_on_prop('onmessage', WrappedListener);
  override_on_prop('onstorage', SameOriginListener);
};

Wombat.prototype.init_messageevent_override = function ($wbwindow) {
  if (!$wbwindow.MessageEvent || $wbwindow.MessageEvent.prototype.__extended) {
    return;
  }

  this.addEventOverride('target');
  this.addEventOverride('srcElement');
  this.addEventOverride('currentTarget');
  this.addEventOverride('eventPhase');
  this.addEventOverride('path');

  this.override_prop_to_proxy($wbwindow.MessageEvent.prototype, 'source');

  $wbwindow.MessageEvent.prototype.__extended = true;
};

Wombat.prototype.initMouseEventOverride = function ($wbwindow) {
  // Mouse events take an init argument of view and view == window
  if (!$wbwindow.MouseEvent || $wbwindow.MouseEvent.prototype.__extended) return;

  var wombat = this;

  // ensure if and when view is accessed from MouseEvent it is proxied
  wombat.override_prop_to_proxy($wbwindow.MouseEvent.prototype, 'view');

  // override like window.Audio
  var origME = $wbwindow.MouseEvent;

  var origInitME = $wbwindow.MouseEvent.prototype.initMouseEvent;

  // to intercept var evt = document.createEvent("MouseEvents"); evt.initMouseEvent(...);
  $wbwindow.MouseEvent.prototype.initMouseEvent = function (
    type, canBubble, cancelable, view, detail, screenX,
    screenY, clientX, clientY, ctrlKey, altKey, shiftKey,
    metaKey, button, relatedTarget
  ) {
    if (view != null) {
      view = wombat.proxy_to_obj(view);
    }
    return origInitME.call(
      this,
      type, canBubble, cancelable, view, detail, screenX,
      screenY, clientX, clientY, ctrlKey, altKey, shiftKey,
      metaKey, button, relatedTarget
    );
  };

  $wbwindow.MouseEvent = (function (MouseEvent) {
    return function (type, init) {
      if (init && init.view != null) {
        init.view = wombat.proxy_to_obj(init.view);
      }
      return new MouseEvent(type, init);
    };
  })($wbwindow.MouseEvent);

  $wbwindow.MouseEvent.prototype = origME.prototype;
  Object.defineProperty($wbwindow.MouseEvent.prototype, 'constructor', {
    value: $wbwindow.MouseEvent
  });

  // let ourselves know we already handled this
  $wbwindow.MouseEvent.prototype.__extended = true;
};

Wombat.prototype.init_open_override = function () {
  var orig = this.$wbwindow.open;

  if (this.$wbwindow.Window.prototype.open) {
    orig = this.$wbwindow.Window.prototype.open;
  }

  var wombat = this;

  function open_rewritten (strUrl, strWindowName, strWindowFeatures) {
    strUrl = wombat.rewrite_url(strUrl, false, '');
    var res = orig.call(
      wombat.proxy_to_obj(this),
      strUrl,
      strWindowName,
      strWindowFeatures
    );
    wombat.init_new_window_wombat(res, strUrl);
    return res;
  }

  this.$wbwindow.open = open_rewritten;

  if (this.$wbwindow.Window.prototype.open) {
    this.$wbwindow.Window.prototype.open = open_rewritten;
  }

  for (var i = 0; i < this.$wbwindow.frames.length; i++) {
    try {
      this.$wbwindow.frames[i].open = open_rewritten;
    } catch (e) {
      console.log(e);
    }
  }
};

Wombat.prototype.init_cookies_override = function () {
  var orig_get_cookie = this.get_orig_getter(this.$wbwindow.document, 'cookie');
  var orig_set_cookie = this.get_orig_setter(this.$wbwindow.document, 'cookie');

  if (!orig_get_cookie) {
    orig_get_cookie = this.get_orig_getter(
      this.$wbwindow.Document.prototype,
      'cookie'
    );
  }
  if (!orig_set_cookie) {
    orig_set_cookie = this.get_orig_setter(
      this.$wbwindow.Document.prototype,
      'cookie'
    );
  }
  var wombat = this;
  var set_cookie = function (value) {
    if (!value) {
      return;
    }

    var newValue = value.replace(wombat.cookie_expires_regex, function (m, d1) {
      var date = new Date(d1);

      if (isNaN(date.getTime())) {
        return 'Expires=Thu,| 01 Jan 1970 00:00:00 GMT';
      }

      date = new Date(date.getTime() + Date.__WB_timediff);
      return 'Expires=' + date.toUTCString().replace(',', ',|');
    });

    var cookies = newValue.split(/,(?![|])/);

    for (var i = 0; i < cookies.length; i++) {
      cookies[i] = wombat.rewrite_cookie(cookies[i]);
    }

    newValue = cookies.join(',');

    return orig_set_cookie.call(wombat.proxy_to_obj(this), newValue);
  };

  function get_cookie () {
    return orig_get_cookie.call(wombat.proxy_to_obj(this));
  }

  this.def_prop(this.$wbwindow.document, 'cookie', set_cookie, get_cookie);
};

Wombat.prototype.init_eval_override = function () {
  var orig_eval = this.$wbwindow.eval;

  this.$wbwindow.eval = function (string) {
    if (string) {
      string = string.toString().replace(/\blocation\b/g, 'WB_wombat_$&');
    }
    orig_eval.call(this, string);
  };
};

Wombat.prototype.init_registerPH_override = function () {
  if (!this.$wbwindow.navigator.registerProtocolHandler) {
    return;
  }
  var orig_registerPH = this.$wbwindow.navigator.registerProtocolHandler;
  var wombat = this;
  this.$wbwindow.navigator.registerProtocolHandler = function (protocol, uri, title) {
    return orig_registerPH.call(this, protocol, wombat.rewrite_url(uri), title);
  };
};

Wombat.prototype.init_beacon_override = function () {
  if (!this.$wbwindow.navigator.sendBeacon) {
    return;
  }

  var orig_sendBeacon = this.$wbwindow.navigator.sendBeacon;
  var wombat = this;
  this.$wbwindow.navigator.sendBeacon = function (url, data) {
    return orig_sendBeacon.call(this, wombat.rewrite_url(url), data);
  };
};

Wombat.prototype.init_disable_notifications = function () {
  if (window.Notification) {
    window.Notification.requestPermission = function (callback) {
      if (callback) {
        // eslint-disable-next-line standard/no-callback-literal
        callback('denied');
      }

      return Promise.resolve('denied');
    };
  }

  if (window.geolocation) {
    var disabled = function (success, error, options) {
      if (error) {
        error({ code: 2, message: 'not available' });
      }
    };

    window.geolocation.getCurrentPosition = disabled;
    window.geolocation.watchPosition = disabled;
  }
};

Wombat.prototype.init_storage_override = function () {
  this.addEventOverride('storageArea', this.$wbwindow.StorageEvent.prototype);

  var local = new CustomStorage(this);
  var session = new CustomStorage(this);

  if (this.$wbwindow.Proxy) {
    var wombat = this;

    var wrapProxy = function wrapProxy (obj) {
      return new wombat.$wbwindow.Proxy(obj, {
        get: function (target, prop) {
          if (prop in target) {
            return target[prop];
          }

          return target.getItem(prop);
        },

        set: function (target, prop, value) {
          if (target.hasOwnProperty(prop)) {
            return false;
          }
          target.setItem(prop, value);
          return true;
        },

        getOwnPropertyDescriptor: function (target, prop) {
          return Object.getOwnPropertyDescriptor(target, prop);
        }
      });
    };

    local = wrapProxy(local);
    session = wrapProxy(session);
  }

  this.def_prop(this.$wbwindow, 'localStorage', undefined, function () {
    return local;
  });
  this.def_prop(this.$wbwindow, 'sessionStorage', undefined, function () {
    return session;
  });
};

Wombat.prototype.init_window_obj_proxy = function ($wbwindow) {
  if (!$wbwindow.Proxy) {
    return undefined;
  }

  var ownProps = this.getAllOwnProps($wbwindow);
  var wombat = this;
  $wbwindow._WB_wombat_obj_proxy = new $wbwindow.Proxy(
    {},
    {
      get: function (target, prop) {
        if (prop === 'top') {
          return wombat.$wbwindow.WB_wombat_top._WB_wombat_obj_proxy;
        }

        return wombat.default_proxy_get($wbwindow, prop, ownProps);
      },

      set: function (target, prop, value) {
        if (prop === 'location') {
          $wbwindow.WB_wombat_location = value;
          return true;
        } else if (prop === 'postMessage' || prop === 'document') {
          return true;
        } else {
          try {
            if (!Reflect.set(target, prop, value)) {
              return false;
            }
          } catch (e) {}

          return Reflect.set($wbwindow, prop, value);
        }
      },
      has: function (target, prop) {
        return prop in $wbwindow;
      },
      ownKeys: function (target) {
        return Object.getOwnPropertyNames($wbwindow).concat(
          Object.getOwnPropertySymbols($wbwindow)
        );
      },
      getOwnPropertyDescriptor: function (target, key) {
        // first try the underlying object's descriptor
        // (to match defineProperty() behavior)
        var descriptor = Object.getOwnPropertyDescriptor(target, key);
        if (!descriptor) {
          descriptor = Object.getOwnPropertyDescriptor($wbwindow, key);
          // if using window's descriptor, must ensure it's configurable
          if (descriptor) {
            descriptor.configurable = true;
          }
        }

        return descriptor;
      },
      getPrototypeOf: function (target) {
        return Object.getPrototypeOf($wbwindow);
      },
      setPrototypeOf: function (target, newProto) {
        return false;
      },
      isExtensible: function (target) {
        return Object.isExtensible($wbwindow);
      },
      preventExtensions: function (target) {
        Object.preventExtensions($wbwindow);
        return true;
      },
      deleteProperty: function (target, prop) {
        var propDescriptor = Object.getOwnPropertyDescriptor($wbwindow, prop);
        if (propDescriptor === undefined) {
          return true;
        }
        if (propDescriptor.configurable === false) {
          return false;
        }
        delete $wbwindow[prop];
        return true;
      },
      defineProperty: function (target, prop, desc) {
        desc = desc || {};
        if (!desc.value && !desc.get) {
          desc.value = $wbwindow[prop];
        }

        Reflect.defineProperty($wbwindow, prop, desc);

        return Reflect.defineProperty(target, prop, desc);
      }
    }
  );

  return $wbwindow._WB_wombat_obj_proxy;
};

Wombat.prototype.init_document_obj_proxy = function ($document) {
  this.init_doc_overrides($document);

  if (!this.$wbwindow.Proxy) {
    return undefined;
  }

  var ownProps = this.getAllOwnProps($document);
  var wombat = this;
  $document._WB_wombat_obj_proxy = new this.$wbwindow.Proxy($document, {
    get: function (target, prop) {
      return wombat.default_proxy_get($document, prop, ownProps);
    },

    set: function (target, prop, value) {
      if (prop === 'location') {
        $document.WB_wombat_location = value;
        return true;
      } else {
        target[prop] = value;
        return true;
      }
    }
  });

  return $document._WB_wombat_obj_proxy;
};

Wombat.prototype.init_top_frame_notify = function (wbinfo) {
  var wombat = this;

  function notify_top (event) {
    if (!wombat.$wbwindow.__WB_top_frame) {
      var hash = wombat.$wbwindow.location.hash;
      wombat.$wbwindow.location.replace(wbinfo.top_url + hash);
      return;
    }

    if (!wombat.$wbwindow.WB_wombat_location) {
      return;
    }

    var url = wombat.$wbwindow.WB_wombat_location.href;

    if (
      typeof url !== 'string' ||
      url === 'about:blank' ||
      url.indexOf('javascript:') === 0
    ) {
      return;
    }

    if (wombat.$wbwindow.document.readyState === 'complete' && wombat.wbUseAAWorker) {
      wombat.WBAutoFetchWorker.extractFromLocalDoc();
    }

    if (wombat.$wbwindow !== wombat.$wbwindow.__WB_replay_top) {
      return;
    }

    var icons = [];

    var hicons = wombat.$wbwindow.document.querySelectorAll("link[rel*='icon']");
    for (var i = 0; i < hicons.length; i++) {
      var hicon = hicons[i];
      icons.push({
        rel: hicon.rel,
        href: wombat.wb_getAttribute.call(hicon, 'href')
      });
    }

    var message = {
      'icons': icons,
      'url': wombat.$wbwindow.WB_wombat_location.href,
      'ts': wombat.wb_info.timestamp,
      'request_ts': wombat.wb_info.request_ts,
      'is_live': wombat.wb_info.is_live,
      'title': wombat.$wbwindow.document ? wombat.$wbwindow.document.title : '',
      'readyState': wombat.$wbwindow.document.readyState,
      'wb_type': 'load'
    };

    wombat.send_top_message(message);
  }

  if (this.$wbwindow.document.readyState === 'complete') {
    notify_top();
  } else if (this.$wbwindow.addEventListener) {
    this.$wbwindow.document.addEventListener('readystatechange', notify_top);
  } else if (this.$wbwindow.attachEvent) {
    this.$wbwindow.document.attachEvent('onreadystatechange', notify_top);
  }
};

Wombat.prototype.init_top_frame = function ($wbwindow) {
  // proxy mode
  if (this.wb_is_proxy) {
    $wbwindow.__WB_replay_top = $wbwindow.top;
    $wbwindow.__WB_top_frame = undefined;
    return;
  }

  function next_parent (win) {
    try {
      if (!win) {
        return false;
      }

      // if no wbinfo, see if _wb_wombat was set (eg. if about:blank page)
      if (!win.wbinfo) {
        return win._wb_wombat !== undefined;
      } else {
        // otherwise, ensure that it is not a top container frame
        return win.wbinfo.is_framed;
      }
    } catch (e) {
      return false;
    }
  }

  var replay_top = $wbwindow;

  while (replay_top.parent !== replay_top && next_parent(replay_top.parent)) {
    replay_top = replay_top.parent;
  }

  $wbwindow.__WB_replay_top = replay_top;

  var real_parent = replay_top.__WB_orig_parent || replay_top.parent;

  // Check to ensure top frame is different window and directly accessible (later refactor to support postMessage)
  // try {
  //    if ((real_parent == $wbwindow) || !real_parent.wbinfo || !real_parent.wbinfo.is_frame) {
  //        real_parent = undefined;
  //    }
  // } catch (e) {
  //    real_parent = undefined;
  // }
  if (real_parent === $wbwindow || !this.wb_info.is_framed) {
    real_parent = undefined;
  }

  if (real_parent) {
    $wbwindow.__WB_top_frame = real_parent;

    this.init_frameElement_override($wbwindow);
  } else {
    $wbwindow.__WB_top_frame = undefined;
  }

  // Fix .parent only if not embeddable, otherwise leave for accessing embedding window
  if (!this.wb_opts.embedded && replay_top === $wbwindow) {
    if (this.wbUseAAWorker) {
      var wombat = this;
      this.$wbwindow.addEventListener('message', function (event) {
        if (event.data && event.data.wb_type === 'aaworker') {
          wombat.WBAutoFetchWorker.postMessage(event.data.msg);
        }
      }, false);
    }
    $wbwindow.__WB_orig_parent = $wbwindow.parent;
    $wbwindow.parent = replay_top;
  }
};

Wombat.prototype.init_frameElement_override = function ($wbwindow) {
  if (!Object.defineProperty) {
    return;
  }

  // Also try disabling frameElement directly, though may no longer be supported in all browsers
  if (
    this.proxy_to_obj($wbwindow.__WB_replay_top) ===
    this.proxy_to_obj($wbwindow)
  ) {
    try {
      Object.defineProperty($wbwindow, 'frameElement', {
        value: null,
        configurable: false
      });
    } catch (e) {}
  }
};

Wombat.prototype.init_wombat_top = function ($wbwindow) {
  if (!Object.defineProperty) {
    return;
  }

  // from http://stackoverflow.com/a/6229603
  function isWindow (obj) {
    if (typeof window.constructor === 'undefined') {
      return obj instanceof window.constructor;
    } else {
      return obj.window === obj;
    }
  }

  var getter = function () {
    if (this.__WB_replay_top) {
      return this.__WB_replay_top;
    } else if (isWindow(this)) {
      return this;
    } else {
      return this.top;
    }
  };

  var setter = function (val) {
    this.top = val;
  };

  this.def_prop($wbwindow.Object.prototype, 'WB_wombat_top', setter, getter);
};

Wombat.prototype.wombat_init = function () {
  // wombat init
  this.init_top_frame(this.$wbwindow);
  this.init_wombat_loc(this.$wbwindow);

  // updated wb_unrewrite_rx for imgur.com
  var wb_origin = this.$wbwindow.__WB_replay_top.location.origin;
  var wb_host = this.$wbwindow.__WB_replay_top.location.host;
  var wb_proto = this.$wbwindow.__WB_replay_top.location.protocol;
  if (
    this.wb_replay_prefix &&
      this.wb_replay_prefix.indexOf(wb_origin) === 0
  ) {
    this.wb_rel_prefix = this.wb_replay_prefix.substring(wb_origin.length);
  } else {
    this.wb_rel_prefix = this.wb_replay_prefix;
  }
  // make the protocol and host optional now
  var rx =
      '((' + wb_proto + ')?//' + wb_host + ')?' + this.wb_rel_prefix + '[^/]+/';

  this.wb_unrewrite_rx = new RegExp(rx, 'g');

  this.init_wombat_top(this.$wbwindow);
  // History
  this.init_history_overrides();

  // Doc Title
  this.init_doc_title_override();

  // postMessage
  // OPT skip
  if (!this.wb_opts.skip_postmessage) {
    this.init_postmessage_override(this.$wbwindow);
    this.init_messageevent_override(this.$wbwindow);
  }

  this.init_hash_change();

  this.initMouseEventOverride(this.$wbwindow);

  // write
  this.init_write_override();

  // eval
  // init_eval_override();

  // Ajax
  this.init_ajax_rewrite();

  // Fetch
  this.init_fetch_rewrite();
  this.init_request_override();

  // Audio
  this.init_audio_override();

  // FontFace
  this.initFontFaceOverride(this.$wbwindow);

  // Worker override (experimental)
  this.initAutoFetchWorker();
  this.init_web_worker_override();
  this.init_service_worker_override();
  this.initSharedWorkerOverride();

  // innerHTML can be overriden on prototype!
  this.override_html_assign(this.$wbwindow.HTMLElement, 'innerHTML', true);
  this.override_html_assign(this.$wbwindow.HTMLElement, 'outerHTML', true);
  this.override_html_assign(this.$wbwindow.HTMLIFrameElement, 'srcdoc', true);
  this.override_html_assign(this.$wbwindow.HTMLStyleElement, 'textContent');

  // Document.URL override
  this.override_prop_extract(this.$wbwindow.Document.prototype, 'URL');
  this.override_prop_extract(this.$wbwindow.Document.prototype, 'documentURI');

  // Node.baseURI override
  this.override_prop_extract(this.$wbwindow.Node.prototype, 'baseURI');

  // Attr nodeValue and value
  this.override_attr_props();

  // init insertAdjacentHTML() override
  this.init_insertAdjacentHTML_override();
  this.initInsertAdjacentElementOverride();

  // iframe.contentWindow and iframe.contentDocument overrides to
  // ensure wombat is inited on the iframe $wbwindow!
  this.override_iframe_content_access('contentWindow');
  this.override_iframe_content_access('contentDocument');

  // override funcs to convert first arg proxy->obj
  this.override_func_first_arg_proxy_to_obj(this.$wbwindow.MutationObserver, 'observe');
  this.override_func_first_arg_proxy_to_obj(this.$wbwindow.Node, 'compareDocumentPosition');
  this.override_func_first_arg_proxy_to_obj(this.$wbwindow.Node, 'contains');
  this.override_func_first_arg_proxy_to_obj(this.$wbwindow.Document, 'createTreeWalker');

  this.override_func_this_proxy_to_obj(this.$wbwindow, 'getComputedStyle', this.$wbwindow);
  // override_func_this_proxy_to_obj($wbwindow.EventTarget, "addEventListener");
  // override_func_this_proxy_to_obj($wbwindow.EventTarget, "removeEventListener");

  this.override_apply_func(this.$wbwindow);
  this.initTimeoutIntervalOverrides(this.$wbwindow, 'setTimeout');
  this.initTimeoutIntervalOverrides(this.$wbwindow, 'setInterval');

  this.override_frames_access(this.$wbwindow);

  // setAttribute
  if (!this.wb_opts.skip_setAttribute) {
    this.init_setAttribute_override();
    this.init_getAttribute_override();
  }
  this.init_svg_image_overrides();

  // override href and src attrs
  this.init_attr_overrides();

  // Cookies
  this.init_cookies_override();

  // ensure namespace urls are NOT rewritten
  this.init_createElementNS_fix();

  // Image
  // init_image_override();

  // DOM
  // OPT skip
  if (!this.wb_opts.skip_dom) {
    this.init_dom_override();
  }

  // registerProtocolHandler override
  this.init_registerPH_override();

  // sendBeacon override
  this.init_beacon_override();

  // other overrides
  // proxy mode: only using these overrides

  // Random
  this.init_seeded_random(this.wb_info.wombat_sec);

  // Crypto Random
  this.init_crypto_random();

  // set fixed pixel ratio
  this.init_fixed_ratio();

  // Date
  this.init_date_override(this.wb_info.wombat_sec);

  // open
  this.init_open_override();

  // disable notifications
  this.init_disable_notifications();

  // custom storage
  this.init_storage_override();

  // add window and document obj proxies, if available
  this.init_window_obj_proxy(this.$wbwindow);
  this.init_document_obj_proxy(this.$wbwindow.document);

  if (this.wb_info.is_framed && this.wb_info.mod !== 'bn_') {
    this.init_top_frame_notify(this.wb_info);
  }
  var wombat = this;
  return {
    extract_orig: function (href) {
      return wombat.extract_orig(href);
    },
    rewrite_url: function (url, use_rel, mod) {
      return wombat.rewrite_url(url, use_rel, mod);
    },
    watch_elem: function (elem, func) {
      return wombat.watch_elem(elem, func);
    },
    init_new_window_wombat: function (win, src) {
      return wombat.init_new_window_wombat(win, src);
    },
    init_paths: function (wbinfo) {
      wombat.init_paths(wbinfo);
    },
    local_init: function (name) {
      var res = wombat.$wbwindow._WB_wombat_obj_proxy[name];
      if (name === 'document' && res && !res._WB_wombat_obj_proxy) {
        return wombat.init_document_obj_proxy(res) || res;
      }
      return res;
    }
  };
};
