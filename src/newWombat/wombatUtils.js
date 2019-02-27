export function ensureNumber(index) {
  var indexType = typeof index;
  switch (indexType) {
    case 'number':
    case 'bigint':
      return index >= 0 ? index : null;
    case 'string':
      return !isNaN(index) ? +index : null;
    default:
      try {
        var value = Number(index);
        return !isNaN(value) ? value : null;
      } catch (e) {
        return null;
      }
  }
}

export function addToStringTagToClass(clazz, tag) {
  if (
    typeof self.Symbol !== 'undefined' &&
    typeof self.Symbol.toStringTag !== 'undefined'
  ) {
    Object.defineProperty(clazz.prototype, self.Symbol.toStringTag, {
      value: tag,
      enumerable: false,
      configurable: true,
      writable: true
    });
  }
}
