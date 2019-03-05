/* eslint-disable camelcase */
import FuncMap from './funcMap';
import Storage from './customStorage';
import WombatLocation from './wombatLocation';
import AutoFetchWorker from './autoFetchWorker';
import { wrapSameOriginEventListener, wrapEventListener } from './listeners';

/**
 * @param {Window} $wbwindow
 * @param {Object} wbinfo
 */
function Wombat($wbwindow, wbinfo) {
  if (!(this instanceof Wombat)) return new Wombat($wbwindow, wbinfo);
  this.actual = false;
  this.debug_rw = false;
  this.$wbwindow = $wbwindow;
  this.HTTP_PREFIX = 'http://';
  this.HTTPS_PREFIX = 'https://';
  this.REL_PREFIX = '//';

  this.VALID_PREFIXES = [this.HTTP_PREFIX, this.HTTPS_PREFIX, this.REL_PREFIX];
  this.IGNORE_PREFIXES = [
    '#',
    'about:',
    'data:',
    'mailto:',
    'javascript:',
    '{',
    '*'
  ];

  this.wb_setAttribute = $wbwindow.Element.prototype.setAttribute;
  this.wb_getAttribute = $wbwindow.Element.prototype.getAttribute;
  this.wb_funToString = Function.prototype.toString;
  this.WBAutoFetchWorker = null;
  this.wbSheetMediaQChecker = null;
  this.wbUseAFWorker =
    wbinfo.enable_auto_fetch && ($wbwindow.Worker != null && wbinfo.is_live);

  this.wb_rel_prefix = '';

  this.wb_wombat_updating = false;

  /** @type {FuncMap} */
  this.message_listeners = new FuncMap();
  /** @type {FuncMap} */
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
    FRAME: { src: 'fr_' },
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
    'href',
    'hash',
    'pathname',
    'host',
    'hostname',
    'protocol',
    'origin',
    'search',
    'port'
  ];

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
  this.DotPostMessageRe = /(.postMessage\s*\()/;

  this.write_buff = '';
  this.styleReplacer = this.styleReplacer.bind(this);
  this.utilFns = {};
}

/**
 * Returns T/F indicating if the supplied element may have attributes that
 * are auto-fetched
 * @param {Element} elem
 * @return {boolean}
 */
Wombat.prototype.isSavedSrcSrcset = function(elem) {
  switch (elem.tagName) {
    case 'IMG':
    case 'VIDEO':
    case 'AUDIO':
      return true;
    case 'SOURCE':
      if (!elem.parentElement) return false;
      switch (elem.parentElement.tagName) {
        case 'PICTURE':
        case 'VIDEO':
        case 'AUDIO':
          return true;
        default:
          return false;
      }
    default:
      return false;
  }
};

/**
 * Returns T/F indicating if the supplied element is an Image element that
 * may have srcset values to be sent to the backing auto-fetch worker
 * @param {Element} elem
 * @return {boolean}
 */
Wombat.prototype.isSavedDataSrcSrcset = function(elem) {
  if (elem.dataset && elem.dataset.srcset != null) {
    return this.isSavedSrcSrcset(elem);
  }
  return false;
};

/**
 * Determines if the supplied string is an host URL
 * @param {string} str
 * @return {boolean}
 */
