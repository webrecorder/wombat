export const OBJECT_TO_IFRAME_TYPES = ['application/pdf', 'image/svg+xml'];

export function createObjectWrapper(object) {
  var listeners = {};
  var props = {};
  var iframeElem;

  function addListener(name, func) {
    listeners[name] = func;
  }

  var proxy = new Proxy(object, {
    set(target, prop, value) {
      props[prop] = value;
      target[prop] = value;
      if (iframeElem && prop === "data") {
        iframeElem.src = value;
      }
      return true;
    },

    get(target, prop, receiver) {
      if (prop === "addEventListener") {
        addListener.bind(target);
      } else if (prop === "__WBProxyRealObj__") {
        return toElem(target);
      } else if (prop === "__WB_object_proxy__") {
        return true;
      } else if (prop === "contentDocument" && iframeElem) {
        return iframeElem.contentDocument;
      }

      return target[prop];
    },
  });

  function toElem(objectElem) {
    if (iframeElem) {
      return iframeElem;
    }

    if (!OBJECT_TO_IFRAME_TYPES.includes(objectElem.getAttribute("type"))) {
      return objectElem;
    }

    iframeElem = objectElem.ownerDocument.createElement("iframe");

    for (const key of Object.keys(props)) {
      iframeElem[key] = props[key];
    }

    for (const key of Object.keys(listeners)) {
      iframeElem.addEventListener(key, listeners[key]);
    }

    return iframeElem;
  }

  return proxy;
}

