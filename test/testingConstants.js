window.setupAfter = {
  EventTarget: ['addEventListener', 'removeEventListener'],
  MessageEvent: ['target', 'srcElement', 'currentTarget', 'eventPhase', 'path'],
  Document: {
    fn: ['write', 'writeln', 'open', 'createElementNS'],
    props: ['URL', 'documentURI']
  },
  override_html_assign: {
    HTMLElement: ['innerHTML', 'outerHTML'],
    HTMLIFrameElement: ['srcdoc'],
    HTMLStyleElement: ['textContent'],
  },
  Attr: ['nodeValue', 'value'],
  window: ['setTimeout', 'setInterval', 'getComputedStyle'],
  protoFns: {
    Element: ['getAttribute','setAttribute'],
    SVGImageElement: ['getAttribute','getAttributeNS','setAttribute', 'setAttributeNS'],
  },
  
  elemAttrs: {
    HTMLLinkElement: ['href'],
    CSSStyleSheet: ['href'],
    HTMLImageElement: ['src','srcset'],
    HTMLIFrameElement: ['src'],
    HTMLScriptElement: ['src'],
    HTMLVideoElement: ['src','poster'],
    HTMLAudioElement: ['src','poster'],
    HTMLSourceElement: ['src','srcset'],
    HTMLInputElement: ['src'],
    HTMLEmbedElement: ['src'],
    HTMLObjectElement: ['data'],
    HTMLBaseElement: ['href'],
    HTMLMetaElement: ['content'],
    HTMLFormElement: ['action'],
  },

  anchorElement: ['href', 'hash', 'pathname', 'host', 'hostname', 'protocol',
    'origin', 'search', 'port']
}