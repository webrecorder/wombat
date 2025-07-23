/* eslint-disable camelcase */
import FuncMap from './funcMap.js';
import { createStorage, Storage } from './customStorage.js';
import WombatLocation from './wombatLocation.js';
import AutoFetcher from './autoFetcher.js';
import { wrapEventListener, wrapSameOriginEventListener } from './listeners.js';
import {
  addToStringTagToClass,
  autobind,
  ThrowExceptions
} from './wombatUtils.js';

import { postToGetUrl } from 'warcio/utils';

...

/**
 * Adds listeners for `message` and `hashchange` to window of the browser context wombat is in
 * in order to ensure that actual top (archive top frame containing the replay iframe)
 * browser history is updated IFF the history manipulation happens in the replay top
 */
Wombat.prototype.initHashChange = function() {
  if (!this.$wbwindow.__WB_top_frame) return;

  var wombat = this;

  var receive_hash_change = function receive_hash_change(event) {
    // Check the origin of the message
    if (event.origin !== wombat.$wbwindow.location.origin) {
      return;
    }

    if (!event.data || !event.data.from_top) {
      return;
    }

    var message = event.data.message;

    if (!message.wb_type) return;

    if (message.wb_type === 'outer_hashchange') {
      if (wombat.$wbwindow.location.hash != message.hash) {
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

...

/**
 * Rewrites the supplied cookie
 * @param {string} cookie
 * @return {string}
 */
Wombat.prototype.rewriteCookie = function(cookie) {
  var wombat = this;
  var rwCookie = cookie
    .replace(this.wb_abs_prefix, '')
    .replace(this.wb_rel_prefix, '');
  rwCookie = rwCookie
    .replace(this.cookie_domain_regex, function(m, m1) {
      // rewrite domain
      var message = {
        domain: m1,
        cookie: rwCookie,
        wb_type: 'cookie'
      };

      // notify of cookie setting to allow server-side tracking
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
    rwCookie = rwCookie.replace('secure', 'Secure');
  }

  return rwCookie.replace(',|', ',');
};

...

/**
 * Updates the real location object with the results of rewriting the supplied URL
 * @param {?string} reqHref
 * @param {string} origHref
 * @param {Location} actualLocation
 */
Wombat.prototype.updateLocation = function(reqHref, origHref, actualLocation) {
  if (!reqHref || reqHref === origHref) return;

  var ext_orig = this.extractOriginalURL(origHref);
  var ext_req = this.extractOriginalURL(reqHref);

  if (!ext_orig || ext_orig === ext_req) return;

  var final_href = this.rewriteUrl(reqHref);

  console.log(actualLocation.href + ' -> ' + final_href);

  if (this.isValidRedirect(final_href)) {
    actualLocation.href = final_href;
  }
};

/**
 * Validates the redirect URL to prevent open redirect vulnerabilities
 * @param {string} url
 * @return {boolean}
 */
Wombat.prototype.isValidRedirect = function(url) {
  // Implement validation logic here
  // For example, check if the URL is within the same domain
  return url.startsWith(this.wb_orig_origin);
};

...

export default Wombat;