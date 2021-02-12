import Wombat from './wombat';

window._WBWombat = Wombat;
window._WBWombatInit = function(wbinfo) {
  if (!this._wb_wombat) {
    var wombat = new Wombat(this, wbinfo);
    this._wb_wombat = wombat.wombatInit();
  } else {
    this._wb_wombat.init_paths(wbinfo);
  }
};