Wombat.prototype.isHostUrl = function(str) {
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

/**
 * Determines if a string starts with the supplied prefix.
 * If it does the matching prefix is returned otherwise undefined.
 * @param {?string} string
 * @param {string} prefix
 * @return {?string}
 */
Wombat.prototype.startsWith = function(string, prefix) {
  if (!string) {
    return undefined;
  }
  return string.indexOf(prefix) === 0 ? prefix : undefined;
};

/**
 * Determines if a string starts with the supplied array of prefixes.
 * If it does the matching prefix is returned otherwise undefined.
 * @param {?string} string
 * @param {Array<string>} prefixes
 * @return {?string}
 */
Wombat.prototype.startsWithOneOf = function(string, prefixes) {
  if (!string) {
    return undefined;
  }
  for (var i = 0; i < prefixes.length; i++) {
    if (string.indexOf(prefixes[i]) === 0) {
      return prefixes[i];
    }
  }
  return undefined;
};

/**
 * Determines if a string ends with the supplied suffix.
 * If it does the suffix is returned otherwise undefined.
 * @param {?string} str
 * @param {string} suffix
 * @return {?string}
 */
Wombat.prototype.endsWith = function(str, suffix) {
  if (!str) return undefined;
  if (str.indexOf(suffix, str.length - suffix.length) !== -1) {
    return suffix;
  }
  return undefined;
};

/**
 * Returns T/F indicating if the supplied tag name and attribute name
 * combination are to be rewritten
 * @param {string} tagName
 * @param {string} attr
 * @return {boolean}
 */
Wombat.prototype.shouldRewriteAttr = function(tagName, attr) {
  if (attr === 'href' || attr === 'src') return true;
  if (tagName === 'META' && attr === 'content') return true;
  return tagName === 'VIDEO' && attr === 'poster';
};

/**
 * Returns the correct rewrite modifier for the supplied element and
 * attribute combination
 * @param {Element} elem
 * @param {string} attrName
 */
Wombat.prototype.rwModForElement = function(elem, attrName) {
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

/**
 * @param {HTMLElement} elem
 */
Wombat.prototype.removeWBOSRC = function(elem) {
  if (elem.tagName === 'SCRIPT' && !elem.__$removedWBOSRC$__) {
    if (elem.hasAttribute('__wb_orig_src')) {
      elem.removeAttribute('__wb_orig_src');
    }
    elem.__$removedWBOSRC$__ = true;
  }
};

/**
 * @param {HTMLElement} elem
 */
Wombat.prototype.retrieveWBOSRC = function(elem) {
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

/**
 * Wraps the supplied text contents of a script tag with the required Wombat setup
 * @param {?string} scriptText
 * @return {string}
 */
Wombat.prototype.wrapScriptTextJsProxy = function(scriptText) {
  return (
    'var _____WB$wombat$assign$function_____ = function(name) {return (self._wb_wombat && ' +
    'self._wb_wombat.local_init &&self._wb_wombat.local_init(name)) || self[name]; };\n' +
    'if (!self.__WB_pmw) { self.__WB_pmw = function(obj) { return obj; } }\n{\n' +
    'let window = _____WB$wombat$assign$function_____("window");\n' +
    'let self = _____WB$wombat$assign$function_____("self");\n' +
    'let document = _____WB$wombat$assign$function_____("document");\n' +
    'let location = _____WB$wombat$assign$function_____("location");\n' +
    'let top = _____WB$wombat$assign$function_____("top");\n' +
    'let parent = _____WB$wombat$assign$function_____("parent");\n' +
    'let frames = _____WB$wombat$assign$function_____("frames");\n' +
    'let opener = _____WB$wombat$assign$function_____("opener");\n' +
    scriptText +
    '\n\n}'
  );
};

/**
 * Calls the supplied function when the supplied element undergoes mutations
 * @param elem
 * @param func
 * @return {boolean}
 */
Wombat.prototype.watchElem = function(elem, func) {
  if (!this.$wbwindow.MutationObserver) {
    return false;
  }
  var m = new this.$wbwindow.MutationObserver(function(records, observer) {
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

/**
 * Constructs the final URL for the URL rewriting process
 * @param {boolean} useRel
 * @param {string} mod
 * @param {string} url
 * @return {string}
 */
Wombat.prototype.getFinalUrl = function(useRel, mod, url) {
  var prefix = useRel ? this.wb_rel_prefix : this.wb_abs_prefix;

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

/**
 * Converts the supplied relative URL to an absolute URL using an A tag
 * @param {string} url
 * @param {?Document} doc
 * @return {string}
 */
Wombat.prototype.resolveRelUrl = function(url, doc) {
  var docObj = doc || this.$wbwindow.document;
  var parser = this.makeParser(docObj.baseURI, docObj);
  var hash = parser.href.lastIndexOf('#');
  var href = hash >= 0 ? parser.href.substring(0, hash) : parser.href;
  var lastslash = href.lastIndexOf('/');

  if (lastslash >= 0 && lastslash !== href.length - 1) {
    parser.href = href.substring(0, lastslash + 1) + url;
  } else {
    parser.href = href + url;
  }
  return parser.href;
};

/**
 * Extracts the original URL from the supplied rewritten URL
 * @param {?string} rewrittenUrl
 * @return {string}
 */
Wombat.prototype.extractOriginalURL = function(rewrittenUrl) {
  if (!rewrittenUrl) {
    return '';
  } else if (this.wb_is_proxy) {
    // proxy mode: no extraction needed
    return rewrittenUrl;
  }

  var url = rewrittenUrl.toString();

  // ignore certain urls
  if (this.startsWithOneOf(url, this.IGNORE_PREFIXES)) {
    return url;
  }

  // if no coll, start from beginning, otherwise could be part of coll..
  var start = this.wb_rel_prefix ? 1 : 0;

  var index = url.indexOf('/http', start);
  if (index < 0) {
    index = url.indexOf('///', start);
  }

  // extract original url from wburl
  if (index >= 0) {
    url = url.substr(index + 1);
  } else {
    index = url.indexOf(this.wb_replay_prefix);
    if (index >= 0) {
      url = url.substr(index + this.wb_replay_prefix.length);
    }
    if (url.length > 4 && url.charAt(2) === '_' && url.charAt(3) === '/') {
      url = url.substr(4);
    }

    if (
      url !== rewrittenUrl &&
      !this.startsWithOneOf(url, this.VALID_PREFIXES)
    ) {
      url = this.wb_orig_scheme + url;
    }
  }

  if (
    rewrittenUrl.charAt(0) === '/' &&
    rewrittenUrl.charAt(1) !== '/' &&
    this.startsWith(url, this.wb_orig_origin)
  ) {
    url = url.substr(this.wb_orig_origin.length);
  }

  if (this.startsWith(url, this.REL_PREFIX)) {
    return this.wb_info.wombat_scheme + ':' + url;
  }

  return url;
};

/**
 * Creates and returns an A tag ready for parsing the original URL
 * part of the supplied URL.
 * @param {string} maybeRewrittenURL
 * @param {?Document} doc
 * @return {HTMLAnchorElement}
 */
Wombat.prototype.makeParser = function(maybeRewrittenURL, doc) {
  var originalURL = this.extractOriginalURL(maybeRewrittenURL);
  var docElem = doc;
  if (!doc) {
    // special case: for newly opened blank windows, use the opener
    // to create parser to have the proper baseURI
    if (
      this.$wbwindow.location.href === 'about:blank' &&
      this.$wbwindow.opener
    ) {
      docElem = this.$wbwindow.opener.document;
    } else {
      docElem = this.$wbwindow.document;
    }
  }

  var p = docElem.createElement('a');
  p._no_rewrite = true;
  p.href = originalURL;
  return p;
};

/**
 * Defines a new getter and optional setter on the supplied object returning
 * T/F to indicate if the new property was successfully defined
 * @param {Object} obj
 * @param {string} prop
 * @param {?function(value: *): *} setFunc
 * @param {function(): *} getFunc
 * @param {?boolean} [enumerable]
 * @return {boolean}
 */
Wombat.prototype.defProp = function(obj, prop, setFunc, getFunc, enumerable) {
  // if the property is marked as non-configurable in the current
  // browser, skip the override
  var existingDescriptor = Object.getOwnPropertyDescriptor(obj, prop);
  if (existingDescriptor && !existingDescriptor.configurable) {
    return false;
  }

  // if no getter function was supplied, skip the override.
  // See https://github.com/webrecorder/pywb/issues/147 for context
  if (!getFunc) {
    return false;
  }

  var descriptor = {
    configurable: true,
    enumerable: enumerable || false,
    get: getFunc
  };

  if (setFunc) {
    descriptor.set = setFunc;
  }

  try {
    Object.defineProperty(obj, prop, descriptor);
    return true;
  } catch (e) {
    console.warn('Failed to redefine property %s', prop, e.message);
    return false;
  }
};

/**
 * Returns the original getter function for the supplied object's property
 * @param {Object} obj
 * @param {string} prop
 * @return {function(): *}
 */
Wombat.prototype.getOrigGetter = function(obj, prop) {
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

/**
 * Returns the original setter function for the supplied object's property
 * @param {Object} obj
 * @param {string} prop
 * @return {function(): *}
 */
Wombat.prototype.getOrigSetter = function(obj, prop) {
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

/**
 * Returns an array containing the names of all the properties
 * that exist on the supplied object
 * @param {Object} obj
 * @return {Array<string>}
 */
Wombat.prototype.getAllOwnProps = function(obj) {
  /** @type {Array<string>} */
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

/**
 * Sends the supplied message to __WB_top_frame
 * @param {*} message
 * @param {boolean} [skipTopCheck]
 */
Wombat.prototype.sendTopMessage = function(message, skipTopCheck) {
  if (!this.$wbwindow.__WB_top_frame) {
    return;
  }

  if (!skipTopCheck && this.$wbwindow != this.$wbwindow.__WB_replay_top) {
    return;
  }

  this.$wbwindow.__WB_top_frame.postMessage(message, this.wb_info.top_host);
};

/**
 * Notifies __WB_top_frame of an history update
 * @param {?string} url
 * @param {?string} title
 */
Wombat.prototype.sendHistoryUpdate = function(url, title) {
  this.sendTopMessage({
    url: url,
    ts: this.wb_info.timestamp,
    request_ts: this.wb_info.request_ts,
    is_live: this.wb_info.is_live,
    title: title,
    wb_type: 'replace-url'
  });
};

/**
 * Updates the real location object with the results of rewriting the supplied
 * URL
 * @param {?string} reqHref
 * @param {string} origHref
 * @param {Location} actualLocation
 */
Wombat.prototype.updateLocation = function(reqHref, origHref, actualLocation) {
  if (!reqHref) {
    return;
  }

  if (reqHref === origHref) {
    // Reset _wombat loc to the unrewritten version
    // if (wombat_loc) {
    //    wombat_loc.href = extractOriginalURL(orig_href);
    // }
    return;
  }

  var ext_orig = this.extractOriginalURL(origHref);
  var ext_req = this.extractOriginalURL(reqHref);

  if (!ext_orig || ext_orig === ext_req) {
    return;
  }

  var final_href = this.rewriteUrl(reqHref);

  console.log(actualLocation.href + ' -> ' + final_href);

  actualLocation.href = final_href;
};

/**
 * Updates the real location with a change
 * @param {*} wombatLoc
 * @param {boolean} isTop
 */
Wombat.prototype.checkLocationChange = function(wombatLoc, isTop) {
  var locType = typeof wombatLoc;

  var actual_location = isTop
    ? this.$wbwindow.__WB_replay_top.location
    : this.$wbwindow.location;

  // String has been assigned to location, so assign it
  if (locType === 'string') {
    this.updateLocation(wombatLoc, actual_location.href, actual_location);
  } else if (locType === 'object') {
    this.updateLocation(wombatLoc.href, wombatLoc._orig_href, actual_location);
  }
};

/**
 * Checks for a location change, either this browser context or top and updates
 * accordingly
 * @return {boolean}
 */
Wombat.prototype.checkAllLocations = function() {
  if (this.wb_wombat_updating) {
    return false;
  }

  this.wb_wombat_updating = true;

  this.checkLocationChange(this.$wbwindow.WB_wombat_location, false);

  // Only check top if its a different $wbwindow
  if (
    this.$wbwindow.WB_wombat_location !==
    this.$wbwindow.__WB_replay_top.WB_wombat_location
  ) {
    this.checkLocationChange(
      this.$wbwindow.__WB_replay_top.WB_wombat_location,
      true
    );
  }

  this.wb_wombat_updating = false;
};

/**
 * Returns the Object the Proxy was proxying if it exists otherwise
 * the original object
 * @param {Proxy|Object} source
 * @return {?Object}
 */
Wombat.prototype.proxyToObj = function(source) {
  try {
    if (source) {
      var realObj = source.__WBProxyRealObj__;
      return realObj ? realObj : source;
    }
    return source;
  } catch (e) {}
  return source;
};

/**
 * Returns the Proxy object for the supplied Object if it exists otherwise
 * the original object
 * @param {?Object} obj
 * @return {Proxy|?Object}
 */
Wombat.prototype.objToProxy = function(obj) {
  try {
    if (obj) {
      var objProxy = obj._WB_wombat_obj_proxy;
      return objProxy ? objProxy : obj;
    }
    return obj;
  } catch (e) {}
  return obj;
};

/**
 * Returns the value of supplied object that is being Proxied
 * @param {*} obj
 * @param {string} prop
 * @param {Array<string>} ownProps
 * @return {*}
 */
Wombat.prototype.defaultProxyGet = function(obj, prop, ownProps) {
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
    if (retVal instanceof Window) {
      this.initNewWindowWombat(retVal);
    }
    return retVal._WB_wombat_obj_proxy;
  }

  return retVal;
};

/**
 * Set the location properties for either an instance of WombatLocation
 * or an anchor tag
 * @param {HTMLAnchorElement|WombatLocation} loc
 * @param {string} originalURL
 */
Wombat.prototype.setLoc = function(loc, originalURL) {
  var parser = this.makeParser(originalURL, loc.ownerDocument);

  loc._orig_href = originalURL;
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
      parser.protocol +
      '//' +
      parser.hostname +
      (parser.port ? ':' + parser.port : '');
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

/**
 * Returns a function for retrieving some property on an instance of either
 * WombatLocation or an anchor tag
 * @param {string} prop
 * @param {function(): string} origGetter
 * @return {function(): string}
 */
Wombat.prototype.makeGetLocProp = function(prop, origGetter) {
  var wombat = this;
  return function() {
    if (this._no_rewrite) {
      return origGetter.call(this, prop);
    }

    var curr_orig_href = origGetter.call(this, 'href');

    if (prop === 'href') {
      return wombat.extractOriginalURL(curr_orig_href);
    }

    if (this._orig_href !== curr_orig_href) {
      wombat.setLoc(this, curr_orig_href);
    }
    return this['_' + prop];
  };
};

/**
 * Returns a function for setting some property on an instance of either
 * WombatLocation or an anchor tag
 * @param {string} prop
 * @param {function (value: *): *} origSetter
 * @param {function(): *} origGetter
 * @return {function (value: *): *}
 */
Wombat.prototype.makeSetLocProp = function(prop, origSetter, origGetter) {
  var wombat = this;
  return function(value) {
    if (this._no_rewrite) {
      return origSetter.call(this, prop, value);
    }

    if (this['_' + prop] === value) {
      return;
    }

    this['_' + prop] = value;

    if (!this._parser) {
      var href = origGetter.call(this);
      this._parser = wombat.makeParser(href, this.ownerDocument);
    }

    var rel = false;

    // Special case for href="." assignment
    if (prop === 'href' && typeof value === 'string') {
      if (value) {
        if (value[0] === '.') {
          value = wombat.resolveRelUrl(value, this.ownerDocument);
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
      origSetter.call(this, 'hash', value);
    } else {
      rel = rel || value === this._parser.pathname;
      value = wombat.rewriteUrl(this._parser.href, rel);
      origSetter.call(this, 'href', value);
    }
  };
};

/**
 * Function used for rewriting URL's contained in CSS style definitions
 * @param {Object} match
 * @param {string} n1
 * @param {string} n2
 * @param {string} n3
 * @param {number} offset
 * @param {string} string
 * @return {string}
 */
Wombat.prototype.styleReplacer = function(match, n1, n2, n3, offset, string) {
  return n1 + this.rewriteUrl(n2) + n3;
};

/**
 * Applies an override on the prototype of Node for the supplied function name
 * @param {string} funcname
 */
Wombat.prototype.replaceDomFunc = function(funcname) {
  var orig = this.$wbwindow.Node.prototype[funcname];
  var wombat = this;
  this.$wbwindow.Node.prototype[funcname] = function rwDomFunc(
    newNode,
    oldNode
  ) {
    if (newNode) {
      if (newNode.nodeType === Node.ELEMENT_NODE) {
        wombat.rewriteElem(newNode);
        // special check for nested elements
        if (newNode.children || newNode.childNodes) {
          wombat.recurseRewriteElem(newNode);
        }
      } else if (newNode.nodeType === Node.TEXT_NODE) {
        if (this.tagName === 'STYLE') {
          newNode.textContent = wombat.rewriteStyle(newNode.textContent);
        }
      } else if (newNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        wombat.recurseRewriteElem(newNode);
      }
    }
    var created = orig.call(wombat.proxyToObj(this), newNode, oldNode);
    if (created && created.tagName === 'IFRAME') {
      wombat.initIframeWombat(created);
    }
    return created;
  };
};

/**
 * Rewrites the supplied URL returning the rewritten URL
 * @param {?string} originalURL
 * @param {?boolean} [useRel]
 * @param {?string} [mod]
 * @param {?Document} [doc]
 * @return {?string}
 * @private
 */
Wombat.prototype.rewriteUrl_ = function(originalURL, useRel, mod, doc) {
  // If undefined, just return it
  if (!originalURL) {
    return originalURL;
  }

  var urltype_ = typeof originalURL;

  var url;
  // If object, use toString
  if (urltype_ === 'object') {
    url = originalURL.toString();
  } else if (urltype_ !== 'string') {
    return originalURL;
  } else {
    url = originalURL;
  }

  // proxy mode: If no wb_replay_prefix, only rewrite scheme
  if (this.wb_is_proxy) {
    if (
      this.wb_orig_scheme === this.HTTP_PREFIX &&
      this.startsWith(url, this.HTTPS_PREFIX)
    ) {
      return this.HTTP_PREFIX + url.substr(this.HTTPS_PREFIX.length);
    } else if (
      this.wb_orig_scheme === this.HTTPS_PREFIX &&
      this.startsWith(url, this.HTTP_PREFIX)
    ) {
      return this.HTTPS_PREFIX + url.substr(this.HTTP_PREFIX.length);
    } else {
      return url;
    }
  }

  // just in case _wombat reference made it into url!
  url = url.replace('WB_wombat_', '');

  // ignore anchors, about, data
  if (this.startsWithOneOf(url, this.IGNORE_PREFIXES)) {
    return url;
  }

  // OPTS: additional ignore prefixes
  if (
    this.wb_opts.no_rewrite_prefixes &&
    this.startsWithOneOf(url, this.wb_opts.no_rewrite_prefixes)
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

  var originalLoc = this.$wbwindow.location;
  if (
    this.startsWith(check_url, this.wb_replay_prefix) ||
    this.startsWith(check_url, originalLoc.origin + this.wb_replay_prefix)
  ) {
    return url;
  }

  // A special case where the port somehow gets dropped
  // Check for this and add it back in, eg http://localhost/path/ -> http://localhost:8080/path/
  if (
    originalLoc.host !== originalLoc.hostname &&
    this.startsWith(
      url,
      originalLoc.protocol + '//' + originalLoc.hostname + '/'
    )
  ) {
    return url.replace(
      '/' + originalLoc.hostname + '/',
      '/' + originalLoc.host + '/'
    );
  }

  // If server relative url, add prefix and original host
  if (url.charAt(0) === '/' && !this.startsWith(url, this.REL_PREFIX)) {
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
        return (
          url.substring(0, scheme_sep + 2) + '/' + url.substring(scheme_sep + 2)
        );
      }
      return url;
    }

    return this.getFinalUrl(true, mod, this.wb_orig_origin + url);
  }

  // Use a parser
  if (url.charAt(0) === '.') {
    url = this.resolveRelUrl(url, doc);
  }

  // If full url starting with http://, https:// or //
  // add rewrite prefix
  var prefix = this.startsWithOneOf(url, this.VALID_PREFIXES);

  if (prefix) {
    var orig_host = this.$wbwindow.__WB_replay_top.location.host;
    var orig_protocol = this.$wbwindow.__WB_replay_top.location.protocol;

    var prefix_host = prefix + orig_host + '/';

    // if already rewritten url, must still check scheme
    if (this.startsWith(url, prefix_host)) {
      if (this.startsWith(url, this.wb_replay_prefix)) {
        return url;
      }

      var curr_scheme = orig_protocol + '//';
      var path = url.substring(prefix_host.length);
      var rebuild = false;

      if (path.indexOf(this.wb_rel_prefix) < 0 && url.indexOf('/static/') < 0) {
        path = this.getFinalUrl(
          true,
          mod,
          WB_wombat_location.origin + '/' + path
        );
        rebuild = true;
      }

      // replace scheme to ensure using the correct server scheme
      // if (starts_with(url, wb_orig_scheme) && (wb_orig_scheme != curr_scheme)) {
      if (prefix !== curr_scheme && prefix !== this.REL_PREFIX) {
        rebuild = true;
      }

      if (rebuild) {
        if (!useRel) {
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
    return this.getFinalUrl(useRel, mod, url);
  }

  // Check for common bad prefixes and remove them
  prefix = this.startsWithOneOf(url, this.BAD_PREFIXES);

  if (prefix) {
    return this.getFinalUrl(useRel, mod, this.extractOriginalURL(url));
  }

  // May or may not be a hostname, call function to determine
  // If it is, add the prefix and make sure port is removed
  if (this.isHostUrl(url) && !this.startsWith(url, originalLoc.host + '/')) {
    return this.getFinalUrl(useRel, mod, this.wb_orig_scheme + url);
  }

  return url;
};

/**
 * Rewrites the supplied URL returning the rewritten URL.
 * If wombat is in debug mode the rewrite is logged to the console
 * @param {?string} url
 * @param {?boolean} [useRel]
 * @param {?string} [mod]
 * @param {?Document} [doc]
 * @return {?string}
 */
Wombat.prototype.rewriteUrl = function(url, useRel, mod, doc) {
  var rewritten = this.rewriteUrl_(url, useRel, mod, doc);
  if (this.debug_rw) {
    if (url !== rewritten) {
      console.log('REWRITE: ' + url + ' -> ' + rewritten);
    } else {
      console.log('NOT REWRITTEN ' + url);
    }
  }
  return rewritten;
};

/**
 * Rewrites an element attribute's value
 * @param {Element} elem
 * @param {string} name
 * @param {boolean} [absUrlOnly]
 * @return {boolean}
 */
Wombat.prototype.rewriteAttr = function(elem, name, absUrlOnly) {
  var changed = false;
  if (!elem || !elem.getAttribute || elem._no_rewrite || elem['_' + name]) {
    return changed;
  }

  var value = this.wb_getAttribute.call(elem, name);

  if (!value || this.startsWith(value, 'javascript:')) {
    return changed;
  }

  var new_value;

  switch (name) {
    case 'filter': // for svg filter attribute which is url(...)
      new_value = this.rewriteInlineStyle(value);
      break;
    case 'style':
      new_value = this.rewriteStyle(value);
      break;
    case 'srcset':
      new_value = this.rewriteSrcset(value, elem);
      break;
    default:
      // Only rewrite if absolute url
      if (absUrlOnly && !this.startsWithOneOf(value, this.VALID_PREFIXES)) {
        return changed;
      }
      var mod = this.rwModForElement(elem, name);
      new_value = this.rewriteUrl(value, false, mod, elem.ownerDocument);
      if (this.wbUseAFWorker && this.isSavedDataSrcSrcset(elem)) {
        this.WBAutoFetchWorker.preserveDataSrcset(elem);
      }
      break;
  }

  if (new_value !== value) {
    this.removeWBOSRC(elem);
    this.wb_setAttribute.call(elem, name, new_value);
    changed = true;
  }

  return changed;
};

/**
 * Rewrites the supplied CSS style definitions
 * @param {string|Object} style
 * @return {string|Object|null}
 */
Wombat.prototype.rewriteStyle = function(style) {
  if (!style) {
    return style;
  }

  var value = style;
  if (typeof style === 'object') {
    value = style.toString();
  }

  if (typeof value === 'string') {
    return value
      .replace(this.STYLE_REGEX, this.styleReplacer)
      .replace(this.IMPORT_REGEX, this.styleReplacer)
      .replace(this.no_wombatRe, '');
  }

  return value;
};

/**
 * Rewrites the supplied srcset string returning the rewritten results.
 * If the element is one the srcset values are auto-fetched they are sent
 * to the backing auto-fetch worker
 * @param {string} value
 * @param {Element} elem
 * @return {string}
 */
Wombat.prototype.rewriteSrcset = function(value, elem) {
  if (!value) {
    return '';
  }
  var split = value.split(this.srcsetRe);
  /** @type {Array<string>} */
  var values = [];

  for (var i = 0; i < split.length; i++) {
    // Filter removes non-truthy values like null, undefined, and ""
    if (split[i]) {
      values.push(this.rewriteUrl(split[i].trim()));
    }
  }

  if (this.wbUseAFWorker && this.isSavedSrcSrcset(elem)) {
    // send post split values to preservation worker
    this.WBAutoFetchWorker.preserveSrcset(
      values,
      this.WBAutoFetchWorker.rwMod(elem)
    );
  }

  return values.join(', ');
};

/**
 *
 * @param {Element} elem
 * @param {string} attrName
 * @return {boolean}
 */
Wombat.prototype.rewriteFrameSrc = function(elem, attrName) {
  var value = this.wb_getAttribute.call(elem, attrName);
  var new_value;

  // special case for rewriting javascript: urls that contain WB_wombat_
  // must insert _wombat init first!
  if (this.startsWith(value, 'javascript:')) {
    if (value.indexOf('WB_wombat_') >= 0) {
      var JS = 'javascript:';
      new_value =
        JS +
        'window.parent._wb_wombat.initNewWindowWombat(window);' +
        value.substr(JS.length);
    }
  }

  if (!new_value) {
    new_value = this.rewriteUrl(
      value,
      false,
      this.rwModForElement(elem, attrName)
    );
  }

  if (new_value !== value) {
    this.wb_setAttribute.call(elem, attrName, new_value);
    return true;
  }

  return false;
};

/**
 * Rewrites either the URL contained in the src attribute or the text contents
 * of the supplied script element. Returns T/F indicating if a rewrite occurred
 * @param elem
 * @return {boolean}
 */
Wombat.prototype.rewriteScript = function(elem) {
  if (elem.hasAttribute('src') || !elem.textContent || !this.$wbwindow.Proxy) {
    return this.rewriteAttr(elem, 'src');
  }
  if (
    elem.type &&
    (elem.type === 'application/json' ||
      elem.type.indexOf('text/template') !== -1)
  )
    return false;
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
  elem.textContent = this.wrapScriptTextJsProxy(
    elem.textContent.replace(this.DotPostMessageRe, '.__WB_pmw(self.window)$1')
  );
  return true;
};

/**
 * Rewrites the supplied element returning T/F indicating if a rewrite occured
 * @param {Element|Node} elem - The element to be rewritten
 * @return {boolean}
 */
Wombat.prototype.rewriteElem = function(elem) {
  var changed = false;
  if (!elem) return changed;
  if (elem instanceof SVGElement && elem.hasAttribute('filter')) {
    changed = this.rewriteAttr(elem, 'filter');
    changed = this.rewriteAttr(elem, 'style') || changed;
  } else {
    switch (elem.tagName) {
      case 'META':
        var maybeCSP = this.wb_getAttribute.call(elem, 'http-equiv');
        if (maybeCSP && maybeCSP.toLowerCase() === 'content-security-policy') {
          this.wb_setAttribute.call(elem, 'http-equiv', '_' + maybeCSP);
          changed = true;
        }
        break;
      case 'STYLE':
        var new_content = this.rewriteStyle(elem.textContent);
        if (elem.textContent !== new_content) {
          elem.textContent = new_content;
          changed = true;
          if (this.wbUseAFWorker && elem.sheet != null) {
            // we have a stylesheet so lets be nice to UI thread
            // and defer extraction
            this.WBAutoFetchWorker.deferredSheetExtraction(elem.sheet);
          }
        }
        break;
      case 'LINK':
        changed = this.rewriteAttr(elem, 'href');
        if (this.wbUseAFWorker && elem.rel === 'stylesheet') {
          // we can only check link[rel='stylesheet'] when it loads
          elem.addEventListener('load', this.utilFns.wbSheetMediaQChecker);
        }
        break;
      case 'IMG':
        changed = this.rewriteAttr(elem, 'src');
        changed = this.rewriteAttr(elem, 'srcset') || changed;
        changed = this.rewriteAttr(elem, 'style') || changed;
        if (this.wbUseAFWorker && elem.dataset.srcset) {
          this.WBAutoFetchWorker.preserveDataSrcset(elem);
        }
        break;
      case 'OBJECT':
        changed = this.rewriteAttr(elem, 'data', true);
        break;
      case 'FORM':
        changed = this.rewriteAttr(elem, 'poster');
        changed = this.rewriteAttr(elem, 'action') || changed;
        changed = this.rewriteAttr(elem, 'style') || changed;
        break;
      case 'IFRAME':
      case 'FRAME':
        changed = this.rewriteFrameSrc(elem, 'src');
        changed = this.rewriteAttr(elem, 'style') || changed;
        break;
      case 'SCRIPT':
        changed = this.rewriteScript(elem);
        break;
      case 'image':
        changed = this.rewriteAttr(elem, 'xlink:href');
        break;
      default: {
        changed = this.rewriteAttr(elem, 'src');
        changed = this.rewriteAttr(elem, 'srcset') || changed;
        changed = this.rewriteAttr(elem, 'href') || changed;
        changed = this.rewriteAttr(elem, 'style') || changed;
        changed = this.rewriteAttr(elem, 'poster') || changed;
        break;
      }
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

/**
 * Rewrites all the children of the supplied element and there descendants
 * returning T/F if a rewrite occurred
 * @param {Element|Node} curr
 * @return {boolean}
 */
Wombat.prototype.recurseRewriteElem = function(curr) {
  var changed = false;
  var rw_q = [];
  if (curr && (curr.children || curr.childNodes)) {
    rw_q.push(curr.children || curr.childNodes);
  }
  while (rw_q.length > 0) {
    var children = rw_q.shift();
    for (var i = 0; i < children.length; i++) {
      if (children[i].nodeType === Node.ELEMENT_NODE) {
        changed = this.rewriteElem(children[i]) || changed;
        var next_kids = children[i].children || children[i].childNodes;
        if (next_kids && next_kids.length) {
          rw_q.push(next_kids);
        }
      }
    }
  }
  return changed;
};

/**
 * Rewrites the supplied string containing HTML, if the supplied string
 * is full HTML (starts with <HTML, <DOCUMENT...) the string is rewritten
 * using {@link Wombat#rewriteHtmlFull}
 * @param {string} string
 * @param {boolean} checkEndTag
 * @return {?string}
 */
Wombat.prototype.rewriteHtml = function(string, checkEndTag) {
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
    this.FullHTMLRegex.test(rwString)
  ) {
    return this.rewriteHtmlFull(rwString, checkEndTag);
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

  if (this.recurseRewriteElem(template.content)) {
    template._no_rewrite = true;
    var new_html = template.innerHTML;

    if (checkEndTag) {
      var first_elem =
        template.content.children && template.content.children[0];
      if (first_elem) {
        var end_tag = '</' + first_elem.tagName.toLowerCase() + '>';
        if (
          this.endsWith(new_html, end_tag) &&
          !this.endsWith(rwString, end_tag)
        ) {
          new_html = new_html.substring(0, new_html.length - end_tag.length);
        }
      } else if (rwString[0] !== '<' || rwString[rwString.length - 1] !== '>') {
        this.write_buff += rwString;
        return undefined;
      }
    }
    return new_html;
  }

  return rwString;
};

/**
 * Rewrites the supplied string containing full HTML
 * @param {string} string
 * @param {boolean} checkEndTag
 * @return {?string}
 */
Wombat.prototype.rewriteHtmlFull = function(string, checkEndTag) {
  var inner_doc = new DOMParser().parseFromString(string, 'text/html');

  if (!inner_doc) {
    return string;
  }

  var changed = false;

  for (var i = 0; i < inner_doc.all.length; i++) {
    changed = this.rewriteElem(inner_doc.all[i]) || changed;
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

      new_html = inner_doc.head.outerHTML + inner_doc.body.outerHTML;
      if (checkEndTag) {
        if (inner_doc.all.length > 3) {
          var end_tag = '</' + inner_doc.all[3].tagName.toLowerCase() + '>';
          if (
            this.endsWith(new_html, end_tag) &&
            !this.endsWith(string, end_tag)
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

/**
 * Rewrites a CSS style string found in the style property of an element or
 * FontFace
 * @param {string} orig
 * @return {string}
 */
Wombat.prototype.rewriteInlineStyle = function(orig) {
  var decoded;

  try {
    decoded = decodeURIComponent(orig);
  } catch (e) {
    decoded = orig;
  }

  if (decoded !== orig) {
    var val = this.rewriteStyle(decoded);
    var parts = val.split(',', 2);
    return parts[0] + ',' + encodeURIComponent(parts[1]);
  }

  return this.rewriteStyle(orig);
};

/**
 * Rewrites the supplied cookie
 * @param {string} cookie
 * @return {string}
 */
Wombat.prototype.rewriteCookie = function(cookie) {
  var wombat = this;
  var rwCookie = cookie
    .replace(this.wb_abs_prefix, '')
    .replace(this.wb_rel_prefix, '')
    .replace(this.cookie_domain_regex, function(m, m1) {
      // rewrite domain
      var message = {
        domain: m1,
        cookie: rwCookie,
        wb_type: 'cookie'
      };

      // norify of cookie setting to allow server-side tracking
      wombat.sendTopMessage(message, true);

      // if no subdomain, eg. "localhost", just remove domain altogether
      if (
        wombat.$wbwindow.location.hostname.indexOf('.') >= 0 &&
        !wombat.IP_RX.test(wombat.$wbwindow.location.hostname)
      ) {
        return 'Domain=.' + wombat.$wbwindow.location.hostname;
      }
      return '';
    })
    .replace(this.cookie_path_regex, function(m, m1) {
      // rewrite path
      var rewritten = wombat.rewriteUrl(m1);

      if (rewritten.indexOf(wombat.wb_curr_host) === 0) {
        rewritten = rewritten.substring(wombat.wb_curr_host.length);
      }

      return 'Path=' + rewritten;
    });

  // rewrite secure, if needed
  if (wombat.$wbwindow.location.protocol !== 'https:') {
    rwCookie = rwCookie.replace('secure', '');
  }

  return rwCookie.replace(',|', ',');
};

/**
 * Rewrites the supplied web worker URL
 * @param {string} workerUrl
 * @return {string}
 */
Wombat.prototype.rewriteWorker = function(workerUrl) {
  var fetch = true;
  var makeBlob = false;
  var rwURL;
  var isBlob = workerUrl.indexOf('blob:') === 0;
  var isJSURL = false;
  if (!isBlob) {
    if (this.startsWith(workerUrl, 'javascript:')) {
      // JS url, just strip javascript:
      fetch = false;
      isJSURL = true;
      rwURL = workerUrl.replace('javascript:', '');
    } else if (
      !this.startsWithOneOf(workerUrl, this.VALID_PREFIXES) &&
      !this.startsWith(workerUrl, '/') &&
      !this.startsWithOneOf(workerUrl, this.BAD_PREFIXES)
    ) {
      // super relative url assets/js/xyz.js
      var rurl = this.resolveRelUrl(workerUrl, this.$wbwindow.document);
      rwURL = this.rewriteUrl(rurl, false, 'wkr_', this.$wbwindow.document);
    } else {
      // just rewrite it
      rwURL = this.rewriteUrl(
        workerUrl,
        false,
        'wkr_',
        this.$wbwindow.document
      );
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
    workerCode = x.responseText.replace(this.workerBlobRe, '');
  } else {
    // was JS url, simply make workerCode the JS string
    workerCode = workerUrl;
  }

  if (this.wb_info.static_prefix || this.wb_info.ww_rw_script) {
    var originalURL;
    if (isBlob || isJSURL) {
      originalURL = this.$wbwindow.document.baseURI;
    } else if (workerUrl.indexOf('/') === 0) {
      // console.log(workerUrl);
      originalURL = this.resolveRelUrl(
        this.extractOriginalURL(workerUrl),
        this.$wbwindow.document
      );
    } else {
      originalURL = this.extractOriginalURL(workerUrl);
    }
    // if we are here we can must return blob so set makeBlob to true
    var ww_rw =
      this.wb_info.ww_rw_script || this.wb_info.static_prefix + 'ww_rw.js';
    var rw =
      "(function() { self.importScripts('" +
      ww_rw +
      "'); new WBWombat({'prefix': '" +
      this.wb_abs_prefix +
      "wkr_/', 'originalURL':'" +
      originalURL +
      "'}); })();";
    workerCode = rw + workerCode;
    makeBlob = true;
  }

  if (makeBlob) {
    console.log(workerCode);
    var blob = new Blob([workerCode], { type: 'text/javascript' });
    return URL.createObjectURL(blob);
  } else {
    return workerUrl;
  }
};

// override fns
/**
 * Applies an Event property getter override for the supplied property
 * @param {string} attr
 * @param {Object} eventProto
 */
Wombat.prototype.addEventOverride = function(attr, eventProto) {
  if (!eventProto) {
    eventProto = this.$wbwindow.MessageEvent.prototype;
  }

  var origGetter = this.getOrigGetter(eventProto, attr);

  if (!origGetter) {
    return;
  }

  this.defProp(eventProto, attr, undefined, function() {
    if (this['_' + attr] != null) {
      return this['_' + attr];
    }
    return origGetter.call(this);
  });
};

/**
 * Overrides the nodeValue property of the Attr interface
 */
Wombat.prototype.overrideAttrProps = function() {
  var wombat = this;

  var isRwAttr = function is_rw_attr(attr) {
    if (!attr) {
      return false;
    }
    var tagName = attr.ownerElement && attr.ownerElement.tagName;
    return wombat.shouldRewriteAttr(tagName, attr.nodeName);
  };

  this.overridePropExtract(
    this.$wbwindow.Attr.prototype,
    'nodeValue',
    isRwAttr
  );
  this.overridePropExtract(this.$wbwindow.Attr.prototype, 'value', isRwAttr);
};

/**
 * Applies an override the attribute get/set override
 * @param {Object} obj
 * @param {string} attr
 * @param {string} mod
 */
Wombat.prototype.overrideAttr = function(obj, attr, mod) {
  var orig_getter = this.getOrigGetter(obj, attr);
  var orig_setter = this.getOrigSetter(obj, attr);

  var wombat = this;

  var setter = function(orig) {
    var val;
    if (mod === 'js_') {
      wombat.removeWBOSRC(this);
    }
    val = wombat.rewriteUrl(orig, false, mod);

    if (orig_setter) {
      return orig_setter.call(this, val);
    } else if (wombat.wb_setAttribute) {
      return wombat.wb_setAttribute.call(this, attr, val);
    }
  };

  var getter = function() {
    var res;
    if (orig_getter) {
      res = orig_getter.call(this);
    } else if (wombat.wb_getAttribute) {
      res = wombat.wb_getAttribute.call(this, attr);
    }
    return wombat.extractOriginalURL(res);
  };

  this.defProp(obj, attr, setter, getter);
};

/**
 * Applies an attribute getter override IFF an original getter exists
 * @param {Object} proto
 * @param {string} prop
 * @param {*} [cond]
 */
Wombat.prototype.overridePropExtract = function(proto, prop, cond) {
  var orig_getter = this.getOrigGetter(proto, prop);
  var wombat = this;
  if (orig_getter) {
    var new_getter = function overridePropExtractNewGetter() {
      var obj = wombat.proxyToObj(this);
      var res = orig_getter.call(obj);
      if (!cond || cond(obj)) {
        res = wombat.extractOriginalURL(res);
      }
      return res;
    };
    this.defProp(proto, prop, undefined, new_getter);
  }
};

/**
 * Applies an attribute getter override IFF an original getter exists that
 * ensures that the results of retrieving the attributes value is not a
 * wombat Proxy
 * @param {Object} proto
 * @param {string} prop
 */
Wombat.prototype.overridePropToProxy = function(proto, prop) {
  var orig_getter = this.getOrigGetter(proto, prop);

  if (orig_getter) {
    var wombat = this;

    var new_getter = function overridePropToProxyNewGetter() {
      return wombat.objToProxy(orig_getter.call(this));
    };

    this.defProp(proto, prop, undefined, new_getter);
  }
};

/**
 * Applies an override to supplied history function name IFF it exists
 * @param {string} funcName
 * @return {?function}
 */
Wombat.prototype.overrideHistoryFunc = function(funcName) {
  if (!this.$wbwindow.history) return undefined;

  var orig_func = this.$wbwindow.history[funcName];

  if (!orig_func) return undefined;

  this.$wbwindow.history['_orig_' + funcName] = orig_func;
  var wombat = this;

  var rewrittenFunc = function histNewFunc(stateObj, title, url) {
    var wombatLocation = wombat.$wbwindow.WB_wombat_location;
    var rewritten_url;
    var resolvedURL;

    if (url) {
      var parser = wombat.$wbwindow.document.createElement('a');
      parser.href = url;
      resolvedURL = parser.href;

      rewritten_url = wombat.rewriteUrl(resolvedURL);

      if (
        resolvedURL !== wombatLocation.origin &&
        wombatLocation.href !== 'about:blank' &&
        !wombat.startsWith(resolvedURL, wombatLocation.origin + '/')
      ) {
        throw new DOMException('Invalid history change: ' + resolvedURL);
      }
    } else {
      resolvedURL = wombatLocation.href;
    }

    orig_func.call(this, stateObj, title, rewritten_url);

    wombat.sendHistoryUpdate(resolvedURL, title);
  };

  this.$wbwindow.history[funcName] = rewrittenFunc;
  if (this.$wbwindow.History && this.$wbwindow.History.prototype) {
    this.$wbwindow.History.prototype[funcName] = rewrittenFunc;
  }

  return rewrittenFunc;
};

/**
 * Applies an getter/setter override to the supplied style interface's attribute
 * and prop name combination
 * @param {Object} obj
 * @param {string} attr
 * @param {string} propName
 */
Wombat.prototype.overrideStyleAttr = function(obj, attr, propName) {
  var orig_getter = this.getOrigGetter(obj, attr);
  var orig_setter = this.getOrigSetter(obj, attr);

  var wombat = this;

  var setter = function overrideStyleAttrSetter(orig) {
    var val = wombat.rewriteStyle(orig);
    if (orig_setter) {
      orig_setter.call(this, val);
    } else {
      this.setProperty(propName, val);
    }

    return val;
  };

  var getter = orig_getter;

  if (!orig_getter) {
    getter = function overrideStyleAttrGetter() {
      return this.getPropertyValue(propName);
    };
  }

  if ((orig_setter && orig_getter) || propName) {
    this.defProp(obj, attr, setter, getter);
  }
};

/**
 * Applies an override to the setProperty function
 * @param style_proto
 */
Wombat.prototype.overrideStyleSetProp = function(style_proto) {
  var orig_setProp = style_proto.setProperty;
  var wombat = this;
  style_proto.setProperty = function rwSetProperty(name, value, priority) {
    var rwvalue = wombat.rewriteStyle(value);
    return orig_setProp.call(this, name, rwvalue, priority);
  };
};

Wombat.prototype.overrideAnchorAreaElem = function(whichObj) {
  if (!whichObj || !whichObj.prototype) {
    return;
  }
  var originalGetSets = {};
  var originalProto = whichObj.prototype;

  var anchorAreaSetter = function(prop, value) {
    var func = originalGetSets['set_' + prop];
    if (func) {
      return func.call(this, value);
    } else {
      return '';
    }
  };

  var anchorAreaGetter = function(prop) {
    var func = originalGetSets['get_' + prop];
    if (func) {
      return func.call(this);
    } else {
      return '';
    }
  };

  for (var i = 0; i < this.URL_PROPS.length; i++) {
    var prop = this.URL_PROPS[i];
    originalGetSets['get_' + prop] = this.getOrigGetter(originalProto, prop);
    originalGetSets['set_' + prop] = this.getOrigSetter(originalProto, prop);
    if (Object.defineProperty) {
      this.defProp(
        originalProto,
        prop,
        this.makeSetLocProp(prop, anchorAreaSetter, anchorAreaGetter),
        this.makeGetLocProp(prop, anchorAreaGetter),
        true
      );
    }
  }
  originalProto.toString = function toString() {
    return this.href;
  };
};

Wombat.prototype.overrideHtmlAssign = function(elem, prop, rewriteGetter) {
  if (!this.$wbwindow.DOMParser || !elem || !elem.prototype || !elem.__proto__) {
    return;
  }

  var obj = elem.prototype || elem.__proto__;

  var orig_getter = this.getOrigGetter(obj, prop);
  var orig_setter = this.getOrigSetter(obj, prop);

  if (!orig_setter) {
    return;
  }

  var wombat = this;
  var setter = function overrideHTMLAssignSetter(orig) {
    var res = orig;
    if (!this._no_rewrite) {
      // init_iframe_insert_obs(this);
      if (this.tagName === 'STYLE') {
        res = wombat.rewriteStyle(orig);
      } else {
        res = wombat.rewriteHtml(orig);
      }
    }
    orig_setter.call(this, res);
    if (this.wbUseAFWorker && this.tagName === 'STYLE' && this.sheet != null) {
      // got preserve all the things
      this.WBAutoFetchWorker.deferredSheetExtraction(this.sheet);
    }
  };

  var getter = function overrideHTMLAssignGetter() {
    var res = orig_getter.call(this);
    if (!this._no_rewrite) {
      return res.replace(wombat.wb_unrewrite_rx, '');
    }
    return res;
  };

  this.defProp(obj, prop, setter, rewriteGetter ? getter : orig_getter);
};

Wombat.prototype.overrideIframeContentAccess = function(prop) {
  if (
    !this.$wbwindow.HTMLIFrameElement ||
    !this.$wbwindow.HTMLIFrameElement.prototype
  ) {
    return;
  }

  var obj = this.$wbwindow.HTMLIFrameElement.prototype;
  var orig_getter = this.getOrigGetter(obj, prop);

  if (!orig_getter) return;

  var orig_setter = this.getOrigSetter(obj, prop);
  var wombat = this;
  var getter = function() {
    wombat.initIframeWombat(this);
    return wombat.objToProxy(orig_getter.call(this));
  };

  this.defProp(obj, prop, orig_setter, getter);
  obj['_get_' + prop] = orig_getter;
};

Wombat.prototype.overrideFramesAccess = function($wbwindow) {
  // If $wbwindow.frames is the window itself, nothing to override
  // This can be handled in the Obj Proxy
  if ($wbwindow.Proxy && $wbwindow === $wbwindow.frames) {
    return;
  }
  $wbwindow.__wb_frames = $wbwindow.frames;
  var wombat = this;
  var getter = function overrideFramesAccessGetter() {
    for (var i = 0; i < this.__wb_frames.length; i++) {
      try {
        wombat.initNewWindowWombat(this.__wb_frames[i]);
      } catch (e) {}
    }
    return this.__wb_frames;
  };

  this.defProp($wbwindow, 'frames', undefined, getter);
  this.defProp($wbwindow.Window.prototype, 'frames', undefined, getter);
};

Wombat.prototype.overrideFuncThisProxyToObj = function(cls, method, obj) {
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

  ovrObj[method] = function deproxyThis() {
    return orig.apply(wombat.proxyToObj(this), arguments);
  };
};

Wombat.prototype.overrideFuncArgProxyToObj = function(cls, method, arg) {
  if (!cls || !cls.prototype) {
    return;
  }
  arg = arg || 0;
  var orig = cls.prototype[method];
  var wombat = this;
  cls.prototype[method] = function deproxyFnArg() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      if (i === arg) {
        args[i] = wombat.proxyToObj(arguments[i]);
      } else {
        args[i] = arguments[i];
      }
    }
    var thisObj = wombat.proxyToObj(this);
    if (orig.__WB_orig_apply) {
      return orig.__WB_orig_apply(thisObj, args);
    }
    return orig.apply(thisObj, args);
  };
};

Wombat.prototype.overrideApplyFunc = function($wbwindow) {
  if ($wbwindow.Function.prototype.__WB_orig_apply) {
    return;
  }
  var orig_apply = $wbwindow.Function.prototype.apply;
  $wbwindow.Function.prototype.__WB_orig_apply = orig_apply;
  var wombat = this;
  $wbwindow.Function.prototype.apply = function deproxyApply(obj, args) {
    if (this.____FNISNATIVE$$ == null) {
      this.____FNISNATIVE$$ =
        wombat.wb_funToString.call(this).indexOf('[native code]') >= 0;
    }
    var deproxiedObj = obj;
    if (this.____FNISNATIVE$$) {
      if (args) {
        for (var i = 0; i < args.length; i++) {
          args[i] = wombat.proxyToObj(args[i]);
        }
      }
      deproxiedObj = wombat.proxyToObj(obj);
    }
    return this.__WB_orig_apply(deproxiedObj, args);
  };
  this.wb_funToString.apply = orig_apply;
};

Wombat.prototype.overrideSrcsetAttr = function(obj, mod) {
  var prop = 'srcset';
  var orig_getter = this.getOrigGetter(obj, prop);
  var orig_setter = this.getOrigSetter(obj, prop);
  var wombat = this;

  var setter = function(orig) {
    var val = wombat.rewriteSrcset(orig, this);
    if (orig_setter) {
      return orig_setter.call(this, val);
    } else if (wombat.wb_setAttribute) {
      return wombat.wb_setAttribute.call(this, prop, val);
    }
  };

  var getter = function() {
    var res;

    if (orig_getter) {
      res = orig_getter.call(this);
    } else if (wombat.wb_getAttribute) {
      res = wombat.wb_getAttribute.call(this, prop);
    }
    res = wombat.extractOriginalURL(res);

    return res;
  };

  this.defProp(obj, prop, setter, getter);
};

Wombat.prototype.overrideHrefAttr = function(obj, mod) {
  var orig_getter = this.getOrigGetter(obj, 'href');
  var orig_setter = this.getOrigSetter(obj, 'href');

  var wombat = this;

  var setter = function(orig) {
    var val;
    if (mod === 'cs_' && orig.indexOf('data:text/css') === 0) {
      val = wombat.rewriteInlineStyle(orig);
    } else if (this.tagName === 'LINK') {
      var relV = this.rel;
      if (relV === 'import' || relV === 'preload') {
        var maybeAs = wombat.linkAsTypes[this.as];
        mod = maybeAs != null ? maybeAs : 'mp_';
      } else if (relV === 'stylesheet' && mod !== 'cs_') {
        mod = 'cs_';
      }
      val = wombat.rewriteUrl(orig, false, mod);
    } else {
      val = wombat.rewriteUrl(orig, false, mod);
    }
    if (orig_setter) {
      return orig_setter.call(this, val);
    } else if (wombat.wb_setAttribute) {
      return wombat.wb_setAttribute.call(this, 'href', val);
    }
  };

  var getter = function() {
    var res;
    if (orig_getter) {
      res = orig_getter.call(this);
    } else if (wombat.wb_getAttribute) {
      res = wombat.wb_getAttribute.call(this, 'href');
    }
    return wombat.extractOriginalURL(res);
  };

  this.defProp(obj, 'href', setter, getter);
};

Wombat.prototype.overrideTextProtoGetSet = function(textProto, whichProp) {
  var orig_getter = this.getOrigGetter(textProto, whichProp);
  var wombat = this;
  var setter;
  // data, from CharacterData, is both readable and writable whereas wholeText, from Text, is not
  if (whichProp === 'data') {
    var orig_setter = this.getOrigSetter(textProto, whichProp);
    setter = function rwTextProtoSetter(orig) {
      var res = orig;
      if (
        !this._no_rewrite &&
        this.parentElement &&
        this.parentElement.tagName === 'STYLE'
      ) {
        res = wombat.rewriteStyle(orig);
      }
      return orig_setter.call(this, res);
    };
  }
  var getter = function() {
    var res = orig_getter.call(this);
    if (
      !this._no_rewrite &&
      this.parentElement &&
      this.parentElement.tagName === 'STYLE'
    ) {
      return res.replace(wombat.wb_unrewrite_rx, '');
    }
    return res;
  };
  this.defProp(textProto, whichProp, setter, getter);
};

Wombat.prototype.overrideTextProtoFunction = function(textProto, whichFN) {
  var wombat = this;
  var original = textProto[whichFN];
  textProto[whichFN] = function rwTextProtoFn() {
    var args;
    if (
      arguments.length > 0 &&
      this.parentElement &&
      this.parentElement.tagName === 'STYLE'
    ) {
      // appendData(DOMString data); dataIndex = 0
      // insertData(unsigned long offset, DOMString data); dataIndex = 1
      // replaceData(unsigned long offset, unsigned long count, DOMString data); dataIndex = 2
      args = new Array(arguments.length);
      var dataIndex = arguments.length - 1;
      if (dataIndex === 2) {
        args[0] = arguments[0];
        args[1] = arguments[1];
      } else if (dataIndex === 1) {
        args[0] = arguments[0];
      }
      args[dataIndex] = wombat.rewriteStyle(arguments[dataIndex]);
    } else {
      args = arguments;
    }
    if (original.__WB_orig_apply) {
      return original.__WB_orig_apply(wombat.proxyToObj(this), args);
    }
    return original.apply(wombat.proxyToObj(this), args);
  };
};

Wombat.prototype.overrideAnUIEvent = function(which) {
  var didOverrideKey = '__wb_' + which + '_overriden';
  var ConstructorFN = this.$wbwindow[which];
  if (
    !ConstructorFN ||
    !ConstructorFN.prototype ||
    ConstructorFN.prototype[didOverrideKey]
  )
    return;
  // ensure if and when view is accessed it is proxied
  var wombat = this;
  this.overridePropToProxy(ConstructorFN.prototype, 'view');
  var initFNKey = 'init' + which;
  if (ConstructorFN.prototype[initFNKey]) {
    var originalInitFn = ConstructorFN.prototype[initFNKey];
    ConstructorFN.prototype[initFNKey] = function() {
      if (arguments.length === 0 || arguments.length < 3) {
        if (originalInitFn.__WB_orig_apply)
          return originalInitFn.__WB_orig_apply(this, arguments);
        return originalInitFn.apply(this, arguments);
      }
      var newArgs = new Array(arguments.length);
      for (var i = 0; i < arguments.length; i++) {
        if (i === 3 && arguments[i] != null) {
          newArgs[i] = wombat.proxyToObj(arguments[i]);
        } else {
          newArgs[i] = arguments[i];
        }
      }
      if (originalInitFn.__WB_orig_apply)
        return originalInitFn.__WB_orig_apply(this, newArgs);
      return originalInitFn.apply(this, newArgs);
    };
  }
  this.$wbwindow[which] = (function(EventConstructor) {
    return function(type, init) {
      if (init) {
        if (init.view != null) {
          init.view = wombat.proxyToObj(init.view);
        }
        if (init.relatedTarget != null) {
          init.relatedTarget = wombat.proxyToObj(init.relatedTarget);
        }
        if (init.target != null) {
          init.target = wombat.proxyToObj(init.target);
        }
      }
      return new EventConstructor(type, init);
    };
  })(ConstructorFN);
  this.$wbwindow[which].prototype = ConstructorFN.prototype;
  Object.defineProperty(this.$wbwindow[which].prototype, 'constructor', {
    value: this.$wbwindow[which]
  });
  this.$wbwindow[which].prototype[didOverrideKey] = true;
};

// init fns

Wombat.prototype.initTextNodeOverrides = function() {
  if (!this.$wbwindow.Text || !this.$wbwindow.Text.prototype) return;
  // https://dom.spec.whatwg.org/#characterdata and https://dom.spec.whatwg.org/#interface-text
  // depending on the JS frameworks used some pages include JS that will append a single text node child
  // to a style tag and then progressively modify that text nodes data for changing the css values that
  // style tag contains
  var textProto = this.$wbwindow.Text.prototype;
  // override inherited CharacterData functions
  this.overrideTextProtoFunction(textProto, 'appendData');
  this.overrideTextProtoFunction(textProto, 'insertData');
  this.overrideTextProtoFunction(textProto, 'replaceData');
  // override property getters and setters
  this.overrideTextProtoGetSet(textProto, 'data');
  this.overrideTextProtoGetSet(textProto, 'wholeText');
};

Wombat.prototype.initAjaxRewrite = function() {
  if (
    !this.$wbwindow.XMLHttpRequest ||
    !this.$wbwindow.XMLHttpRequest.prototype ||
    !this.$wbwindow.XMLHttpRequest.prototype.open
  ) {
    return;
  }

  var orig = this.$wbwindow.XMLHttpRequest.prototype.open;

  var wombat = this;

  this.$wbwindow.XMLHttpRequest.prototype.open = function open(
    method,
    url,
    async,
    user,
    password
  ) {
    var rwURL = url;
    if (!this._no_rewrite) {
      rwURL = wombat.rewriteUrl(url);
    }
    var openAsync = true;
    if (async != null && !async) {
      openAsync = false;
    }
    orig.call(this, method, rwURL, openAsync, user, password);
    if (!wombat.startsWith(rwURL, 'data:')) {
      this.setRequestHeader('X-Pywb-Requested-With', 'XMLHttpRequest');
    }
  };

  // responseURL override
  this.overridePropExtract(
    this.$wbwindow.XMLHttpRequest.prototype,
    'responseURL'
  );
};

Wombat.prototype.initAttrOverrides = function() {
  // href attr overrides
  this.overrideHrefAttr(this.$wbwindow.HTMLLinkElement.prototype, 'cs_');
  this.overrideHrefAttr(this.$wbwindow.CSSStyleSheet.prototype, 'cs_');
  this.overrideHrefAttr(this.$wbwindow.HTMLBaseElement.prototype, 'mp_');
  // srcset attr overrides
  this.overrideSrcsetAttr(this.$wbwindow.HTMLImageElement.prototype, 'im_');
  this.overrideSrcsetAttr(this.$wbwindow.HTMLSourceElement.prototype, 'oe_');
  // poster attr overrides
  this.overrideAttr(this.$wbwindow.HTMLVideoElement.prototype, 'poster', 'im_');
  this.overrideAttr(this.$wbwindow.HTMLAudioElement.prototype, 'poster', 'im_');
  // src attr overrides
  this.overrideAttr(this.$wbwindow.HTMLImageElement.prototype, 'src', 'im_');
  this.overrideAttr(this.$wbwindow.HTMLInputElement.prototype, 'src', 'oe_');
  this.overrideAttr(this.$wbwindow.HTMLEmbedElement.prototype, 'src', 'oe_');
  this.overrideAttr(this.$wbwindow.HTMLVideoElement.prototype, 'src', 'oe_');
  this.overrideAttr(this.$wbwindow.HTMLAudioElement.prototype, 'src', 'oe_');
  this.overrideAttr(this.$wbwindow.HTMLSourceElement.prototype, 'src', 'oe_');
  if (window.HTMLTrackElement && window.HTMLTrackElement.prototype) {
    this.overrideAttr(this.$wbwindow.HTMLTrackElement.prototype, 'src', 'oe_');
  }
  this.overrideAttr(this.$wbwindow.HTMLIFrameElement.prototype, 'src', 'if_');
  if (
    this.$wbwindow.HTMLFrameElement &&
    this.$wbwindow.HTMLFrameElement.prototype
  ) {
    this.overrideAttr(this.$wbwindow.HTMLFrameElement.prototype, 'src', 'fr_');
  }
  this.overrideAttr(this.$wbwindow.HTMLScriptElement.prototype, 'src', 'js_');
  // other attr overrides
  this.overrideAttr(this.$wbwindow.HTMLObjectElement.prototype, 'data', 'oe_');
  this.overrideAttr(this.$wbwindow.HTMLMetaElement.prototype, 'content', 'mp_');
  this.overrideAttr(this.$wbwindow.HTMLFormElement.prototype, 'action', 'mp_');

  // a, area tag overrides
  this.overrideAnchorAreaElem(this.$wbwindow.HTMLAnchorElement);
  this.overrideAnchorAreaElem(this.$wbwindow.HTMLAreaElement);

  var style_proto = this.$wbwindow.CSSStyleDeclaration.prototype;

  // For FF
  if (this.$wbwindow.CSS2Properties) {
    style_proto = this.$wbwindow.CSS2Properties.prototype;
  }

  this.overrideStyleAttr(style_proto, 'cssText');

  this.overrideStyleAttr(style_proto, 'background', 'background');
  this.overrideStyleAttr(style_proto, 'backgroundImage', 'background-image');

  this.overrideStyleAttr(style_proto, 'cursor', 'cursor');

  this.overrideStyleAttr(style_proto, 'listStyle', 'list-style');
  this.overrideStyleAttr(style_proto, 'listStyleImage', 'list-style-image');

  this.overrideStyleAttr(style_proto, 'border', 'border');
  this.overrideStyleAttr(style_proto, 'borderImage', 'border-image');
  this.overrideStyleAttr(
    style_proto,
    'borderImageSource',
    'border-image-source'
  );
  this.overrideStyleAttr(style_proto, 'maskImage', 'mask-image');

  this.overrideStyleSetProp(style_proto);

  if (this.$wbwindow.CSSStyleSheet && this.$wbwindow.CSSStyleSheet.prototype) {
    // https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/insertRule
    // ruleText is a string of raw css....
    var wombat = this;
    var oInsertRule = this.$wbwindow.CSSStyleSheet.prototype.insertRule;
    this.$wbwindow.CSSStyleSheet.prototype.insertRule = function insertRule(
      ruleText,
      index
    ) {
      return oInsertRule.call(this, wombat.rewriteStyle(ruleText), index);
    };
  }

  if (this.$wbwindow.CSSRule && this.$wbwindow.CSSRule.prototype) {
    this.overrideStyleAttr(this.$wbwindow.CSSRule.prototype, 'cssText');
  }
};

Wombat.prototype.initCSSOMOverrides = function() {
  if (
    this.$wbwindow.StylePropertyMap &&
    this.$wbwindow.StylePropertyMap.prototype
  ) {
    var wombat = this;
    var originalSet = this.$wbwindow.StylePropertyMap.prototype.set;
    this.$wbwindow.StylePropertyMap.prototype.set = function() {
      if (arguments.length <= 1) {
        if (originalSet.__WB_orig_apply)
          return originalSet.__WB_orig_apply(this, arguments);
        return originalSet.apply(this, arguments);
      }
      var newArgs = new Array(arguments.length);
      newArgs[0] = arguments[0];
      for (var i = 1; i < arguments.length; i++) {
        newArgs[i] = wombat.rewriteStyle(arguments[i]);
      }
      if (originalSet.__WB_orig_apply)
        return originalSet.__WB_orig_apply(this, arguments);
      return originalSet.apply(this, arguments);
    };
    var originalAppend = this.$wbwindow.StylePropertyMap.prototype.append;
    this.$wbwindow.StylePropertyMap.prototype.append = function() {
      if (arguments.length <= 1) {
        if (originalSet.__WB_orig_apply)
          return originalAppend.__WB_orig_apply(this, arguments);
        return originalAppend.apply(this, arguments);
      }
      var newArgs = new Array(arguments.length);
      newArgs[0] = arguments[0];
      for (var i = 1; i < arguments.length; i++) {
        newArgs[i] = wombat.rewriteStyle(arguments[i]);
      }
      if (originalAppend.__WB_orig_apply)
        return originalAppend.__WB_orig_apply(this, arguments);
      return originalAppend.apply(this, arguments);
    };
  }
};

Wombat.prototype.initAudioOverride = function() {
  if (!this.$wbwindow.Audio) return;
  var orig_audio = this.$wbwindow.Audio;
  var wombat = this;
  this.$wbwindow.Audio = (function(Audio_) {
    return function Audio(url) {
      return new Audio_(wombat.rewriteUrl(url, true, 'oe_'));
    };
  })(this.$wbwindow.Audio);

  this.$wbwindow.Audio.prototype = orig_audio.prototype;
  Object.defineProperty(this.$wbwindow.Audio.prototype, 'constructor', {
    value: this.$wbwindow.Audio
  });
};

Wombat.prototype.initBadPrefixes = function(prefix) {
  this.BAD_PREFIXES = [
    'http:' + prefix,
    'https:' + prefix,
    'http:/' + prefix,
    'https:/' + prefix
  ];
};

Wombat.prototype.initCryptoRandom = function() {
  if (!this.$wbwindow.crypto || !this.$wbwindow.Crypto) return;

  // var orig_getrandom = this.$wbwindow.Crypto.prototype.getRandomValues
  var wombat = this;
  var new_getrandom = function getRandomValues(array) {
    for (var i = 0; i < array.length; i++) {
      array[i] = parseInt(wombat.$wbwindow.Math.random() * 4294967296);
    }
    return array;
  };

  this.$wbwindow.Crypto.prototype.getRandomValues = new_getrandom;
  this.$wbwindow.crypto.getRandomValues = new_getrandom;
};

Wombat.prototype.initDateOverride = function(timestamp) {
  if (this.$wbwindow.__wb_Date_now) return;
  var newTimestamp = parseInt(timestamp) * 1000;
  // var timezone = new Date().getTimezoneOffset() * 60 * 1000;
  // Already UTC!
  var timezone = 0;
  var start_now = this.$wbwindow.Date.now();
  var timediff = start_now - (newTimestamp - timezone);

  var orig_date = this.$wbwindow.Date;

  var orig_utc = this.$wbwindow.Date.UTC;
  var orig_parse = this.$wbwindow.Date.parse;
  var orig_now = this.$wbwindow.Date.now;

  this.$wbwindow.__wb_Date_now = orig_now;

  this.$wbwindow.Date = (function(Date_) {
    return function Date(A, B, C, D, E, F, G) {
      // Apply doesn't work for constructors and Date doesn't
      // seem to like undefined args, so must explicitly
      // call constructor for each possible args 0..7
      if (A === undefined) {
        return new Date_(orig_now() - timediff);
      } else if (B === undefined) {
        return new Date_(A);
      } else if (C === undefined) {
        return new Date_(A, B);
      } else if (D === undefined) {
        return new Date_(A, B, C);
      } else if (E === undefined) {
        return new Date_(A, B, C, D);
      } else if (F === undefined) {
        return new Date_(A, B, C, D, E);
      } else if (G === undefined) {
        return new Date_(A, B, C, D, E, F);
      } else {
        return new Date_(A, B, C, D, E, F, G);
      }
    };
  })(this.$wbwindow.Date);

  this.$wbwindow.Date.prototype = orig_date.prototype;

  this.$wbwindow.Date.now = function now() {
    return orig_now() - timediff;
  };

  this.$wbwindow.Date.UTC = orig_utc;
  this.$wbwindow.Date.parse = orig_parse;

  this.$wbwindow.Date.__WB_timediff = timediff;

  Object.defineProperty(this.$wbwindow.Date.prototype, 'constructor', {
    value: this.$wbwindow.Date
  });
};

Wombat.prototype.initDocTitleOverride = function() {
  var orig_get_title = this.getOrigGetter(this.$wbwindow.document, 'title');
  var orig_set_title = this.getOrigSetter(this.$wbwindow.document, 'title');

  var wombat = this;

  var set_title = function title(value) {
    var res = orig_set_title.call(this, value);

    var message = {
      wb_type: 'title',
      title: value
    };

    wombat.sendTopMessage(message);

    return res;
  };

  this.defProp(this.$wbwindow.document, 'title', set_title, orig_get_title);
};

Wombat.prototype.initFontFaceOverride = function() {
  if (!this.$wbwindow.FontFace || this.$wbwindow.FontFace.__wboverriden__) {
    return;
  }
  // per https://drafts.csswg.org/css-font-loading/#FontFace-interface and Chrome, FF, Opera Support
  var wombat = this;
  var origFontFace = this.$wbwindow.FontFace;
  this.$wbwindow.FontFace = (function(FontFace_) {
    return function FontFace(family, source, descriptors) {
      var rwSource = source;
      if (source != null) {
        if (typeof source !== 'string') {
          // is CSSOMString or ArrayBuffer or ArrayBufferView
          rwSource = wombat.rewriteInlineStyle(source.toString());
        } else {
          rwSource = wombat.rewriteInlineStyle(source);
        }
      }
      return new FontFace_(family, rwSource, descriptors);
    };
  })(this.$wbwindow.FontFace);
  this.$wbwindow.FontFace.prototype = origFontFace.prototype;
  Object.defineProperty(this.$wbwindow.FontFace.prototype, 'constructor', {
    value: this.$wbwindow.FontFace
  });
  this.$wbwindow.FontFace.__wboverriden__ = true;
};

Wombat.prototype.initFixedRatio = function() {
  try {
    // otherwise, just set it
    this.$wbwindow.devicePixelRatio = 1;
  } catch (e) {}

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

Wombat.prototype.initPaths = function(wbinfo) {
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

  this.initBadPrefixes(this.wb_replay_prefix);
};

Wombat.prototype.initSeededRandom = function(seed) {
  // Adapted from:
  // http://indiegamr.com/generate-repeatable-random-numbers-in-js/

  this.$wbwindow.Math.seed = parseInt(seed);
  var wombat = this;

  this.$wbwindow.Math.random = function random() {
    wombat.$wbwindow.Math.seed =
      (wombat.$wbwindow.Math.seed * 9301 + 49297) % 233280;
    return wombat.$wbwindow.Math.seed / 233280;
  };
};

Wombat.prototype.initHistoryOverrides = function() {
  this.overrideHistoryFunc('pushState');
  this.overrideHistoryFunc('replaceState');
  var wombat = this;
  this.$wbwindow.addEventListener('popstate', function(event) {
    wombat.sendHistoryUpdate(
      wombat.$wbwindow.WB_wombat_location.href,
      wombat.$wbwindow.document.title
    );
  });
};

Wombat.prototype.initFetchRewrite = function() {
  if (!this.$wbwindow.fetch) return;

  var orig_fetch = this.$wbwindow.fetch;
  var wombat = this;

  this.$wbwindow.fetch = function fetch(input, init_opts) {
    var inputType = typeof input;
    if (inputType === 'string') {
      input = wombat.rewriteUrl(input);
    } else if (inputType === 'object' && input.url) {
      var new_url = wombat.rewriteUrl(input.url);
      if (new_url !== input.url) {
        input = new Request(new_url, input);
      }
    } else if (inputType === 'object' && input.href) {
      // it is likely that input is either window.location or window.URL
      input = wombat.rewriteUrl(input.href);
    }

    init_opts = init_opts || {};
    init_opts['credentials'] = 'include';

    return orig_fetch.call(wombat.proxyToObj(this), input, init_opts);
  };
  // // attempt to hide our override
  // this.$wbwindow.fetch.toString = orig_fetch.toString.bind(orig_fetch)
};

Wombat.prototype.initRequestOverride = function() {
  if (!this.$wbwindow.Request) return;

  var orig_request = this.$wbwindow.Request;
  var womabt = this;

  this.$wbwindow.Request = (function(Request_) {
    return function Request(input, init_opts) {
      var newInitOpts = init_opts || {};
      var newInput;
      var inputType = typeof input;
      if (inputType === 'string') {
        newInput = womabt.rewriteUrl(input);
      } else if (inputType === 'object' && input.url) {
        newInput = input;
        var new_url = womabt.rewriteUrl(newInput.url);
        if (new_url !== newInput.url) {
          //    input = new Request(new_url, input);
          newInput.url = new_url;
        }
      }
      newInitOpts['credentials'] = 'include';
      return new Request_(newInput, newInitOpts);
    };
  })(this.$wbwindow.Request);

  this.$wbwindow.Request.prototype = orig_request.prototype;
};

Wombat.prototype.initSetAttributeOverride = function() {
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
  this.$wbwindow.Element.prototype.setAttribute = function setAttribute(
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
        rwValue = wombat.rewriteInlineStyle(value);
      } else if (wombat.shouldRewriteAttr(this.tagName, lowername)) {
        wombat.removeWBOSRC(this);
        if (!this._no_rewrite) {
          rwValue = wombat.rewriteUrl(
            value,
            false,
            wombat.rwModForElement(this, lowername)
          );
        }
      } else if (lowername === 'style') {
        rwValue = wombat.rewriteStyle(value);
      } else if (lowername === 'srcset') {
        rwValue = wombat.rewriteSrcset(value, this);
      }
    }
    return orig_setAttribute.call(this, name, rwValue);
  };
};

Wombat.prototype.initGetAttributeOverride = function() {
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
  this.$wbwindow.Element.prototype.getAttribute = function getAttribute(name) {
    var result = orig_getAttribute.call(this, name);

    if (wombat.shouldRewriteAttr(this.tagName, name)) {
      var maybeWBOSRC = wombat.retrieveWBOSRC(this);
      if (maybeWBOSRC) {
        return maybeWBOSRC;
      }
      return wombat.extractOriginalURL(result);
    } else if (
      wombat.startsWith(name, 'data-') &&
      wombat.startsWithOneOf(result, wombat.VALID_PREFIXES)
    ) {
      return wombat.extractOriginalURL(result);
    }

    return result;
  };
};

Wombat.prototype.initSvgImageOverrides = function() {
  if (!this.$wbwindow.SVGImageElement) return;

  var orig_getAttr = this.$wbwindow.SVGImageElement.prototype.getAttribute;
  var orig_getAttrNS = this.$wbwindow.SVGImageElement.prototype.getAttributeNS;
  var orig_setAttr = this.$wbwindow.SVGImageElement.prototype.setAttribute;
  var orig_setAttrNS = this.$wbwindow.SVGImageElement.prototype.setAttributeNS;
  var wombat = this;

  this.$wbwindow.SVGImageElement.prototype.getAttribute = function getAttribute(
    name
  ) {
    var value = orig_getAttr.call(this, name);
    if (name.indexOf('xlink:href') >= 0 || name === 'href') {
      return wombat.extractOriginalURL(value);
    }
    return value;
  };

  this.$wbwindow.SVGImageElement.prototype.getAttributeNS = function getAttributeNS(
    ns,
    name
  ) {
    var value = orig_getAttrNS.call(this, ns, name);
    if (name === 'href') {
      return wombat.extractOriginalURL(value);
    }
    return value;
  };

  this.$wbwindow.SVGImageElement.prototype.setAttribute = function setAttribute(
    name,
    value
  ) {
    var rwValue = value;
    if (name.indexOf('xlink:href') >= 0 || name === 'href') {
      rwValue = wombat.rewriteUrl(value);
    }
    return orig_setAttr.call(this, name, rwValue);
  };

  this.$wbwindow.SVGImageElement.prototype.setAttributeNS = function setAttributeNS(
    ns,
    name,
    value
  ) {
    var rwValue = value;
    if (name === 'href') {
      rwValue = wombat.rewriteUrl(value);
    }
    return orig_setAttrNS.call(this, ns, name, rwValue);
  };
};

Wombat.prototype.initCreateElementNSFix = function() {
  if (
    !this.$wbwindow.document.createElementNS ||
    !this.$wbwindow.Document.prototype.createElementNS
  ) {
    return;
  }
  var orig_createElementNS = this.$wbwindow.document.createElementNS;
  var wombat = this;

  var createElementNS = function createElementNS(namespaceURI, qualifiedName) {
    return orig_createElementNS.call(
      wombat.proxyToObj(this),
      wombat.extractOriginalURL(namespaceURI),
      qualifiedName
    );
  };

  this.$wbwindow.Document.prototype.createElementNS = createElementNS;
  this.$wbwindow.document.createElementNS = createElementNS;
};

Wombat.prototype.initInsertAdjacentHTMLOverride = function() {
  if (
    !this.$wbwindow.Element ||
    !this.$wbwindow.Element.prototype ||
    !this.$wbwindow.Element.prototype.insertAdjacentHTML
  ) {
    return;
  }
  var elementProto = this.$wbwindow.Element.prototype;
  var orig_insertAdjacentHTML = elementProto.insertAdjacentHTML;
  var wombat = this;
  elementProto.insertAdjacentHTML = function insertAdjacentHTML(
    position,
    text
  ) {
    var rwText = text;
    if (!this._no_rewrite) {
      rwText = wombat.rewriteHtml(text);
    }
    return orig_insertAdjacentHTML.call(this, position, rwText);
  };
};

Wombat.prototype.initInsertAdjacentElementOverride = function() {
  if (
    !this.$wbwindow.Element ||
    !this.$wbwindow.Element.prototype ||
    !this.$wbwindow.Element.prototype.insertAdjacentElement
  ) {
    return;
  }
  var elementProto = this.$wbwindow.Element.prototype;
  var wombat = this;
  var origIAdjElem = elementProto.insertAdjacentElement;
  elementProto.insertAdjacentElement = function insertAdjacentElement(
    position,
    element
  ) {
    if (!this._no_rewrite) {
      wombat.rewriteElem(element);
      // special check for nested elements
      if (element.children || element.childNodes) {
        wombat.recurseRewriteElem(element);
      }
      return origIAdjElem.call(this, position, element);
    }
    return origIAdjElem.call(this, position, element);
  };
};

Wombat.prototype.initDomOverride = function() {
  if (!this.$wbwindow.Node || !this.$wbwindow.Node.prototype) {
    return;
  }

  this.replaceDomFunc('appendChild');
  this.replaceDomFunc('insertBefore');
  this.replaceDomFunc('replaceChild');

  this.overridePropToProxy(this.$wbwindow.Node.prototype, 'ownerDocument');
  this.overridePropToProxy(
    this.$wbwindow.HTMLHtmlElement.prototype,
    'parentNode'
  );
  this.overridePropToProxy(this.$wbwindow.Event.prototype, 'target');
};

Wombat.prototype.initDocOverrides = function($document) {
  if (!Object.defineProperty) return;

  // referrer
  this.overridePropExtract($document, 'referrer');

  // origin
  this.defProp($document, 'origin', undefined, function origin() {
    return this.WB_wombat_location.origin;
  });
  // https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/origin, chrome 59+ and ff 54+
  this.defProp(this.$wbwindow, 'origin', undefined, function origin() {
    return this.WB_wombat_location.origin;
  });

  var wombat = this;
  // domain
  var domain_setter = function domain(val) {
    var loc = this.WB_wombat_location;
    if (loc && wombat.endsWith(loc.hostname, val)) {
      this.__wb_domain = val;
    }
  };

  var domain_getter = function domain() {
    return this.__wb_domain || this.WB_wombat_location.hostname;
  };

  this.defProp($document, 'domain', domain_setter, domain_getter);
};

Wombat.prototype.initWriteOverride = function() {
  if (!this.$wbwindow.DOMParser) {
    return;
  }

  // Write
  var orig_doc_write = this.$wbwindow.document.write;
  var wombat = this;
  var arrayJoin = wombat.$wbwindow.Array.prototype.join;

  var new_write = function write() {
    var argLen = arguments.length;
    var string;
    if (argLen === 0) {
      return orig_doc_write.call(this);
    } else if (argLen === 1) {
      string = arguments[0];
    } else {
      // use Array.join rather than Array.apply because join works with array like objects
      string = arrayJoin.call(arguments, '');
    }
    var new_buff = wombat.rewriteHtml(string, true);
    if (!new_buff) {
      return;
    }
    var res = orig_doc_write.call(wombat.proxyToObj(this), new_buff);
    wombat.initNewWindowWombat(this.defaultView);
    return res;
  };

  this.$wbwindow.document.write = new_write;
  this.$wbwindow.Document.prototype.write = new_write;

  // Writeln
  var orig_doc_writeln = this.$wbwindow.document.writeln;

  var new_writeln = function writeln() {
    var argLen = arguments.length;
    var string;
    if (argLen === 0) {
      return orig_doc_writeln.call(this);
    } else if (argLen === 1) {
      string = arguments[0];
    } else {
      string = arrayJoin.call(arguments, '');
    }
    var new_buff = wombat.rewriteHtml(string, true);
    if (!new_buff) {
      return;
    }
    var res = orig_doc_writeln.call(wombat.proxyToObj(this), new_buff);
    wombat.initNewWindowWombat(this.defaultView);
    return res;
  };

  this.$wbwindow.document.writeln = new_writeln;
  this.$wbwindow.Document.prototype.writeln = new_writeln;

  // Open
  var orig_doc_open = this.$wbwindow.document.open;

  var new_open = function open() {
    var res = orig_doc_open.call(wombat.proxyToObj(this));
    wombat.initNewWindowWombat(this.defaultView);
    return res;
  };

  this.$wbwindow.document.open = new_open;
  this.$wbwindow.Document.prototype.open = new_open;
};

Wombat.prototype.initIframeWombat = function(iframe) {
  var win;

  if (iframe._get_contentWindow) {
    win = iframe._get_contentWindow.call(iframe); // eslint-disable-line no-useless-call
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

  this.initNewWindowWombat(win, src);
};

Wombat.prototype.initNewWindowWombat = function(win, src) {
  if (!win || win._wb_wombat) return;
  if (
    !src ||
    src === '' ||
    src === 'about:blank' ||
    src.indexOf('javascript:') >= 0
  ) {
    // win._WBWombat = wombat_internal(win);
    // win._wb_wombat = new win._WBWombat(wb_info);
    var wombat = new Wombat(win, this.wb_info);
    win._wb_wombat = wombat.wombatInit();
  } else {
    // These should get overriden when content is loaded, but just in case...
    // win._WB_wombat_location = win.location;
    // win.document.WB_wombat_location = win.document.location;
    // win._WB_wombat_top = $wbwindow.WB_wombat_top;

    this.initProtoPmOrigin(win);
    this.initPostMessageOverride(win);
    this.initMessageEventOverride(win);
  }
};

Wombat.prototype.initTimeoutIntervalOverrides = function(which) {
  // because [setTimeout|setInterval]('document.location.href = "xyz.com"', time) is legal and used
  if (this.$wbwindow[which] && !this.$wbwindow[which].__$wbpatched$__) {
    var original = this.$wbwindow[which];
    var wombat = this;
    this.$wbwindow[which] = function setTimeoutIntervalOverride() {
      // strings are primitives with a prototype or __proto__ of String depending on the browser
      var rw =
        arguments[0] != null &&
        Object.getPrototypeOf(arguments[0]) === String.prototype;
      // do not mess with the arguments object unless you want instant de-optimization
      var args = rw ? new Array(arguments.length) : arguments;
      if (rw) {
        if (wombat.$wbwindow.Proxy) {
          args[0] = wombat.wrapScriptTextJsProxy(arguments[0]);
        } else {
          args[0] = arguments[0].replace(/\blocation\b/g, 'WB_wombat_$&');
        }
        for (var i = 1; i < arguments.length; ++i) {
          args[i] = wombat.proxyToObj(arguments[i]);
        }
      }
      // setTimeout|setInterval does not require its this arg to be window so just in case
      // someone got funky with it
      var thisObj = wombat.proxyToObj(this);
      if (original.__WB_orig_apply) {
        return original.__WB_orig_apply(thisObj, args);
      }
      return original.apply(thisObj, args);
    };
    this.$wbwindow[which].__$wbpatched$__ = true;
  }
};

Wombat.prototype.initAutoFetchWorker = function() {
  if (!this.wbUseAFWorker) {
    return;
  }
  this.WBAutoFetchWorker = new AutoFetchWorker(this);
  var wombat = this;
  this.utilFns.wbSheetMediaQChecker = function checkStyle() {
    // used only for link[rel='stylesheet'] so we remove our listener
    this.removeEventListener('load', wombat.utilFns.wbSheetMediaQChecker);
    // check no op condition
    if (this.sheet == null) return;
    // defer extraction to be nice :)
    wombat.WBAutoFetchWorker.deferredSheetExtraction(this.sheet);
  };
};

Wombat.prototype.initWebWorkerOverride = function() {
  if (!this.$wbwindow.Worker) {
    return;
  }
  // Worker unrewrite postMessage
  var orig_worker = this.$wbwindow.Worker;
  var wombat = this;
  this.$wbwindow.Worker = (function(Worker_) {
    return function Worker(url) {
      return new Worker_(wombat.rewriteWorker(url));
    };
  })(orig_worker);

  this.$wbwindow.Worker.prototype = orig_worker.prototype;
};

Wombat.prototype.initSharedWorkerOverride = function() {
  if (!this.$wbwindow.SharedWorker) {
    return;
  }
  // per https://html.spec.whatwg.org/multipage/workers.html#sharedworker
  var oSharedWorker = this.$wbwindow.SharedWorker;
  var wombat = this;
  this.$wbwindow.SharedWorker = (function(SharedWorker_) {
    return function SharedWorker(url) {
      return new SharedWorker_(wombat.rewriteWorker(url));
    };
  })(oSharedWorker);

  this.$wbwindow.SharedWorker.prototype = oSharedWorker.prototype;
};

Wombat.prototype.initServiceWorkerOverride = function() {
  if (
    !this.$wbwindow.ServiceWorkerContainer ||
    !this.$wbwindow.ServiceWorkerContainer.prototype ||
    !this.$wbwindow.ServiceWorkerContainer.prototype.register
  ) {
    return;
  }
  var orig_register = this.$wbwindow.ServiceWorkerContainer.prototype.register;
  var wombat = this;
  this.$wbwindow.ServiceWorkerContainer.prototype.register = function register(
    scriptURL,
    options
  ) {
    var newScriptURL = new URL(scriptURL, wombat.$wbwindow.document.baseURI)
      .href;
    if (options && options.scope) {
      options.scope = wombat.rewriteUrl(options.scope, false, 'mp_');
    } else {
      options = { scope: wombat.rewriteUrl('/', false, 'mp_') };
    }
    return orig_register.call(
      this,
      wombat.rewriteUrl(newScriptURL, false, 'sw_'),
      options
    );
  };
};

Wombat.prototype.initWorkletOverride = function() {
  if (
    !this.$wbwindow.Worklet ||
    !this.$wbwindow.Worklet.prototype ||
    this.$wbwindow.Worklet.prototype.__wb_workerlet_overriden
  )
    return;
  var oAddModule = this.$wbwindow.Worklet.prototype.addModule;
  var wombat = this;
  this.$wbwindow.Worklet.prototype.addModule = function addModule(
    moduleURL,
    options
  ) {
    var rwModuleURL = wombat.rewriteUrl(moduleURL, false, 'js_');
    return oAddModule.call(this, rwModuleURL, options);
  };
  this.$wbwindow.Worklet.prototype.__wb_workerlet_overriden = true;
};

Wombat.prototype.initLocOverride = function(loc, oSetter, oGetter) {
  if (Object.defineProperty) {
    for (var i = 0; i < this.URL_PROPS.length; i++) {
      var prop = this.URL_PROPS[i];
      this.defProp(
        loc,
        prop,
        this.makeSetLocProp(prop, oSetter, oGetter),
        this.makeGetLocProp(prop, oGetter),
        true
      );
    }
  }
};

Wombat.prototype.initWombatLoc = function(win) {
  if (!win || (win.WB_wombat_location && win.document.WB_wombat_location)) {
    return;
  }

  // Location
  var wombat_location = new WombatLocation(win.location, this);

  if (Object.defineProperty) {
    var setter = function location(value) {
      var loc =
        this._WB_wombat_location ||
        (this.defaultView && this.defaultView._WB_wombat_location) ||
        this.location;

      if (loc) {
        loc.href = value;
      }
    };

    var getter = function location() {
      return (
        this._WB_wombat_location ||
        (this.defaultView && this.defaultView._WB_wombat_location) ||
        this.location
      );
    };

    this.defProp(win.Object.prototype, 'WB_wombat_location', setter, getter);

    this.initProtoPmOrigin(win);

    win._WB_wombat_location = wombat_location;
  } else {
    win.WB_wombat_location = wombat_location;

    // Check quickly after page load
    setTimeout(this.checkAllLocations, 500);

    // Check periodically every few seconds
    setInterval(this.checkAllLocations, 500);
  }
};

Wombat.prototype.initProtoPmOrigin = function(win) {
  if (win.Object.prototype.__WB_pmw) {
    return;
  }

  var pm_origin = function pm_origin(origin_window) {
    this.__WB_source = origin_window;
    return this;
  };

  try {
    win.Object.defineProperty(win.Object.prototype, '__WB_pmw', {
      get: function() {
        return pm_origin;
      },
      set: function() {},
      configurable: true,
      enumerable: false
    });
  } catch (e) {}

  win.__WB_check_loc = function(loc) {
    if (loc instanceof Location || loc instanceof WombatLocation) {
      return this.WB_wombat_location;
    } else {
      return {};
    }
  };
};

Wombat.prototype.initHashChange = function() {
  if (!this.$wbwindow.__WB_top_frame) return;

  var wombat = this;

  var receive_hash_change = function receive_hash_change(event) {
    var source = wombat.proxyToObj(event.source);

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
  };

  var send_hash_change = function send_hash_change() {
    var message = {
      wb_type: 'hashchange',
      hash: wombat.$wbwindow.location.hash
    };

    wombat.sendTopMessage(message);
  };

  this.$wbwindow.addEventListener('message', receive_hash_change);

  this.$wbwindow.addEventListener('hashchange', send_hash_change);
};

Wombat.prototype.initPostMessageOverride = function($wbwindow) {
  if (!$wbwindow.postMessage || $wbwindow.__orig_postMessage) {
    return;
  }

  var orig = $wbwindow.postMessage;
  var wombat = this;

  $wbwindow.__orig_postMessage = orig;

  // use this_obj.__WB_source not window to fix google calendar embeds, pm_origin sets this.__WB_source
  var postmessage_rewritten = function postMessage(
    message,
    targetOrigin,
    transfer,
    from_top
  ) {
    var from;
    var src_id;
    var this_obj = wombat.proxyToObj(this);

    if (this_obj.__WB_source && this_obj.__WB_source.WB_wombat_location) {
      var source = this_obj.__WB_source;

      from = source.WB_wombat_location.origin;

      if (!this_obj.__WB_win_id) {
        this_obj.__WB_win_id = {};
        this_obj.__WB_counter = 0;
      }

      if (!source.__WB_id) {
        this_obj.__WB_counter += 1;
        source.__WB_id = this_obj.__WB_counter + source.WB_wombat_location.href;
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

  var eventTarget = null;
  if ($wbwindow.EventTarget && $wbwindow.EventTarget.prototype) {
    eventTarget = $wbwindow.EventTarget.prototype;
  } else {
    eventTarget = $wbwindow;
  }

  // ADD
  var _oAddEventListener = eventTarget.addEventListener;
  eventTarget.addEventListener = function addEventListener(
    type,
    listener,
    useCapture
  ) {
    var obj = wombat.proxyToObj(this);
    var rwListener = listener;
    if (type === 'message') {
      rwListener = wombat.message_listeners.add_or_get(listener, function() {
        return wrapEventListener(listener, obj, wombat);
      });
    } else if (type === 'storage') {
      rwListener = wombat.storage_listeners.add_or_get(listener, function() {
        return wrapSameOriginEventListener(listener, obj);
      });
    }
    return _oAddEventListener.call(obj, type, rwListener, useCapture);
  };

  // REMOVE
  var _oRemoveEventListener = eventTarget.removeEventListener;
  eventTarget.removeEventListener = function removeEventListener(
    type,
    listener,
    useCapture
  ) {
    var obj = wombat.proxyToObj(this);
    var rwListener = listener;

    if (type === 'message') {
      rwListener = wombat.message_listeners.remove(listener);
    } else if (type === 'storage') {
      rwListener = wombat.storage_listeners.remove(listener);
    }

    if (rwListener) {
      return _oRemoveEventListener.call(obj, type, rwListener, useCapture);
    }
  };

  // ONMESSAGE & ONSTORAGE
  var override_on_prop = function(onevent, wrapperFN) {
    // var orig_getter = _wombat.getOrigGetter($wbwindow, onevent)
    var orig_setter = wombat.getOrigSetter($wbwindow, onevent);

    var setter = function(value) {
      this['__orig_' + onevent] = value;
      var obj = wombat.proxyToObj(this);
      var listener = value ? wrapperFN(value, obj, wombat) : value;
      return orig_setter.call(obj, listener);
    };

    var getter = function() {
      return this['__orig_' + onevent];
    };

    wombat.defProp($wbwindow, onevent, setter, getter);
  };

  override_on_prop('onmessage', wrapEventListener);
  override_on_prop('onstorage', wrapSameOriginEventListener);
};

Wombat.prototype.initMessageEventOverride = function($wbwindow) {
  if (!$wbwindow.MessageEvent || $wbwindow.MessageEvent.prototype.__extended) {
    return;
  }

  this.addEventOverride('target');
  this.addEventOverride('srcElement');
  this.addEventOverride('currentTarget');
  this.addEventOverride('eventPhase');
  this.addEventOverride('path');

  this.overridePropToProxy($wbwindow.MessageEvent.prototype, 'source');

  $wbwindow.MessageEvent.prototype.__extended = true;
};

Wombat.prototype.initUIEventsOverrides = function() {
  this.overrideAnUIEvent('UIEvent');
  this.overrideAnUIEvent('MouseEvent');
  this.overrideAnUIEvent('TouchEvent');
  this.overrideAnUIEvent('FocusEvent');
  this.overrideAnUIEvent('KeyboardEvent');
  this.overrideAnUIEvent('WheelEvent');
  this.overrideAnUIEvent('InputEvent');
  this.overrideAnUIEvent('CompositionEvent');
};

Wombat.prototype.initOpenOverride = function() {
  var orig = this.$wbwindow.open;

  if (this.$wbwindow.Window.prototype.open) {
    orig = this.$wbwindow.Window.prototype.open;
  }

  var wombat = this;

  var open_rewritten = function open(strUrl, strWindowName, strWindowFeatures) {
    var rwStrUrl = wombat.rewriteUrl(strUrl, false, '');
    var res = orig.call(
      wombat.proxyToObj(this),
      rwStrUrl,
      strWindowName,
      strWindowFeatures
    );
    wombat.initNewWindowWombat(res, rwStrUrl);
    return res;
  };

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

Wombat.prototype.initCookiesOverride = function() {
  var orig_get_cookie = this.getOrigGetter(this.$wbwindow.document, 'cookie');
  var orig_set_cookie = this.getOrigSetter(this.$wbwindow.document, 'cookie');

  if (!orig_get_cookie) {
    orig_get_cookie = this.getOrigGetter(
      this.$wbwindow.Document.prototype,
      'cookie'
    );
  }
  if (!orig_set_cookie) {
    orig_set_cookie = this.getOrigSetter(
      this.$wbwindow.Document.prototype,
      'cookie'
    );
  }

  var rwCookieReplacer = function(m, d1) {
    var date = new Date(d1);
    if (isNaN(date.getTime())) {
      return 'Expires=Thu,| 01 Jan 1970 00:00:00 GMT';
    }
    var finalDate = new Date(date.getTime() + Date.__WB_timediff);
    return 'Expires=' + finalDate.toUTCString().replace(',', ',|');
  };

  var wombat = this;
  var set_cookie = function cookie(value) {
    if (!value) return;
    var newValue = value.replace(wombat.cookie_expires_regex, rwCookieReplacer);
    var cookies = newValue.split(/,(?![|])/);
    for (var i = 0; i < cookies.length; i++) {
      cookies[i] = wombat.rewriteCookie(cookies[i]);
    }
    return orig_set_cookie.call(wombat.proxyToObj(this), cookies.join(','));
  };

  var get_cookie = function cookie() {
    return orig_get_cookie.call(wombat.proxyToObj(this));
  };

  this.defProp(this.$wbwindow.document, 'cookie', set_cookie, get_cookie);
};

Wombat.prototype.initEvalOverride = function() {
  var orig_eval = this.$wbwindow.eval;

  this.$wbwindow.eval = function(string) {
    if (string) {
      string = string.toString().replace(/\blocation\b/g, 'WB_wombat_$&');
    }
    orig_eval.call(this, string);
  };
};

Wombat.prototype.initRegisterPHOverride = function() {
  if (!this.$wbwindow.navigator.registerProtocolHandler) return;
  var orig_registerPH = this.$wbwindow.navigator.registerProtocolHandler;
  var wombat = this;
  this.$wbwindow.navigator.registerProtocolHandler = function registerProtocolHandler(
    protocol,
    uri,
    title
  ) {
    return orig_registerPH.call(this, protocol, wombat.rewriteUrl(uri), title);
  };
};

Wombat.prototype.initBeaconOverride = function() {
  if (!this.$wbwindow.navigator.sendBeacon) {
    return;
  }

  var orig_sendBeacon = this.$wbwindow.navigator.sendBeacon;
  var wombat = this;
  this.$wbwindow.navigator.sendBeacon = function sendBeacon(url, data) {
    return orig_sendBeacon.call(this, wombat.rewriteUrl(url), data);
  };
};

Wombat.prototype.initDisableNotifications = function() {
  if (window.Notification) {
    window.Notification.requestPermission = function requestPermission(
      callback
    ) {
      if (callback) {
        // eslint-disable-next-line standard/no-callback-literal
        callback('denied');
      }

      return Promise.resolve('denied');
    };
  }

  var applyOverride = function(on) {
    if (!on) return;
    if (on.getCurrentPosition) {
      on.getCurrentPosition = function getCurrentPosition(
        success,
        error,
        options
      ) {
        if (error) {
          error({ code: 2, message: 'not available' });
        }
      };
    }
    if (on.watchPosition) {
      on.watchPosition = function watchPosition(success, error, options) {
        if (error) {
          error({ code: 2, message: 'not available' });
        }
      };
    }
  };
  if (window.geolocation) {
    applyOverride(window.geolocation);
  }
  if (window.navigator.geolocation) {
    applyOverride(window.navigator.geolocation);
  }
};

Wombat.prototype.initStorageOverride = function() {
  this.addEventOverride('storageArea', this.$wbwindow.StorageEvent.prototype);

  var local = new Storage(this);
  var session = new Storage(this);

  if (this.$wbwindow.Proxy) {
    var wombat = this;

    var wrapProxy = function wrapProxy(obj) {
      return new wombat.$wbwindow.Proxy(obj, {
        get: function(target, prop) {
          if (prop in target) {
            return target[prop];
          }

          return target.getItem(prop);
        },

        set: function(target, prop, value) {
          if (target.hasOwnProperty(prop)) {
            return false;
          }
          target.setItem(prop, value);
          return true;
        },

        getOwnPropertyDescriptor: function(target, prop) {
          return Object.getOwnPropertyDescriptor(target, prop);
        }
      });
    };

    local = wrapProxy(local);
    session = wrapProxy(session);
  }

  this.defProp(this.$wbwindow, 'localStorage', undefined, function() {
    return local;
  });
  this.defProp(this.$wbwindow, 'sessionStorage', undefined, function() {
    return session;
  });
};

Wombat.prototype.initWindowObjProxy = function($wbwindow) {
  if (!$wbwindow.Proxy) return undefined;

  var ownProps = this.getAllOwnProps($wbwindow);
  var wombat = this;
  $wbwindow._WB_wombat_obj_proxy = new $wbwindow.Proxy(
    {},
    {
      get: function(target, prop) {
        if (prop === 'top') {
          return wombat.$wbwindow.WB_wombat_top._WB_wombat_obj_proxy;
        }
        return wombat.defaultProxyGet($wbwindow, prop, ownProps);
      },
      set: function(target, prop, value) {
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
      has: function(target, prop) {
        return prop in $wbwindow;
      },
      ownKeys: function(target) {
        return Object.getOwnPropertyNames($wbwindow).concat(
          Object.getOwnPropertySymbols($wbwindow)
        );
      },
      getOwnPropertyDescriptor: function(target, key) {
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
      getPrototypeOf: function(target) {
        return Object.getPrototypeOf($wbwindow);
      },
      setPrototypeOf: function(target, newProto) {
        return false;
      },
      isExtensible: function(target) {
        return Object.isExtensible($wbwindow);
      },
      preventExtensions: function(target) {
        Object.preventExtensions($wbwindow);
        return true;
      },
      deleteProperty: function(target, prop) {
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
      defineProperty: function(target, prop, desc) {
        var ndesc = desc || {};
        if (!ndesc.value && !ndesc.get) {
          ndesc.value = $wbwindow[prop];
        }
        Reflect.defineProperty($wbwindow, prop, ndesc);
        return Reflect.defineProperty(target, prop, ndesc);
      }
    }
  );

  return $wbwindow._WB_wombat_obj_proxy;
};

Wombat.prototype.initDocumentObjProxy = function($document) {
  this.initDocOverrides($document);
  if (!this.$wbwindow.Proxy) return undefined;
  var ownProps = this.getAllOwnProps($document);
  var wombat = this;
  $document._WB_wombat_obj_proxy = new this.$wbwindow.Proxy($document, {
    get: function(target, prop) {
      return wombat.defaultProxyGet($document, prop, ownProps);
    },
    set: function(target, prop, value) {
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

Wombat.prototype.initTopFrameNotify = function(wbinfo) {
  var wombat = this;

  var notify_top = function notify_top(event) {
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

    if (
      wombat.$wbwindow.document.readyState === 'complete' &&
      wombat.wbUseAFWorker
    ) {
      wombat.WBAutoFetchWorker.extractFromLocalDoc();
    }

    if (wombat.$wbwindow !== wombat.$wbwindow.__WB_replay_top) {
      return;
    }

    var icons = [];

    var hicons = wombat.$wbwindow.document.querySelectorAll(
      "link[rel*='icon']"
    );
    for (var i = 0; i < hicons.length; i++) {
      var hicon = hicons[i];
      icons.push({
        rel: hicon.rel,
        href: wombat.wb_getAttribute.call(hicon, 'href')
      });
    }

    var message = {
      icons: icons,
      url: wombat.$wbwindow.WB_wombat_location.href,
      ts: wombat.wb_info.timestamp,
      request_ts: wombat.wb_info.request_ts,
      is_live: wombat.wb_info.is_live,
      title: wombat.$wbwindow.document ? wombat.$wbwindow.document.title : '',
      readyState: wombat.$wbwindow.document.readyState,
      wb_type: 'load'
    };

    wombat.sendTopMessage(message);
  };

  if (this.$wbwindow.document.readyState === 'complete') {
    notify_top();
  } else if (this.$wbwindow.addEventListener) {
    this.$wbwindow.document.addEventListener('readystatechange', notify_top);
  } else if (this.$wbwindow.attachEvent) {
    this.$wbwindow.document.attachEvent('onreadystatechange', notify_top);
  }
};

Wombat.prototype.initTopFrame = function($wbwindow) {
  // proxy mode
  if (this.wb_is_proxy) {
    $wbwindow.__WB_replay_top = $wbwindow.top;
    $wbwindow.__WB_top_frame = undefined;
    return;
  }

  var next_parent = function(win) {
    try {
      if (!win) return false;
      // if no wbinfo, see if _wb_wombat was set (eg. if about:blank page)
      if (!win.wbinfo) {
        return win._wb_wombat != null;
      } else {
        // otherwise, ensure that it is not a top container frame
        return win.wbinfo.is_framed;
      }
    } catch (e) {
      return false;
    }
  };

  var replay_top = $wbwindow;
  while (replay_top.parent !== replay_top && next_parent(replay_top.parent)) {
    replay_top = replay_top.parent;
  }

  $wbwindow.__WB_replay_top = replay_top;

  var real_parent = replay_top.__WB_orig_parent || replay_top.parent;
  // Check to ensure top frame is different window and directly accessible (later refactor to support postMessage)
  if (real_parent === $wbwindow || !this.wb_info.is_framed) {
    real_parent = undefined;
  }

  if (real_parent) {
    $wbwindow.__WB_top_frame = real_parent;
    this.initFrameElementOverride($wbwindow);
  } else {
    $wbwindow.__WB_top_frame = undefined;
  }

  // Fix .parent only if not embeddable, otherwise leave for accessing embedding window
  if (!this.wb_opts.embedded && replay_top === $wbwindow) {
    if (this.wbUseAFWorker) {
      var wombat = this;
      this.$wbwindow.addEventListener(
        'message',
        function(event) {
          if (event.data && event.data.wb_type === 'aaworker') {
            wombat.WBAutoFetchWorker.postMessage(event.data.msg);
          }
        },
        false
      );
    }
    $wbwindow.__WB_orig_parent = $wbwindow.parent;
    $wbwindow.parent = replay_top;
  }
};

Wombat.prototype.initFrameElementOverride = function($wbwindow) {
  if (!Object.defineProperty) return;
  // Also try disabling frameElement directly, though may no longer be supported in all browsers
  if (
    this.proxyToObj($wbwindow.__WB_replay_top) === this.proxyToObj($wbwindow)
  ) {
    try {
      Object.defineProperty($wbwindow, 'frameElement', {
        value: null,
        configurable: false
      });
    } catch (e) {}
  }
};

Wombat.prototype.initWombatTop = function($wbwindow) {
  if (!Object.defineProperty) return;

  // from http://stackoverflow.com/a/6229603
  var isWindow = function isWindow(obj) {
    if (typeof window.constructor === 'undefined') {
      return obj instanceof window.constructor;
    } else {
      return obj.window === obj;
    }
  };

  var getter = function top() {
    if (this.__WB_replay_top) {
      return this.__WB_replay_top;
    } else if (isWindow(this)) {
      return this;
    } else {
      return this.top;
    }
  };

  var setter = function top(val) {
    this.top = val;
  };

  this.defProp($wbwindow.Object.prototype, 'WB_wombat_top', setter, getter);
};

Wombat.prototype.wombatInit = function() {
  // _wombat init
  this.initTopFrame(this.$wbwindow);
  this.initWombatLoc(this.$wbwindow);
  this.initWombatTop(this.$wbwindow);

  // updated wb_unrewrite_rx for imgur.com
  var wb_origin = this.$wbwindow.__WB_replay_top.location.origin;
  var wb_host = this.$wbwindow.__WB_replay_top.location.host;
  var wb_proto = this.$wbwindow.__WB_replay_top.location.protocol;
  if (this.wb_replay_prefix && this.wb_replay_prefix.indexOf(wb_origin) === 0) {
    this.wb_rel_prefix = this.wb_replay_prefix.substring(wb_origin.length);
  } else {
    this.wb_rel_prefix = this.wb_replay_prefix;
  }

  // make the protocol and host optional now
  var rx =
    '((' + wb_proto + ')?//' + wb_host + ')?' + this.wb_rel_prefix + '[^/]+/';
  this.wb_unrewrite_rx = new RegExp(rx, 'g');

  // History
  this.initHistoryOverrides();

  // Doc Title
  this.initDocTitleOverride();

  // postMessage
  // OPT skip
  if (!this.wb_opts.skip_postmessage) {
    this.initPostMessageOverride(this.$wbwindow);
    this.initMessageEventOverride(this.$wbwindow);
  }

  this.initHashChange();

  this.initUIEventsOverrides();

  // write
  this.initWriteOverride();

  // eval
  // initEvalOverride();

  // Ajax
  this.initAjaxRewrite();

  // Fetch
  this.initFetchRewrite();
  this.initRequestOverride();

  // Audio
  this.initAudioOverride();

  // FontFace
  this.initFontFaceOverride(this.$wbwindow);

  // Worker override (experimental)
  this.initAutoFetchWorker();
  this.initWebWorkerOverride();
  this.initServiceWorkerOverride();
  this.initSharedWorkerOverride();
  this.initWorkletOverride();

  // text node overrides for js frameworks doing funky things with CSS
  this.initTextNodeOverrides();
  this.initCSSOMOverrides();

  // innerHTML can be overriden on prototype!
  this.overrideHtmlAssign(this.$wbwindow.HTMLElement, 'innerHTML', true);
  this.overrideHtmlAssign(this.$wbwindow.HTMLElement, 'outerHTML', true);
  this.overrideHtmlAssign(this.$wbwindow.HTMLIFrameElement, 'srcdoc', true);
  this.overrideHtmlAssign(this.$wbwindow.HTMLStyleElement, 'textContent');

  // Document.URL override
  this.overridePropExtract(this.$wbwindow.Document.prototype, 'URL');
  this.overridePropExtract(this.$wbwindow.Document.prototype, 'documentURI');

  // Node.baseURI override
  this.overridePropExtract(this.$wbwindow.Node.prototype, 'baseURI');

  // Attr nodeValue and value
  this.overrideAttrProps();

  // init insertAdjacentHTML() override
  this.initInsertAdjacentHTMLOverride();
  this.initInsertAdjacentElementOverride();

  // iframe.contentWindow and iframe.contentDocument overrides to
  // ensure _wombat is inited on the iframe $wbwindow!
  this.overrideIframeContentAccess('contentWindow');
  this.overrideIframeContentAccess('contentDocument');

  // override funcs to convert first arg proxy->obj
  this.overrideFuncArgProxyToObj(this.$wbwindow.MutationObserver, 'observe');
  this.overrideFuncArgProxyToObj(
    this.$wbwindow.Node,
    'compareDocumentPosition'
  );
  this.overrideFuncArgProxyToObj(this.$wbwindow.Node, 'contains');
  this.overrideFuncArgProxyToObj(this.$wbwindow.Document, 'createTreeWalker');
  this.overrideFuncArgProxyToObj(this.$wbwindow.Document, 'evaluate', 1);
  this.overrideFuncArgProxyToObj(this.$wbwindow.Document, 'createTouch', 1);
  this.overrideFuncArgProxyToObj(
    this.$wbwindow.XSLTProcessor,
    'transformToFragment',
    1
  );

  this.overrideFuncThisProxyToObj(
    this.$wbwindow,
    'getComputedStyle',
    this.$wbwindow
  );

  this.overrideApplyFunc(this.$wbwindow);
  this.initTimeoutIntervalOverrides('setTimeout');
  this.initTimeoutIntervalOverrides('setInterval');

  this.overrideFramesAccess(this.$wbwindow);

  // setAttribute
  if (!this.wb_opts.skip_setAttribute) {
    this.initSetAttributeOverride();
    this.initGetAttributeOverride();
  }
  this.initSvgImageOverrides();

  // override href and src attrs
  this.initAttrOverrides();

  // Cookies
  this.initCookiesOverride();

  // ensure namespace urls are NOT rewritten
  this.initCreateElementNSFix();

  // DOM
  // OPT skip
  if (!this.wb_opts.skip_dom) {
    this.initDomOverride();
  }

  // registerProtocolHandler override
  this.initRegisterPHOverride();

  // sendBeacon override
  this.initBeaconOverride();

  // other overrides
  // proxy mode: only using these overrides

  // Random
  this.initSeededRandom(this.wb_info.wombat_sec);

  // Crypto Random
  this.initCryptoRandom();

  // set fixed pixel ratio
  this.initFixedRatio();

  // Date
  this.initDateOverride(this.wb_info.wombat_sec);

  // open
  this.initOpenOverride();

  // disable notifications
  this.initDisableNotifications();

  // custom storage
  this.initStorageOverride();

  // add window and document obj proxies, if available
  this.initWindowObjProxy(this.$wbwindow);
  this.initDocumentObjProxy(this.$wbwindow.document);

  if (this.wb_info.is_framed && this.wb_info.mod !== 'bn_') {
    this.initTopFrameNotify(this.wb_info);
  }

  var wombat = this;
  return {
    actual: false,
    extract_orig: function(href) {
      return wombat.extractOriginalURL(href);
    },
    rewrite_url: function(url, use_rel, mod) {
      return wombat.rewriteUrl(url, use_rel, mod);
    },
    watch_elem: function(elem, func) {
      return wombat.watchElem(elem, func);
    },
    init_new_window_wombat: function(win, src) {
      return wombat.initNewWindowWombat(win, src);
    },
    init_paths: function(wbinfo) {
      wombat.initPaths(wbinfo);
    },
    local_init: function(name) {
      var res = wombat.$wbwindow._WB_wombat_obj_proxy[name];
      if (name === 'document' && res && !res._WB_wombat_obj_proxy) {
        return wombat.initDocumentObjProxy(res) || res;
      }
      return res;
    }
  };
};

export default Wombat;
