import Wombat from './wombat'

window._WBWombat = function _WBWombat ($wbwindow, wbinfo) {
  var wb = new Wombat($wbwindow, wbinfo)
  var init = wb.wombat_init()
  $wbwindow._wb_wombat = init
  return init
}
