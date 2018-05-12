import Wombat from './wombat'

window._WBWombat = function _WBWombat ($wbwindow, wbinfo) {
  var wb = new Wombat($wbwindow, wbinfo)
  return wb.wombat_init()
}
