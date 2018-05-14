window.setupAfter = {
  EventTarget: ['addEventListener', 'removeEventListener'],
  MessageEvent: ['target', 'srcElement', 'currentTarget', 'eventPhase', 'path'],
  Document: {
    fn: ['write', 'writeln', 'open'],
    props: ['URL', 'documentURI']
  },
  override_html_assign: {
    HTMLElement: ['innerHTML', 'outerHTML'],
    HTMLIFrameElement: ['srcdoc'],
    HTMLStyleElement: ['textContent'],
  },
  Attr: ['nodeValue', 'value'],

  fns: {
    window: ['setTimeout', 'setInterval', 'getComputedStyle'],
    Element: ['getAttribute','setAttribute'],
    SVGImageElement: ['getAttribute','getAttributeNS','setAttribute', 'setAttributeNS'],
  }
}