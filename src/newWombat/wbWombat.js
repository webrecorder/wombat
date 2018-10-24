'use strict';
import Wombat from './wombat';

window._WBWombat = Wombat;
window._WBWombatInit = function () {
  if (!this._wb_wombat || !this._wb_wombat.actual) {
    var wombat = new Wombat(this, this.wbinfo);
    wombat.actual = true;
    this._wb_wombat = wombat.wombat_init();
  } else if (!this._wb_wombat) {
    console.warn('_wb_wombat missing!');
  }
};
