/* eslint-disable camelcase */

/**
 * @param {Wombat} wombat
 */
export default function AutoFetchWorker(wombat) {
  if (!(this instanceof AutoFetchWorker)) {
    return new AutoFetchWorker(wombat);
  }
  // specifically target the elements we desire
  this.elemSelector =
    'img[srcset], img[data-srcset], img[data-src], video[srcset], video[data-srcset], video[data-src], audio[srcset], audio[data-srcset], audio[data-src], ' +
    'picture > source[srcset], picture > source[data-srcset], picture > source[data-src], ' +
    'video > source[srcset], video > source[data-srcset], video > source[data-src], ' +
    'audio > source[srcset], audio > source[data-srcset], audio > source[data-src]';

  this.isTop = wombat.$wbwindow === wombat.$wbwindow.__WB_replay_top;

  /** @type {Wombat} */
  this.wombat = wombat;
  /** @type {Window} */
  this.$wbwindow = wombat.$wbwindow;

  if (this.isTop) {
    // we are top and can will own this worker
    // setup URL for the kewl case
    // Normal replay and preservation mode pworker setup, its all one origin so YAY!
    var workerURL =
      (wombat.wb_info.auto_fetch_worker_prefix ||
        wombat.wb_info.static_prefix) +
      'autoFetchWorker.js?init=' +
      encodeURIComponent(
        JSON.stringify({
          mod: wombat.wb_info.mod,
          prefix: wombat.wb_abs_prefix,
          rwRe: wombat.wb_unrewrite_rx
        })
      );
    this.worker = new this.$wbwindow.Worker(workerURL);
  } else {
    // add only the portions of the worker interface we use since we are not top and if in proxy mode start check polling
    this.worker = {
      postMessage: function(msg) {
        if (!msg.wb_type) {
          msg = { wb_type: 'aaworker', msg: msg };
        }
        wombat.$wbwindow.__WB_replay_top.__orig_postMessage(msg, '*');
      },
      terminate: function() {}
    };
  }
}

AutoFetchWorker.prototype.deferredSheetExtraction = function(sheet) {
  var rules = sheet.cssRules || sheet.rules;
  // if no rules this a no op
  if (!rules || rules.length === 0) return;
  var afw = this;
  // defer things until next time the Promise.resolve Qs are cleared
  Promise.resolve().then(function() {
    // loop through each rule of the stylesheet
    var media = [];
    for (var i = 0; i < rules.length; ++i) {
      var rule = rules[i];
      if (rule.type === CSSRule.MEDIA_RULE) {
        // we are a media rule so get its text
        media.push(rule.cssText);
      }
    }
    if (media.length > 0) {
      // we have some media rules to preserve
      afw.preserveMedia(media);
    }
  });
};

AutoFetchWorker.prototype.terminate = function() {
  // terminate the worker, a no op when not replay top
  this.worker.terminate();
};

AutoFetchWorker.prototype.postMessage = function(msg, deferred) {
  if (deferred) {
    var afWorker = this;
    return Promise.resolve().then(function() {
      afWorker.worker.postMessage(msg);
    });
  }
  this.worker.postMessage(msg);
};

/**
 * Sends the supplied srcset value to the backing worker for preservation
 * @param {string|Array<string>} srcset
 * @param {string} [mod]
 */
AutoFetchWorker.prototype.preserveSrcset = function(srcset, mod) {
  // send values from rewriteSrcset to the worker
  this.postMessage(
    {
      type: 'values',
      srcset: { values: srcset, mod: mod, presplit: true }
    },
    true
  );
};

/**
 * Send the value of the supplied elements data-srcset attribute to the
 * backing worker for preservation
 * @param {HTMLElement} elem
 */
AutoFetchWorker.prototype.preserveDataSrcset = function(elem) {
  // send values from rewriteAttr srcset to the worker deferred
  // to ensure the page viewer sees the images first
  this.postMessage(
    {
      type: 'values',
      srcset: {
        value: elem.dataset.srcset,
        mod: this.rwMod(elem),
        presplit: false
      }
    },
    true
  );
};

AutoFetchWorker.prototype.preserveMedia = function(media) {
  // send CSSMediaRule values to the worker
  this.postMessage({ type: 'values', media: media }, true);
};

AutoFetchWorker.prototype.getSrcset = function(elem) {
  if (this.wombat.wb_getAttribute) {
    return this.wombat.wb_getAttribute.call(elem, 'srcset');
  }
  return elem.getAttribute('srcset');
};

AutoFetchWorker.prototype.rwMod = function(elem) {
  return elem.tagName === 'SOURCE'
    ? elem.parentElement.tagName === 'PICTURE'
      ? 'im_'
      : 'oe_'
    : elem.tagName === 'IMG'
    ? 'im_'
    : 'oe_';
};

AutoFetchWorker.prototype.extractFromLocalDoc = function() {
  // get the values to be preserved from the documents stylesheets
  // and all img, video, audio elements with (data-)?srcset or data-src
  var afw = this;
  Promise.resolve().then(function() {
    var msg = {
      type: 'values',
      context: { docBaseURI: afw.$wbwindow.document.baseURI }
    };
    var media = [];
    var i = 0;
    var sheets = afw.$wbwindow.document.styleSheets;
    for (; i < sheets.length; ++i) {
      var rules = sheets[i].cssRules;
      for (var j = 0; j < rules.length; ++j) {
        var rule = rules[j];
        if (rule.type === CSSRule.MEDIA_RULE) {
          media.push(rule.cssText);
        }
      }
    }
    var elems = afw.$wbwindow.document.querySelectorAll(afw.elemSelector);
    var srcset = { values: [], presplit: false };
    var src = { values: [] };
    var elem, srcv, mod;
    for (i = 0; i < elems.length; ++i) {
      elem = elems[i];
      // we want the original src value in order to resolve URLs in the worker when needed
      srcv = elem.src ? elem.src : null;
      // a from value of 1 indicates images and a 2 indicates audio/video
      mod = afw.rwMod(elem);
      if (elem.srcset) {
        srcset.values.push({
          srcset: afw.getSrcset(elem),
          mod: mod,
          tagSrc: srcv
        });
      }
      if (elem.dataset.srcset) {
        srcset.values.push({
          srcset: elem.dataset.srcset,
          mod: mod,
          tagSrc: srcv
        });
      }
      if (elem.dataset.src) {
        src.values.push({ src: elem.dataset.src, mod: mod });
      }
      if (elem.tagName === 'SOURCE' && srcv) {
        src.values.push({ src: srcv, mod: mod });
      }
    }
    if (media.length) {
      msg.media = media;
    }
    if (srcset.values.length) {
      msg.srcset = srcset;
    }
    if (src.values.length) {
      msg.src = src;
    }
    if (msg.media || msg.srcset || msg.src) {
      afw.postMessage(msg);
    }
  });
};
