window.TestedPropertyDescriptorUpdates = [
  {
    docOrWin: 'document',
    props: ['title', 'domain', 'cookie'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    docOrWin: 'document',
    props: ['origin', 'referrer'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function
    }
  },
  {
    docOrWin: 'window',
    props: ['origin', 'localStorage', 'sessionStorage'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function
    },
    // original setter remains
    skipSet: new Set(['origin'])
  },
  {
    docOrWin: 'window',
    props: ['onmessage', 'onstorage'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.CSSStyleSheet.prototype',
    props: ['href'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.Document.prototype',
    props: ['URL', 'documentURI'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function
    }
  },
  {
    objPath: 'window.Node.prototype',
    props: ['baseURI', 'ownerDocument'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function
    }
  },
  {
    objPath: 'window.Attr.prototype',
    props: ['nodeValue', 'value'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function
    },
    skipSet: new Set(['value'])
  },
  {
    objPath: 'window.HTMLElement.prototype',
    props: ['innerHTML', 'outerHTML'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLIFrameElement.prototype',
    props: ['srcdoc'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLStyleElement.prototype',
    props: ['textContent'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLLinkElement.prototype',
    props: ['href'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLImageElement.prototype',
    props: ['src', 'srcset'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLIFrameElement.prototype',
    props: ['src'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLScriptElement.prototype',
    props: ['src'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLVideoElement.prototype',
    props: ['src', 'poster'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLAudioElement.prototype',
    props: ['src', 'poster'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLSourceElement.prototype',
    props: ['src', 'srcset'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLInputElement.prototype',
    props: ['src'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLEmbedElement.prototype',
    props: ['src'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLObjectElement.prototype',
    props: ['data'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLBaseElement.prototype',
    props: ['href'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLMetaElement.prototype',
    props: ['content'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLFormElement.prototype',
    props: ['action'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLHtmlElement.prototype',
    props: ['parentNode'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function
    }
  },
  {
    objPath: 'window.HTMLFrameElement.prototype',
    props: ['src'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLTrackElement.prototype',
    props: ['src'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLAreaElement.prototype',
    props: ['href', 'hash', 'pathname', 'host', 'hostname', 'protocol', 'origin', 'search', 'port'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.HTMLAnchorElement.prototype',
    props: ['href', 'hash', 'pathname', 'host', 'hostname', 'protocol', 'origin', 'search', 'port'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.Text.prototype',
    props: ['wholeText'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function
    }
  },
  {
    objPath: 'window.Text.prototype',
    props: ['data'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: `window.${window.CSS2Properties != null ? 'CSS2Properties' : 'CSSStyleDeclaration'}.prototype`,
    props: ['cssText', 'background', 'backgroundImage', 'cursor', 'listStyle', 'listStyleImage', 'border', 'borderImage', 'borderImageSource', 'maskImage'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    },
    skipGet: new Set(['cssText'])
  },
  {
    objPath: 'window.CSSRule.prototype',
    props: ['cssText'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    },
    skipGet: new Set(['cssText'])
  },
  {
    objPath: 'window.Object.prototype',
    props: ['WB_wombat_location', 'WB_wombat_top', '__WB_pmw'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function,
      set: Function
    }
  },
  {
    objPath: 'window.MessageEvent.prototype',
    props: ['target', 'srcElement', 'currentTarget', 'eventPhase', 'path', 'source'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function
    }
  },
  {
    objPath: 'window.StorageEvent.prototype',
    props: ['storageArea'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function
    }
  },
  {
    objPath: 'window.MouseEvent.prototype',
    props: ['view'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function
    }
  },
  {
    objPath: 'window.Event.prototype',
    props: ['target'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function
    }
  },
  {
    objPath: 'window.XMLHttpRequest.prototype',
    props: ['responseURL'],
    expectedInterface: {
      configurable: Boolean,
      enumerable: Boolean,
      get: Function
    }
  },
  {
    objPaths: ['window.MouseEvent.prototype', 'window.FontFace.prototype'],
    props: ['constructor'],
    expectedInterface: {
      value: Function
    }
  }
];

const maybeInitUIEvents = ['window.UIEvent', 'window.MouseEvent', 'window.TouchEvent', 'window.FocusEvent', 'window.KeyboardEvent', 'window.WheelEvent', 'window.InputEvent', 'window.CompositionEvent'];

window.TestFunctionChanges = [
  {
    constructors: ['window.Date', 'window.Request', 'window.Audio', 'window.Worker', 'window.SharedWorker', 'window.FontFace'].concat(maybeInitUIEvents)
  },
  {
    objPath: 'window.history',
    fns: ['replaceState', 'pushState'],
    origs: ['_orig_replaceState', '_orig_pushState']
  },
  {
    fnPath: 'window.postMessage',
    oPath: 'window.__orig_postMessage'
  },
  {
    objPath: 'window.Window.prototype',
    fns: ['postMessage']
  },
  {
    objPath: 'window.Document.prototype',
    fns: ['write', 'writeln', 'open', 'createElementNS', 'evaluate', 'createTreeWalker']
  },
  {
    objPath: 'window.Node.prototype',
    fns: ['compareDocumentPosition', 'contains', 'replaceChild', 'appendChild', 'insertBefore']
  },
  {
    objPath: 'window.XMLHttpRequest.prototype',
    fns: ['open']
  },
  {
    objPath: 'window.navigator',
    fns: ['sendBeacon', 'registerProtocolHandler']
  },
  {
    objPath: 'window.ServiceWorkerContainer.prototype',
    fns: ['register']
  },
  {
    objPath: 'window.navigator.serviceWorker',
    fns: ['register']
  },
  {
    objPath: 'window',
    fns: [
      'fetch', 'setInterval', 'setTimeout', 'getComputedStyle'
    ]
  },
  {
    objPath: 'window.Math',
    fns: [ 'random' ]
  },
  {
    objPath: 'window.crypto',
    fns: [ 'getRandomValues' ]
  },
  {
    objPath: 'window.Notification',
    fns: [ 'requestPermission' ]
  },
  {
    objPath: 'window.Crypto.prototype',
    fns: ['getRandomValues']
  },
  {
    objPath: 'window.Date',
    fns: ['now']
  },
  {
    objPath: 'window.Element.prototype',
    fns: ['getAttribute', 'setAttribute', 'insertAdjacentElement', 'insertAdjacentHTML']
  },
  {
    objPath: 'window.SVGImageElement.prototype',
    fns: ['getAttribute', 'getAttributeNS', 'setAttribute', 'setAttributeNS']
  },
  {
    objPath: 'window.MutationObserver.prototype',
    fns: ['observe']
  },
  {
    objPath: 'window.Node.prototype',
    fns: ['compareDocumentPosition', 'contains', 'replaceChild', 'appendChild', 'insertBefore']
  },
  {
    objPath: 'window.Function.prototype',
    fns: ['apply']
  },
  {
    objPath: 'window.CSSStyleSheet.prototype',
    fns: ['insertRule']
  },
  {
    objPath: `window.${window.CSS2Properties != null ? 'CSS2Properties' : 'CSSStyleDeclaration'}.prototype`,
    fns: ['setProperty']
  },
  {
    objPath: 'window.Text.prototype',
    fns: ['appendData', 'insertData', 'replaceData']
  },
  {
    objPath: 'window.XSLTProcessor.prototype',
    fns: ['transformToFragment']
  },
  {
    objPath: 'document',
    fns: ['write', 'writeln', 'open', 'createElementNS', 'evaluate', 'createTreeWalker', 'createTouch']
  },
  {
    objPath: `${(window.EventTarget && window.EventTarget.prototype) ? 'window.EventTarget.prototype' : 'window'}`,
    fns: ['addEventListener', 'removeEventListener']
  }
];

if (window.geolocation) {
  window.TestFunctionChanges.push({
    objPath: 'window.geolocation',
    fns: ['getCurrentPosition', 'watchPosition']
  });
}

if (window.Worklet) {
  window.TestFunctionChanges.push({
    objPath: 'window.Worklet.prototype',
    fns: ['addModule']
  });
}

if (window.StylePropertyMap) {
  window.TestFunctionChanges.push({
    objPath: 'window.StylePropertyMap.prototype',
    fns: ['set', 'append']
  });
}

maybeInitUIEvents.forEach(uie => {
  const event = uie.split('.')[1];
  if (window.getViaPath(window, `${uie}.prototype.init${event}`)) {
    window.TestFunctionChanges.push({
      objPath: `${uie}.prototype`,
      fns: [`init${event}`]
    });
  }
});

window.URLParts = [
  'href', 'hash', 'pathname', 'host', 'hostname', 'protocol', 'origin', 'search', 'port'
];

window.WB_PREFIX = `${location.protocol}//localhost:${location.port}/live/20180803160549`;

window.fullHTML = ({ prefix, onlyBody, onlyHead, onlyHTML } = {}) => {
  const cssPrefix = prefix != null ? `${prefix}cs_/` : '';
  const jsPrefix = prefix != null ? `${prefix}js_/` : '';
  const body = `<body><script id="theScript" src="${jsPrefix}http://javaScript.com/script.js"></script></body>`;
  if (onlyBody) return body;
  const headString = `<head><link id="theLink" rel="stylesheet" href="${cssPrefix}http://cssHeaven.com/angelic.css"></head>`;
  let topMatter = `<!doctype html><html>${headString}${body}`;
  let bottomMatter = `</html>`;
  if (onlyHTML) {
    topMatter = `<html>${headString}${body}`;
    bottomMatter = `</html>`;
  } else if (onlyHead) {
    topMatter = headString;
    bottomMatter = '';
  }
  return `${topMatter}${bottomMatter}`;
};

window.TextNodeTest = {
  fnTests: ['appendData', 'insertData', 'replaceData'],
  theStyle: '.hi { background-image: url(https://funky/png.png); }',
  theStyleRw: `.hi { background-image: url(${window.WB_PREFIX}mp_/https://funky/png.png); }`,
  makeTextNode (doc, inStyle) {
    const results = {
      tn: doc.createTextNode('')
    };
    if (inStyle) {
      results.tnParent = doc.createElement('style');
      results.tnParent.appendChild(results.tn);
      results.cleanUp = () => {
        results.tnParent.remove();
      };
    } else {
      results.tnParent = doc.createElement('p');
      results.tnParent.appendChild(results.tn);
      results.cleanUp = () => {
        results.tnParent.remove();
      };
    }
    return results;
  }
};

window.HTMLAssign = {
  innerOuterHTML: [
    {
      which: 'innerHTML',
      unrw: '<a href="http://example.com">hi</a>',
      rw: `<a href="${window.WB_PREFIX}mp_/http://example.com">hi</a>`
    },
    {
      which: 'outerHTML',
      unrw: '<div id="oHTML"><a href="http://example.com">hi</a></div>',
      rw: `<div id="oHTML"><a href="${window.WB_PREFIX}mp_/http://example.com">hi</a></div>`
    }
  ]
};

window.LinkAsTypes = {
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

window.TagToMod = {
  'A': { 'href': 'mp_' },
  'AREA': { 'href': 'mp_' },
  'IMG': { 'src': 'im_', 'srcset': 'im_' },
  'IFRAME': { 'src': 'if_' },
  'FRAME': { 'src': 'if_' },
  'SCRIPT': { 'src': 'js_' },
  'VIDEO': { 'src': 'oe_', 'poster': 'im_' },
  'AUDIO': { 'src': 'oe_', 'poster': 'im_' },
  'SOURCE': { 'src': 'oe_', 'srcset': 'oe_' },
  'INPUT': { 'src': 'oe_' },
  'EMBED': { 'src': 'oe_' },
  'OBJECT': { 'data': 'oe_' },
  'BASE': { 'href': 'mp_' },
  'META': { 'content': 'mp_' },
  'FORM': { 'action': 'mp_' },
  'TRACK': { 'src': 'oe_' }
};

window.ElementGetSetAttribute = [
  {
    elem: 'link',
    prop: 'href',
    unrw: 'http://example.com/whatever'
  },
  {
    elem: 'img',
    props: ['src', 'srcset'],
    unrws: ['http://example.com/whatever', 'http://example.com/whatever 1.5x']
  },
  {
    elem: 'iframe',
    props: ['src'],
    unrws: ['http://example.com/whatever']
  },
  {
    elem: 'script',
    props: ['src'],
    unrws: ['http://example.com/whatever.js']
  },
  {
    elem: 'video',
    props: ['src', 'poster'],
    unrws: ['http://example.com/whatever', 'http://example.com/whatever']
  },
  {
    elem: 'audio',
    props: ['src', 'poster'],
    unrws: ['http://example.com/whatever', 'http://example.com/whatever']
  },
  {
    elem: 'source',
    props: ['src', 'srcset'],
    unrws: ['http://example.com/whatever', 'http://example.com/whatever 1.5x']
  },
  {
    elem: 'input',
    props: ['src'],
    unrws: ['http://example.com/whatever']
  },
  {
    elem: 'embed',
    props: ['src'],
    unrws: ['http://example.com/whatever']
  },
  {
    elem: 'base',
    props: ['href'],
    unrws: ['http://example.com/whatever']
  },
  {
    elem: 'meta',
    props: ['content'],
    unrws: ['http://example.com/whatever']
  },
  {
    elem: 'form',
    props: ['action'],
    unrws: ['http://example.com/whatever']
  },
  {
    elem: 'frame',
    props: ['src'],
    unrws: ['http://example.com/whatever']
  },
  {
    elem: 'track',
    props: ['src'],
    unrws: ['http://example.com/whatever']
  },
  {
    elem: 'area',
    props: ['href'],
    unrws: ['http://example.com/whatever']
  },
  {
    elem: 'a',
    props: ['href'],
    unrws: ['http://example.com/whatever']
  }
];

// {
//   elem: 'area',
//     props: ['href', 'hash', 'pathname', 'host', 'hostname', 'protocol', 'origin', 'search', 'port'],
//   unrws: ['http://username:password@example.com:80/whatever#bang?search=1', '#bang', '/whatever', '', '', '', '', '', '']
// },
// {
//   elem: 'a',
//     props: ['href', 'hash', 'pathname', 'host', 'hostname', 'protocol', 'origin', 'search', 'port'],
// }