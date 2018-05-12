export function SameOriginListener (orig_listener, win) {
  function listen (event) {
    if (window !== win) {
      return
    }

    return orig_listener(event)
  }

  return {'listen': listen}
}

export function WrappedListener (orig_listener, win, wombat) {
  function listen (event) {
    var ne = event

    if (event.data.from && event.data.message) {
      if (event.data.to_origin !== '*' && win.WB_wombat_location &&
        !wombat.starts_with(event.data.to_origin,
          win.WB_wombat_location.origin)) {
        console.warn('Skipping message event to ' + event.data.to_origin +
          ' doesn\'t start with origin ' + win.WB_wombat_location.origin)
        return
      }

      var source = event.source

      if (event.data.from_top) {
        source = win.__WB_top_frame
      } else if (event.data.src_id && win.__WB_win_id &&
        win.__WB_win_id[event.data.src_id]) {
        source = win.__WB_win_id[event.data.src_id]
      }

      source = wombat.proxy_to_obj(source)

      ne = new MessageEvent('message', {
        'bubbles': event.bubbles,
        'cancelable': event.cancelable,
        'data': event.data.message,
        'origin': event.data.from,
        'lastEventId': event.lastEventId,
        'source': source,
        'ports': event.ports
      })

      ne._target = event.target
      ne._srcElement = event.srcElement
      ne._currentTarget = event.currentTarget
      ne._eventPhase = event.eventPhase
      ne._path = event.path
    }

    return orig_listener(ne)
  }

  return {'listen': listen}
}
