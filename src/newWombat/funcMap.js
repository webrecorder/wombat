export default function FuncMap() {
  /**
   * @type {Array<[function, function]>}
   * @private
   */
  this._map = [];
}

FuncMap.prototype.set = function(fnKey, fnValue) {
  this._map.push([fnKey, fnValue]);
};

FuncMap.prototype.get = function(fnKey) {
  for (var i = 0; i < this._map.length; i++) {
    if (this._map[i][0] === fnKey) {
      return this._map[i][1];
    }
  }
  return null;
};

FuncMap.prototype.find = function(fnKey) {
  for (var i = 0; i < this._map.length; i++) {
    if (this._map[i][0] === fnKey) {
      return i;
    }
  }
  return -1;
};

FuncMap.prototype.add_or_get = function(func, initter) {
  var fnValue = this.get(func);
  if (!fnValue) {
    fnValue = initter();
    this.set(func, fnValue);
  }
  return fnValue;
};

FuncMap.prototype.remove = function(func) {
  var idx = this.find(func);
  if (idx >= 0) {
    var fnMapping = this._map.splice(idx, 1);
    return fnMapping[0][1];
  }
  return null;
};

FuncMap.prototype.map = function(param) {
  for (var i = 0; i < this._map.length; i++) {
    this._map[i][1](param);
  }
};
