/* eslint-disable camelcase */
import AutoFetchWorkerProxyMode from './autoFetchWorkerProxyMode';

// Wombat lite for proxy-mode
export default function WombatLite ($wbwindow, wbinfo) {
  if (!(this instanceof WombatLite)) return new WombatLite($wbwindow, wbinfo);
  this.wb_info = wbinfo;
  this.$wbwindow = $wbwindow;
  this.wb_info.top_host = this.wb_info.top_host || '*';
  this.wb_info.wombat_opts = this.wb_info.wombat_opts || {};
  this.wbAutoFetchWorkerPrefix = (this.wb_info.auto_fetch_worker_prefix || this.wb_info.static_prefix) + 'autoFetchWorkerProxyMode.js';
  this.WBAutoFetchWorker = null;
}

WombatLite.prototype.init_seeded_random = function (seed) {
  // Adapted from:
  // http://indiegamr.com/generate-repeatable-random-numbers-in-js/

  this.$wbwindow.Math.seed = parseInt(seed);
  var wombat = this;

  this.$wbwindow.Math.random = function seeded_random () {
    wombat.$wbwindow.Math.seed =
      (wombat.$wbwindow.Math.seed * 9301 + 49297) % 233280;
    return wombat.$wbwindow.Math.seed / 233280;
  };
};

WombatLite.prototype.init_crypto_random = function () {
  if (!this.$wbwindow.crypto || !this.$wbwindow.Crypto) {
    return;
  }

  // var orig_getrandom = this.$wbwindow.Crypto.prototype.getRandomValues
  var wombat = this;
  var new_getrandom = function new_getrandom (array) {
    for (var i = 0; i < array.length; i++) {
      array[i] = parseInt(wombat.$wbwindow.Math.random() * 4294967296);
    }
    return array;
  };

  this.$wbwindow.Crypto.prototype.getRandomValues = new_getrandom;
  this.$wbwindow.crypto.getRandomValues = new_getrandom;
};

WombatLite.prototype.init_fixed_ratio = function () {
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

WombatLite.prototype.init_date_override = function (timestamp) {
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

WombatLite.prototype.init_disable_notifications = function () {
  if (window.Notification) {
    window.Notification.requestPermission = function requestPermission (callback) {
      if (callback) {
        // eslint-disable-next-line standard/no-callback-literal
        callback('denied');
      }

      return Promise.resolve('denied');
    };
  }

  if (window.geolocation) {
    var disabled = function disabled (success, error, options) {
      if (error) {
        error({ code: 2, message: 'not available' });
      }
    };

    window.geolocation.getCurrentPosition = disabled;
    window.geolocation.watchPosition = disabled;
  }
};

WombatLite.prototype.initAutoFetchWorker = function () {
  if (!this.$wbwindow.Worker) {
    return;
  }
  var isTop = this.$wbwindow.self === this.$wbwindow.top;
  if (this.$wbwindow.$WBAutoFetchWorker$ == null) {
    this.WBAutoFetchWorker = new AutoFetchWorkerProxyMode(this, isTop);
    // expose the WBAutoFetchWorker
    Object.defineProperty(this.$wbwindow, '$WBAutoFetchWorker$', {
      'enumerable': false,
      'value': this.WBAutoFetchWorker
    });
  } else {
    this.WBAutoFetchWorker = this.$wbwindow.$WBAutoFetchWorker$;
  }
  if (isTop) {
    var wombatLite = this;
    this.$wbwindow.addEventListener('message', function (event) {
      if (event.data && event.data.wb_type === 'aaworker') {
        wombatLite.WBAutoFetchWorker.postMessage(event.data.msg);
      }
    }, false);
  }
};

WombatLite.prototype.wombat_init = function () {
  if (this.wb_info.enable_auto_fetch && this.wb_info.is_live) {
    this.initAutoFetchWorker();
  }
  // proxy mode overrides
  // Random
  this.init_seeded_random(this.wb_info.wombat_sec);

  // Crypto Random
  this.init_crypto_random();

  // set fixed pixel ratio
  this.init_fixed_ratio();

  // Date
  this.init_date_override(this.wb_info.wombat_sec);

  // disable notifications
  this.init_disable_notifications();

  return { actual: false };
};
