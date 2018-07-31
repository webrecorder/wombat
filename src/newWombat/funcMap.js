export default function FuncMap () {
  this._arr = [];
}

FuncMap.prototype.find = function (func) {
  for (var i = 0; i < this._arr.length; i++) {
    if (this._arr[i][0] === func) {
      return i;
    }
  }
  return -1;
};

FuncMap.prototype.add_or_get = function (func, initter) {
  var res = this.find(func);
  if (res >= 0) {
    return this._arr[res][1];
  }
  var value = initter();
  this._arr.push([func, value]);
  return value;
};

FuncMap.prototype.remove = function (func) {
  var res = this.find(func);
  if (res >= 0) {
    return this._arr.splice(res, 1)[0][1];
  }
  return null;
};

FuncMap.prototype.map = function (param) {
  for (var i = 0; i < this._arr.length; i++) {
    this._arr[i][1](param);
  }
};
