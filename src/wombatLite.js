/* eslint-disable camelcase */
import AutoFetcherProxyMode from './autoFetcherProxyMode';

/**
 * Wombat lite for proxy-mode
 * @param {Window} $wbwindow
 * @param {Object} wbinfo
 */
export default function WombatLite($wbwindow, wbinfo) {
  if (!(this instanceof WombatLite)) return new WombatLite($wbwindow, wbinfo);
  this.wb_info = wbinfo;
  this.$wbwindow = $wbwindow;
  this.wb_info.top_host = this.wb_info.top_host || '*';
  this.wb_info.wombat_opts = this.wb_info.wombat_opts || {};
  this.WBAutoFetchWorker = null;
  this.historyCB = null;
}

/**
 * Applies an override to Math.seed and Math.random using the supplied
 * seed in order to ensure that random numbers are deterministic during
 * replay
 * @param {string} seed
 */
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

/**
 * Applies an override to crypto.getRandomValues in order to make
 * the values it returns are deterministic during replay
 */
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

/**
 * Forces, when possible, the devicePixelRatio property of window to 1
 * in order to ensure deterministic replay
 */
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

/**
 * Applies an override to the Date object in order to ensure that
 * all Dates used during replay are in the datetime of replay
 * @param {string} timestamp
 */
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

  this.$wbwindow.Date.prototype.getTimezoneOffset = function() {
    return 0;
  }

  var orig_toString = this.$wbwindow.Date.prototype.toString;
  this.$wbwindow.Date.prototype.toString = function() {
    var string = orig_toString.call(this).split(" GMT")[0];
    return string + " GMT+0000 (Coordinated Universal Time)";
  }

  var orig_toTimeString = this.$wbwindow.Date.prototype.toTimeString;
  this.$wbwindow.Date.prototype.toTimeString = function() {
    var string = orig_toTimeString.call(this).split(" GMT")[0];
    return string + " GMT+0000 (Coordinated Universal Time)";
  }

  Object.defineProperty(this.$wbwindow.Date.prototype, 'constructor', {
    value: this.$wbwindow.Date
  });
};

/**
 * Applies an override that disables the pages ability to send OS native
 * notifications. Also disables the ability of the replayed page to retrieve the geolocation
 * of the view.
 *
 * This is done in order to ensure that no malicious abuse of these functions
 * can happen during replay.
 */
WombatLite.prototype.initDisableNotifications = function() {
  if (window.Notification) {
    window.Notification.requestPermission = function requestPermission(
      callback
    ) {
      if (callback) {
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

/**
 * Initializes and starts the auto-fetch worker IFF wbUseAFWorker is true
 */
WombatLite.prototype.initAutoFetchWorker = function() {
  if (!this.$wbwindow.Worker) {
    return;
  }
  var config = {
    isTop: this.$wbwindow.self === this.$wbwindow.top,
    workerURL:
      (this.wb_info.auto_fetch_worker_prefix || this.wb_info.static_prefix) +
      'autoFetchWorker.js'
  };
  if (this.$wbwindow.$WBAutoFetchWorker$ == null) {
    this.WBAutoFetchWorker = new AutoFetcherProxyMode(this, config);
    // expose the WBAutoFetchWorker
    Object.defineProperty(this.$wbwindow, '$WBAutoFetchWorker$', {
      enumerable: false,
      value: this.WBAutoFetchWorker
    });
  } else {
    this.WBAutoFetchWorker = this.$wbwindow.$WBAutoFetchWorker$;
  }
  if (config.isTop) {
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

WombatLite.prototype.initHistoryOverrides = function() {
  if (this.$wbwindow.self !== this.$wbwindow.top) {
    return;
  }

  this.overrideHistoryFunc('pushState');
  this.overrideHistoryFunc('replaceState');
  var wombatLite = this;
  this.$wbwindow.addEventListener('popstate', function(event) {
    if (wombatLite.historyCB) {
      wombatLite.historyCB(
        wombatLite.$wbwindow.location.href,
        wombatLite.$wbwindow.document.title,
        'popstate',
        event.state
      );
    }
  });
};

WombatLite.prototype.overrideHistoryFunc = function(funcName) {
  if (!this.$wbwindow.history) return undefined;
  var orig_func = this.$wbwindow.history[funcName];
  if (!orig_func) return undefined;

  this.$wbwindow.history['_orig_' + funcName] = orig_func;
  var wombat = this;

  var rewrittenFunc = function histNewFunc(stateObj, title, url) {
    orig_func.call(this, stateObj, title, url);

    if (!url) {
      return;
    }

    var origTitle = wombat.$wbwindow.document.title;

    if (wombat.WBAutoFetchWorker) {
      wombat.$wbwindow.setTimeout(function() {
        if (!title && wombat.$wbwindow.document.title !== origTitle) {
          title = wombat.$wbwindow.document.title;
        }

        wombat.WBAutoFetchWorker.fetchAsPage(
          wombat.$wbwindow.location.href,
          title
        );
      }, 100);

      if (wombat.historyCB) {
        wombat.historyCB(
          wombat.$wbwindow.location.href,
          title,
          funcName,
          stateObj
        );
      }
    }
  };

  this.$wbwindow.history[funcName] = rewrittenFunc;
  if (this.$wbwindow.History && this.$wbwindow.History.prototype) {
    this.$wbwindow.History.prototype[funcName] = rewrittenFunc;
  }

  return rewrittenFunc;
};

/**
 * Initialize wombat's internal state and apply all overrides
 * @return {Object}
 */
WombatLite.prototype.wombatInit = function() {
  if (this.wb_info.enable_auto_fetch && this.wb_info.is_live) {
    this.initAutoFetchWorker();
  }

  // history callback overrides
  this.initHistoryOverrides();

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
  var wombatLite = this;
  return {
    actual: false,
    setHistoryCB: function(cb) {
      wombatLite.historyCB = cb;
    }
  };
};
