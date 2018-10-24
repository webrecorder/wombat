/**
 * @param {Wombat} wombat
 */
export default function AutoFetchWorker (wombat) {
  if (!(this instanceof AutoFetchWorker)) {
    return new AutoFetchWorker(wombat);
  }
  this.checkIntervalCB = this.checkIntervalCB.bind(this);
  this.isTop = wombat.$wbwindow === wombat.$wbwindow.__WB_replay_top;
  this.wombat = wombat;
  if (this.isTop) {
    // we are top and can will own this worker
    // setup URL for the kewl case
    // Normal replay and preservation mode pworker setup, its all one origin so YAY!
    var workerURL = wombat.wb_info.static_prefix +
      'autoFetchWorker.js?init=' +
      encodeURIComponent(JSON.stringify({ 'mod': wombat.wb_info.mod, 'prefix': wombat.wb_info.prefix }));
    this.worker = new wombat.$wbwindow.Worker(workerURL);
  } else {
    // add only the portions of the worker interface we use since we are not top and if in proxy mode start check polling
    this.worker = {
      'postMessage': function (msg) {
        if (!msg.wb_type) {
          msg = { 'wb_type': 'aaworker', 'msg': msg };
        }
        wombat.$wbwindow.__WB_replay_top.__orig_postMessage(msg, '*');
      },
      'terminate': function () {}
    };
  }
}

AutoFetchWorker.prototype.checkIntervalCB = function () {
  this.extractFromLocalDoc();
};

AutoFetchWorker.prototype.deferredSheetExtraction = function (sheet) {
  var rules = sheet.cssRules || sheet.rules;
  // if no rules this a no op
  if (!rules || rules.length === 0) return;
  var self = this;
  var extract = function () {
    // loop through each rule of the stylesheet
    var media = [];
    for (var j = 0; j < rules.length; ++j) {
      var rule = rules[j];
      if (rule.type === CSSRule.MEDIA_RULE) {
        // we are a media rule so get its text
        media.push(rule.cssText);
      }
    }
    if (media.length > 0) {
      // we have some media rules to preserve
      self.preserveMedia(media);
    }
  };
  // defer things until next time the Promise.resolve Qs are cleared
  this.wombat.$wbwindow.Promise.resolve().then(extract);
};

AutoFetchWorker.prototype.terminate = function () {
  // terminate the worker, a no op when not replay top
  this.worker.terminate();
};

AutoFetchWorker.prototype.postMessage = function (msg) {
  this.worker.postMessage(msg);
};

AutoFetchWorker.prototype.preserveSrcset = function (srcset) {
  // send values from rewrite_srcset to the worker
  this.postMessage({
    'type': 'values',
    'srcset': { 'values': srcset, 'presplit': true }
  });
};

AutoFetchWorker.prototype.preserveMedia = function (media) {
  // send CSSMediaRule values to the worker
  this.postMessage({ 'type': 'values', 'media': media });
};

AutoFetchWorker.prototype.extractFromLocalDoc = function () {
  // get the values to be preserved from the  documents stylesheets
  // and all elements with a srcset
  var media = [];
  var srcset = [];
  var sheets = this.wombat.$wbwindow.document.styleSheets;
  var i = 0;
  for (; i < sheets.length; ++i) {
    var rules = sheets[i].cssRules;
    for (var j = 0; j < rules.length; ++j) {
      var rule = rules[j];
      if (rule.type === CSSRule.MEDIA_RULE) {
        media.push(rule.cssText);
      }
    }
  }
  var srcsetElems = this.wombat.$wbwindow.document.querySelectorAll('img[srcset]');
  var wb_getAttribute = this.wombat.wb_getAttribute;
  for (i = 0; i < srcsetElems.length; i++) {
    var srcsetElem = srcsetElems[i];
    if (wb_getAttribute) {
      srcset.push(wb_getAttribute.call(srcsetElem, 'srcset'));
    } else {
      srcset.push(srcsetElem.getAttribute('srcset'));
    }
  }
  this.postMessage({
    'type': 'values',
    'media': media,
    'srcset': { 'values': srcset, 'presplit': false }
  });
};
