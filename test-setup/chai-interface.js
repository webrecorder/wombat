// chai-interface Copyright © 2013 Agile Diagnosis, Inc. MIT Licence

var connective = {
  each: Array.prototype.forEach,
  every: Array.prototype.every,
  some: Array.prototype.some,
  or() {
    var terms = arguments;
    return function() {
      var ctx = this;
      var args = arguments;
      return connective.some.call(terms, function(term) {
        return !!term.apply(ctx, args);
      });
    };
  },
  and() {
    var terms = arguments;
    return function() {
      var ctx = this;
      var args = arguments;
      return connective.every.call(terms, function(term) {
        return !!term.apply(ctx, args);
      });
    };
  },
  not(term) {
    return function() {
      return !term.apply(this, arguments);
    };
  }
};

function K(x) {
  return function() {
    return x;
  };
}

function is(predicate) {
  if (predicate === Function) return is.Function;
  if (predicate === Boolean) return is.Boolean;
  if (predicate === Object) return is.Object;
  if (predicate === Number) return is.Number;
  if (predicate === String) return is.String;
  if (predicate === Array) return Array.isArray;

  if (predicate && predicate.name && predicate.name in global)
    return is[predicate.name];

  if (predicate instanceof RegExp) return is.RegExMatch(predicate);
  if (is.Function(predicate)) return predicate;
  if (is.Null(predicate)) return is.Null;
  if (Array.isArray(predicate)) return all(is(predicate[0]));

  // object literal, fallback to tracery
  if (is.Object(predicate)) return false;

  return K(false);
}

function all(predicate) {
  return function(arr) {
    return arr.every(predicate);
  };
}

is.TypeOf = function(type) {
  type = type.toLowerCase();
  return function(subject) {
    return typeof subject === type;
  };
};

is.ObjectOf = function(constructorName) {
  var signature = '[object ' + constructorName + ']';
  return function(subject) {
    return Object.prototype.toString.call(subject) === signature;
  };
};

is.RegExMatch = function(regex) {
  return function(str) {
    return is.String(str) && regex.test(str);
  };
};

is.Null = function(x) {
  return x === null;
};
is.Number = connective.and(is.TypeOf('number'), connective.not(Number.isNaN));
is.Function = is.TypeOf('Function');
is.Boolean = is.TypeOf('Boolean');
is.Object = is.TypeOf('Object');
is.String = is.TypeOf('String');
is.Undefined = is.TypeOf('Undefined');

is.Date = is.ObjectOf('Date');
is.RegExp = is.ObjectOf('RegExp');
is.DataView = is.ObjectOf('DataView');
is.ArrayBuffer = is.ObjectOf('ArrayBuffer');
is.Float32Array = is.ObjectOf('Float32Array');
is.Float64Array = is.ObjectOf('Float64Array');
is.Int8Array = is.ObjectOf('Int8Array');
is.Int16Array = is.ObjectOf('Int16Array');
is.Int32Array = is.ObjectOf('Int32Array');
is.Uint8Array = is.ObjectOf('Uint8Array');
is.Uint16Array = is.ObjectOf('Uint16Array');
is.Uint32Array = is.ObjectOf('Uint32Array');

function Collection(predicate) {
  return function(obj) {
    for (var key in obj) {
      if (!predicate(obj[key])) {
        return false;
      }
    }
    return true;
  };
}

function tracery(structure) {
  if (Array.isArray(structure)) {
    return is(structure);
  }
  return function(obj) {
    if (obj === undefined || obj === null) {
      return false;
    }
    const keys = Object.keys(structure);
    let type, test, prop, key;
    let i = keys.length;
    while (i--) {
      key = keys[i];
      type = structure[key];
      test = is(type) || tracery(type);
      prop = obj[key];
      if (!test(prop)) {
        return false;
      }
    }
    return true;
  };
}

function Optional(type) {
  return connective.or(is(type), is.Undefined);
}

function Nullable(type) {
  return connective.or(is(type), is.Null);
}

function Vector(structure) {
  var predicates = structure.map(is);
  var len = structure.length;
  return function(arr) {
    if (!Array.isArray(arr)) return false;
    if (arr.length !== len) return false;
    for (var i = 0; i < len; i++) {
      var ele = arr[i];
      if (!predicates[i](ele)) return false;
    }
    return true;
  };
}

function InstanceOf(constructor) {
  return function(x) {
    return x instanceof constructor;
  };
}

function diff(Interface, doc) {
  var d = {};
  var same = true;

  const props = Object.keys(Interface);
  let i = props.length;
  let actual, expected, prop;
  while (i--) {
    prop = props[i];
    actual = doc[prop];
    expected = Interface[prop];
    var test = is(expected);
    if (!test) {
      // expecting an object

      if (!actual) {
        // and it's mising
        same = false;
        d[prop] = {
          actual: toString(actual),
          expected: toString(expected),
          actualValue: actual
        };
      } else {
        // it's an object, recurse
        var dd = diff(expected, actual);
        if (dd) {
          same = false;
          d[prop] = dd;
        }
      }
    } else if (!is(expected)(actual)) {
      same = false;
      d[prop] = {
        actual: toString(actual),
        expected: toString(expected),
        actualValue: actual
      };
    }
  }

  return same ? false : d;
}

function toString(type) {
  // null
  if (is.Null(type)) {
    return 'Null';
  }

  var t = typeof type;
  // builtin functions and custom pattern predicates
  if (t === 'function') {
    return type.name || 'Custom Function';
  }

  // value types
  if (t !== 'object') return t[0].toUpperCase() + t.substring(1);

  // typed arrays
  if (Array.isArray(type)) {
    var t0 = toString(type[0]);
    if (
      type.every(function(ele) {
        return toString(ele) === t0;
      })
    ) {
      return 'Array<' + t0 + '>';
    } else {
      return 'Array';
    }
  }

  // otherwise
  return Object.prototype.toString(type).replace(/[\[\]]/g, '');
}

function format(diff) {
  var str = 'Interface not as expected:\n';
  // pretty print json
  str += JSON.stringify(diff, null, 2);
  return str;
}

export default function chaiInterface(chai, utils) {
  var Assertion = chai.Assertion;
  var assert = chai.assert;

  utils.addMethod(Assertion.prototype, 'interface', function(interfaceMap) {
    // map is an object map with property names as keys and strings for
    // typeof checks or a nested interfaceMap
    assert(
      typeof this._obj === 'object' || typeof this._obj === 'function',
      'object or function expected'
    );

    var hasInterface = tracery(interfaceMap);
    assert(hasInterface(this._obj), format(diff(interfaceMap, this._obj)));
  });
}
