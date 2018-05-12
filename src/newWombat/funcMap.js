function FuncMap () {
  this._arr = []
}

FuncMap.prototype.find = function (func) {
  for (let i = 0; i < this._arr.length; ++i) {
    let ari = this._arr[i]
    if (ari[0] === func) {
      return i
    }
  }
  return -1
}

FuncMap.prototype.add_or_get = function (func, initter) {
  const res = this.find(func)
  if (res >= 0) {
    return this._arr[res][1]
  }
  const value = initter()
  this._arr.push([func, value])
  return value
}

FuncMap.prototype.remove = function (func) {
  const res = this.find(func)
  if (res >= 0) {
    return this._arr.splice(res, 1)[0][1]
  }
  return null
}

FuncMap.prototype.map = function (param) {
  for (var i = 0; i < this._arr.length; i++) {
    (this._arr[i][0])(param)
  }
}

export default FuncMap
