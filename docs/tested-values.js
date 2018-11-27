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
    props: ['cssText', 'background', 'backgroundImage', 'cursor', 'listStyle', 'listStyleImage', 'border', 'borderImage', 'borderImageSource'],
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

window.TestFunctionChanges = [
  {
    constructors: ['window.Date', 'window.Request', 'window.Audio', 'window.Worker', 'window.SharedWorker', 'window.MouseEvent', 'window.FontFace']
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
    objPath: 'window.EventTarget.prototype',
    fns: ['addEventListener', 'removeEventListener']
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
    objPath: 'window.MouseEvent.prototype',
    fns: ['initMouseEvent']
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
    objPath: 'window.geolocation',
    fns: ['getCurrentPosition', 'watchPosition']
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
    objPath: 'window.Text.prototype',
    fns: ['appendData', 'insertData', 'replaceData']
  },
  {
    objPath: 'window.XSLTProcessor.prototype',
    fns: ['transformToFragment']
  }
];
