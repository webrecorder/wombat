/* eslint-disable camelcase */

export function wrapSameOriginEventListener(origListener, win) {
  return function(event) {
    if (window !== win) {
      return;
    }
    return origListener(event);
  };
}

/**
 * @param {function(*): *} origListener
 * @param {Window} win
 * @param {Wombat} wombat
 * @return {function(*): *}
 */
export function wrapEventListener(origListener, win, wombat) {
  return function(event) {
    var ne;

    if (event.data && event.data.from && event.data.message) {
      if (
        event.data.to_origin !== '*' &&
        win.WB_wombat_location &&
        !wombat.startsWith(event.data.to_origin, win.WB_wombat_location.origin)
      ) {
        console.warn(
          'Skipping message event to ' +
            event.data.to_origin +
            " doesn't start with origin " +
            win.WB_wombat_location.origin
        );
        return;
      }

      var source = event.source;

      if (event.data.from_top) {
        source = win.__WB_top_frame;
      } else if (
        event.data.src_id &&
        win.__WB_win_id &&
        win.__WB_win_id[event.data.src_id]
      ) {
        source = win.__WB_win_id[event.data.src_id];
      }

      ne = new MessageEvent('message', {
        bubbles: event.bubbles,
        cancelable: event.cancelable,
        data: event.data.message,
        origin: event.data.from,
        lastEventId: event.lastEventId,
        source: wombat.proxyToObj(source),
        ports: event.ports
      });

      ne._target = event.target;
      ne._srcElement = event.srcElement;
      ne._currentTarget = event.currentTarget;
      ne._eventPhase = event.eventPhase;
      ne._path = event.path;
    } else {
      ne = event;
    }

    return origListener(ne);
  };
}
