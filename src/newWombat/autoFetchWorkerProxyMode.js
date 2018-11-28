/* eslint-disable camelcase */

export default function AutoFetchWorkerProxyMode (wombat, isTop) {
  if (!(this instanceof AutoFetchWorkerProxyMode)) {
    return new AutoFetchWorkerProxyMode(wombat);
  }
  this.wombat = wombat;
  this.checkIntervalTime = 15000;
  this.checkIntervalCB = this.checkIntervalCB.bind(this);
  this.checkInterval = null;
  var afwpm = this;
  if (isTop) {
    // Cannot directly load our worker from the proxy origin into the current origin
    // however we fetch it from proxy origin and can blob it into the current origin :)
    fetch(wombat.wbAutoFetchWorkerPrefix)
      .then(function (res) {
        return res.text().then(function (text) {
          var blob = new Blob([text], { 'type': 'text/javascript' });
          afwpm.worker = new afwpm.wombat.$wbwindow.Worker(URL.createObjectURL(blob));
          // use our origins reference to the document in order for us to parse stylesheets :/
          afwpm.styleTag = document.createElement('style');
          afwpm.styleTag.id = '$wrStyleParser$';
          document.documentElement.appendChild(afwpm.styleTag);
          afwpm.startCheckingInterval();
        });
      });
  } else {
    // add only the portions of the worker interface we use since we are not top and if in proxy mode start check polling
    this.worker = {
      'postMessage': function (msg) {
        if (!msg.wb_type) {
          msg = { 'wb_type': 'aaworker', 'msg': msg };
        }
        afwpm.wombat.$wbwindow.top.postMessage(msg, '*');
      },
      'terminate': function () {}
    };
    this.startCheckingInterval();
  }
}

AutoFetchWorkerProxyMode.prototype.startCheckingInterval = function () {
  // if document ready state is complete do first extraction and start check polling
  // otherwise wait for document ready state to complete to extract and start check polling
  var afwpm = this;
  if (this.wombat.$wbwindow.document.readyState === 'complete') {
    this.extractFromLocalDoc();
    this.checkInterval = setInterval(this.checkIntervalCB, this.checkIntervalTime);
  } else {
    var i = setInterval(function () {
      if (afwpm.wombat.$wbwindow.document.readyState === 'complete') {
        afwpm.extractFromLocalDoc();
        clearInterval(i);
        afwpm.checkInterval = setInterval(afwpm.checkIntervalCB, afwpm.checkIntervalTime);
      }
    }, 1000);
  }
};

AutoFetchWorkerProxyMode.prototype.resumeCheckInterval = function () {
  // if the checkInterval is null (it is not active) restart the check interval
  if (this.checkInterval == null) {
    this.checkInterval = setInterval(this.extractFromLocalDoc, this.checkIntervalTime);
  }
};

AutoFetchWorkerProxyMode.prototype.pauseCheckInterval = function () {
  // if the checkInterval is not null (it is active) clear the check interval
  if (this.checkInterval != null) {
    clearInterval(this.checkInterval);
    this.checkInterval = null;
  }
};

AutoFetchWorkerProxyMode.prototype.checkIntervalCB = function () {
  this.extractFromLocalDoc();
};

AutoFetchWorkerProxyMode.prototype.terminate = function () {
  // terminate the worker, a no op when not replay top
  this.worker.terminate();
};

AutoFetchWorkerProxyMode.prototype.postMessage = function (msg, deferred) {
  if (deferred) {
    var self = this;
    return Promise.resolve().then(function () {
      self.worker.postMessage(msg);
    });
  }
  this.worker.postMessage(msg);
};

AutoFetchWorkerProxyMode.prototype.extractMediaRules = function (rules, href) {
  // We are in proxy mode and must include a URL to resolve relative URLs in media rules
  if (!rules) return [];
  var rvlen = rules.length;
  var text = [];
  var rule;
  for (var i = 0; i < rvlen; ++i) {
    rule = rules[i];
    if (rule.type === CSSRule.MEDIA_RULE) {
      text.push({ 'cssText': rule.cssText, 'resolve': href });
    }
  }
  return text;
};

AutoFetchWorkerProxyMode.prototype.corsCSSFetch = function (href) {
  // because this JS in proxy mode operates as it would on the live web
  // the rules of CORS apply and we cannot rely on URLs being rewritten correctly
  // fetch the cross origin css file and then parse it using a style tag to get the rules
  var url = location.protocol + '//' + this.wombat.wb_info.proxy_magic + '/proxy-fetch/' + href;
  var afwpm = this;
  return fetch(url).then(function (res) {
    return res.text().then(function (text) {
      afwpm.styleTag.textContent = text;
      var sheet = afwpm.styleTag.sheet || {};
      return afwpm.extractMediaRules(sheet.cssRules || sheet.rules, href);
    });
  }).catch(function () {
    return [];
  });
};

