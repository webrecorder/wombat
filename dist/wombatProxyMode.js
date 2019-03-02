(function () {
  

  /* eslint-disable camelcase */

  /**
   *
   * @param {Wombat} wombat
   * @param isTop
   */
  function AutoFetchWorkerProxyMode(wombat, isTop) {
    if (!(this instanceof AutoFetchWorkerProxyMode)) {
      return new AutoFetchWorkerProxyMode(wombat);
    }
    this.wombat = wombat;
    this.checkIntervalTime = 15000;
    this.checkIntervalCB = this.checkIntervalCB.bind(this);
    this.checkInterval = null;
    // specifically target the elements we desire
    this.elemSelector =
      'img[srcset], img[data-srcset], img[data-src], video[srcset], video[data-srcset], video[data-src], audio[srcset], audio[data-srcset], audio[data-src], ' +
      'picture > source[srcset], picture > source[data-srcset], picture > source[data-src], ' +
      'video > source[srcset], video > source[data-srcset], video > source[data-src], ' +
      'audio > source[srcset], audio > source[data-srcset], audio > source[data-src]';
    this.styleTag = document.createElement('style');
    this.styleTag.id = '$wrStyleParser$';
    document.documentElement.appendChild(this.styleTag);
    if (isTop) {
      var afwpm = this;
      // Cannot directly load our worker from the proxy origin into the current origin
      // however we fetch it from proxy origin and can blob it into the current origin :)
      fetch(this.wombat.wbAutoFetchWorkerPrefix).then(function(res) {
        return res.text().then(function(text) {
          var blob = new Blob([text], { type: 'text/javascript' });
          afwpm.worker = new afwpm.wombat.$wbwindow.Worker(
            URL.createObjectURL(blob)
          );
          afwpm.startCheckingInterval();
        });
      });
    } else {
      // add only the portions of the worker interface we use since we are not top and if in proxy mode start check polling
      this.worker = {
        postMessage: function(msg) {
          if (!msg.wb_type) {
            msg = { wb_type: 'aaworker', msg: msg };
          }
          afwpm.wombat.$wbwindow.top.postMessage(msg, '*');
        },
        terminate: function() {}
      };
      this.startCheckingInterval();
    }
  }

  AutoFetchWorkerProxyMode.prototype.resumeCheckInterval = function() {
    // if the checkInterval is null (it is not active) restart the check interval
    if (this.checkInterval == null) {
      this.checkInterval = setInterval(
        this.checkIntervalCB,
        this.checkIntervalTime
      );
    }
  };

  AutoFetchWorkerProxyMode.prototype.pauseCheckInterval = function() {
    // if the checkInterval is not null (it is active) clear the check interval
    if (this.checkInterval != null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  };

  AutoFetchWorkerProxyMode.prototype.startCheckingInterval = function() {
    // if document ready state is complete do first extraction and start check polling
    // otherwise wait for document ready state to complete to extract and start check polling
    var afwpm = this;
    if (this.wombat.$wbwindow.document.readyState === 'complete') {
      this.extractFromLocalDoc();
      this.checkInterval = setInterval(
        this.checkIntervalCB,
        this.checkIntervalTime
      );
    } else {
      var i = setInterval(function() {
        if (afwpm.wombat.$wbwindow.document.readyState === 'complete') {
          afwpm.extractFromLocalDoc();
          clearInterval(i);
          afwpm.checkInterval = setInterval(
            afwpm.checkIntervalCB,
            afwpm.checkIntervalTime
          );
        }
      }, 1000);
    }
  };

  AutoFetchWorkerProxyMode.prototype.checkIntervalCB = function() {
    this.extractFromLocalDoc();
  };

  AutoFetchWorkerProxyMode.prototype.terminate = function() {
    // terminate the worker, a no op when not replay top
    this.worker.terminate();
  };

  AutoFetchWorkerProxyMode.prototype.justFetch = function(urls) {
    this.worker.postMessage({ type: 'fetch-all', values: urls });
  };

  AutoFetchWorkerProxyMode.prototype.postMessage = function(msg) {
    this.worker.postMessage(msg);
  };

  AutoFetchWorkerProxyMode.prototype.shouldSkipSheet = function(sheet) {
    // we skip extracting rules from sheets if they are from our parsing style or come from pywb
    if (sheet.id === '$wrStyleParser$') return true;
    return !!(sheet.href && sheet.href.indexOf(wb_info.proxy_magic) !== -1);
  };

  AutoFetchWorkerProxyMode.prototype.validateSrcV = function(srcV) {
    // returns null if the supplied value is not usable for resolving rel URLs
    // otherwise returns the supplied value
    if (!srcV || srcV.indexOf('data:') === 0 || srcV.indexOf('blob:') === 0) {
      return null;
    }
    return srcV;
  };

  AutoFetchWorkerProxyMode.prototype.fetchCSSAndExtract = function(cssURL) {
    // because this JS in proxy mode operates as it would on the live web
    // the rules of CORS apply and we cannot rely on URLs being rewritten correctly
    // fetch the cross origin css file and then parse it using a style tag to get the rules
    var url =
      location.protocol +
      '//' +
      this.wombat.wb_info.proxy_magic +
      '/proxy-fetch/' +
      cssURL;
    var afwpm = this;
    return fetch(url)
      .then(function(res) {
        return res.text().then(function(text) {
          afwpm.styleTag.textContent = text;
          return afwpm.extractMediaRules(afwpm.styleTag.sheet, cssURL);
        });
      })
      .catch(function(error) {
        return [];
      });
  };

  AutoFetchWorkerProxyMode.prototype.extractMediaRules = function(
    sheet,
    baseURI
  ) {
    // We are in proxy mode and must include a URL to resolve relative URLs in media rules
    var results = [];
    if (!sheet) return results;
    var rules = sheet.cssRules || sheet.rules;
    if (!rules || rules.length === 0) return results;
    var len = rules.length;
    var resolve = sheet.href || baseURI;
    for (var i = 0; i < len; ++i) {
      var rule = rules[i];
      if (rule.type === CSSRule.MEDIA_RULE) {
        results.push({ cssText: rule.cssText, resolve: resolve });
      }
    }
    return results;
  };

  AutoFetchWorkerProxyMode.prototype.extractSrcSrcsetFrom = function(
    fromElem,
    baseURI
  ) {
    // retrieve the auto-fetched elements from the supplied dom node
    var elems = fromElem.querySelectorAll(this.elemSelector);
    var len = elems.length;
    var msg = { type: 'values', srcset: [], src: [] };
    for (var i = 0; i < len; i++) {
      var elem = elems[i];
      // we want the original src value in order to resolve URLs in the worker when needed
      var srcv = this.validateSrcV(elem.src);
      var resolve = srcv || baseURI;
      // get the correct mod in order to inform the backing worker where the URL(s) are from
      var mod =
        elem.tagName === 'SOURCE'
          ? elem.parentElement.tagName === 'PICTURE'
            ? 'im_'
            : 'oe_'
          : elem.tagName === 'IMG'
          ? 'im_'
          : 'oe_';
      if (elem.srcset) {
        msg.srcset.push({ srcset: elem.srcset, resolve: resolve, mod: mod });
      }
      if (elem.dataset.srcset) {
        msg.srcset.push({
          srcset: elem.dataset.srcset,
          resolve: resolve,
          mod: mod
        });
      }
      if (elem.dataset.src) {
        msg.src.push({ src: elem.dataset.src, resolve: resolve, mod: mod });
      }
      if (elem.tagName === 'SOURCE' && srcv) {
        msg.src.push({ src: srcv, resolve: baseURI, mod: mod });
      }
    }
    // send what we have extracted, if anything, to the worker for processing
    if (msg.srcset.length || msg.src.length) {
      this.postMessage(msg);
    }
  };

  AutoFetchWorkerProxyMode.prototype.checkStyleSheets = function(doc) {
    var media = [];
    var deferredMediaExtraction = [];
    var styleSheets = doc.styleSheets;
    var sheetLen = styleSheets.length;

    for (var i = 0; i < sheetLen; i++) {
      var sheet = styleSheets[i];
      // if the sheet belongs to our parser node we must skip it
      if (!this.shouldSkipSheet(sheet)) {
        try {
          // if no error is thrown due to cross origin sheet the urls then just add
          // the resolved URLS if any to the media urls array
          if (sheet.cssRules || sheet.rules) {
            var extracted = this.extractMediaRules(sheet, doc.baseURI);
            if (extracted.length) {
              media = media.concat(extracted);
            }
          } else if (sheet.href != null) {
            // depending on the browser cross origin stylesheets will have their
            // cssRules property null but href non-null
            deferredMediaExtraction.push(this.fetchCSSAndExtract(sheet.href));
          }
        } catch (error) {
          // the stylesheet is cross origin and we must re-fetch via PYWB to get the contents for checking
          if (sheet.href != null) {
            deferredMediaExtraction.push(this.fetchCSSAndExtract(sheet.href));
          }
        }
      }
    }

    if (media.length) {
      // send
      this.postMessage({ type: 'values', media: media });
    }

    if (deferredMediaExtraction.length) {
      // wait for all our deferred fetching and extraction of cross origin
      // stylesheets to complete and then send those values, if any, to the worker
      var afwpm = this;
      Promise.all(deferredMediaExtraction).then(function(results) {
        if (results.length === 0) return;
        var len = results.length;
        var media = [];
        for (var i = 0; i < len; ++i) {
          media = media.concat(results[i]);
        }
        afwpm.postMessage({ type: 'values', media: media });
      });
    }
  };

  AutoFetchWorkerProxyMode.prototype.extractFromLocalDoc = function() {
    // check for data-[src,srcset] and auto-fetched elems with srcset first
    this.extractSrcSrcsetFrom(this.wombat.$wbwindow.document, this.wombat.$wbwindow.document.baseURI);
    // we must use the window reference passed to us to access this origins stylesheets
    this.checkStyleSheets(this.wombat.$wbwindow.document);
  };

  /* eslint-disable camelcase */

  /**
   * Wombat lite for proxy-mode
   * @param {Window} $wbwindow
   * @param {Object} wbinfo
   */
  function WombatLite($wbwindow, wbinfo) {
    if (!(this instanceof WombatLite)) return new WombatLite($wbwindow, wbinfo);
    this.wb_info = wbinfo;
    this.$wbwindow = $wbwindow;
    this.wb_info.top_host = this.wb_info.top_host || '*';
    this.wb_info.wombat_opts = this.wb_info.wombat_opts || {};
    this.wbAutoFetchWorkerPrefix =
      (this.wb_info.auto_fetch_worker_prefix || this.wb_info.static_prefix) +
      'autoFetchWorkerProxyMode.js';
    this.WBAutoFetchWorker = null;
  }

  WombatLite.prototype.initSeededRandom = function(seed) {
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

  WombatLite.prototype.initCryptoRandom = function() {
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

  WombatLite.prototype.initFixedRatio = function() {
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

  WombatLite.prototype.initDateOverride = function(timestamp) {
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

  WombatLite.prototype.initDisableNotifications = function() {
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

    if (window.geolocation) {
      var disabled = function disabled(success, error, options) {
        if (error) {
          error({ code: 2, message: 'not available' });
        }
      };

      window.geolocation.getCurrentPosition = disabled;
      window.geolocation.watchPosition = disabled;
    }
  };

  WombatLite.prototype.initAutoFetchWorker = function() {
    if (!this.$wbwindow.Worker) {
      return;
    }
    var isTop = this.$wbwindow.self === this.$wbwindow.top;
    if (this.$wbwindow.$WBAutoFetchWorker$ == null) {
      this.WBAutoFetchWorker = new AutoFetchWorkerProxyMode(this, isTop);
      // expose the WBAutoFetchWorker
      Object.defineProperty(this.$wbwindow, '$WBAutoFetchWorker$', {
        enumerable: false,
        value: this.WBAutoFetchWorker
      });
    } else {
      this.WBAutoFetchWorker = this.$wbwindow.$WBAutoFetchWorker$;
    }
    if (isTop) {
      var wombatLite = this;
      this.$wbwindow.addEventListener(
        'message',
        function(event) {
          if (event.data && event.data.wb_type === 'aaworker') {
            wombatLite.WBAutoFetchWorker.postMessage(event.data.msg);
          }
        },
        false
      );
    }
  };

  WombatLite.prototype.wombat_init = function() {
    if (this.wb_info.enable_auto_fetch && this.wb_info.is_live) {
      this.initAutoFetchWorker();
    }
    // proxy mode overrides
    // Random
    this.initSeededRandom(this.wb_info.wombat_sec);

    // Crypto Random
    this.initCryptoRandom();

    // set fixed pixel ratio
    this.initFixedRatio();

    // Date
    this.initDateOverride(this.wb_info.wombat_sec);

    // disable notifications
    this.initDisableNotifications();
    return { actual: false };
  };

  window._WBWombat = WombatLite;
  window._WBWombatInit = function(wbinfo) {
    if (!this._wb_wombat || !this._wb_wombat.actual) {
      var wombat = new WombatLite(this, wbinfo);
      wombat.actual = true;
      this._wb_wombat = wombat.wombat_init();
      this._wb_wombat.actual = true;
    } else if (!this._wb_wombat) {
      console.warn('_wb_wombat missing!');
    }
  };

}());