AutoFetchWorkerProxyMode.prototype.shouldSkipSheet = function (sheet) {
  // we skip extracting rules from sheets if they are from our parsing style or come from pywb
  if (sheet.id === '$wrStyleParser$') return true;
  return !!(sheet.href && sheet.href.indexOf(this.wombat.wb_info.proxy_magic) !== -1);
};

AutoFetchWorkerProxyMode.prototype.extractImgPictureSourceSrcsets = function () {
  var i;
  var elem;
  var srcset = [];
  var baseURI = this.wombat.$wbwindow.document.baseURI;
  var ssElements = this.wombat.$wbwindow.document.querySelectorAll('img[srcset], source[srcset]');
  for (i = 0; i < ssElements.length; i++) {
    elem = ssElements[i];
    if (elem.tagName === 'SOURCE') {
      if (elem.parentElement && elem.parentElement.tagName === 'PICTURE') {
        srcset.push({ srcset: elem.srcset, resolve: baseURI });
      }
    } else {
      srcset.push({
        srcset: elem.srcset,
        resolve: elem.src != null && elem.src !== ' ' ? elem.src : baseURI
      });
    }
  }
  return srcset;
};

AutoFetchWorkerProxyMode.prototype.checkForPictureSourceDataSrcsets = function () {
  var baseURI = this.wombat.$wbwindow.document.baseURI;
  var dataSS = this.wombat.$wbwindow.document.querySelectorAll('img[data-srcset], source[data-srcset]');
  var elem;
  var srcset = [];
  for (var i = 0; i < dataSS.length; i++) {
    elem = dataSS[i];
    if (elem.tagName === 'SOURCE') {
      if (elem.parentElement && elem.parentElement.tagName === 'PICTURE' && elem.dataset.srcset) {
        srcset.push({ srcset: elem.dataset.srcset, resolve: baseURI });
      }
    } else if (elem.dataset.srcset) {
      srcset.push({ srcset: elem.dataset.srcset, resolve: elem.src != null && elem.src !== ' ' ? elem.src : baseURI });
    }
  }
  if (srcset.length) {
    this.postMessage({
      'type': 'values',
      'srcset': { 'values': srcset, 'presplit': false },
      'context': {
        'docBaseURI': this.wombat.$wbwindow.document.baseURI
      }
    }, true);
  }
};

AutoFetchWorkerProxyMode.prototype.extractFromLocalDoc = function () {
  var i = 0;
  var media = [];
  var deferredMediaURLS = [];
  var sheet;
  var resolve;
  // We must use the window reference passed to us to access this origins stylesheets
  var styleSheets = this.wombat.$wbwindow.document.styleSheets;
  for (; i < styleSheets.length; ++i) {
    sheet = styleSheets[i];
    // if the sheet belongs to our parser node we must skip it
    if (!this.shouldSkipSheet(sheet)) {
      try {
        // if no error is thrown due to cross origin sheet the urls then just add
        // the resolved URLS if any to the media urls array
        if (sheet.cssRules != null) {
          resolve = sheet.href || this.wombat.$wbwindow.document.baseURI;
          media = media.concat(this.extractMediaRules(sheet.cssRules, resolve));
        } else if (sheet.href != null) {
          // depending on the browser cross origin stylesheets will have their
          // cssRules property null but href non-null
          deferredMediaURLS.push(this.corsCSSFetch(sheet.href));
        }
      } catch (error) {
        // the stylesheet is cross origin and we must re-fetch via PYWB to get the contents for checking
        deferredMediaURLS.push(this.corsCSSFetch(sheet.href));
      }
    }
  }
  // We must use the window reference passed to us to access this origins elements with srcset attr
  // like cssRule handling we must include a URL to resolve relative URLs by
  var srcset = this.extractImgPictureSourceSrcsets();

  // send what we have extracted, if anything, to the worker for processing
  if (media.length > 0 || srcset.length > 0) {
    this.postMessage({ 'type': 'values', 'media': media, 'srcset': srcset }, true);
  }

  var afwpm = this;
  if (deferredMediaURLS.length > 0) {
    // wait for all our deferred fetching and extraction of cross origin
    // stylesheets to complete and then send those values, if any, to the worker
    Promise.all(deferredMediaURLS).then(function (values) {
      var results = [];
      for (i = 0; i < values.length; i++) {
        results = results.concat(values[i]);
      }
      if (results.length > 0) {
        afwpm.postMessage({ 'type': 'values', 'media': results });
      }
    });
  }
  // deffer the checking of img/source data-srcset
  // so that we do not clobber the UI thread
  Promise.resolve().then(function () {
    afwpm.checkForPictureSourceDataSrcsets();
  });
};
