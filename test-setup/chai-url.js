// adapted from chai-url Copyright (c) 2017 Leonard Martin MIT License
export default function chaiURL(chai, utils) {
  const Assertion = chai.Assertion;
  const props = [
    'hash',
    'host',
    'hostname',
    'href',
    'origin',
    'password',
    'pathname',
    'port',
    'protocol',
    'search',
    'username'
  ];

  const matchers = {
    protocol(expected, actual, contains) {
      if (contains) return actual.includes(expected);
      return expected === actual || expected + ':' === actual;
    },
    hash(expected, actual, contains) {
      return (
        matchers.default(expected, actual, contains) ||
        matchers.default('#' + expected, actual, contains)
      );
    },
    port(expected, actual, contains) {
      if (contains) {
        console.warn(
          'chai-url: `contains` flag should not be used with port matching and will be ignored'
        );
      }
      return expected === actual || expected === parseInt(actual, 10);
    },
    default(expected, actual, contains) {
      return contains ? actual.includes(expected) : actual === expected;
    }
  };

  function assertIsUrl() {
    const obj = this._obj;
    new Assertion(() => new URL(obj)).to.not.throw();
  }

  function chainIsUrl() {
    const obj = this._obj;
    try {
      utils.flag(this, 'URL', new URL(obj));
    } catch (e) {
      // hack :'(
      new Assertion(() => {
        throw e;
      }).to.not.throw();
    }
  }

  Assertion.addChainableMethod('url', assertIsUrl, chainIsUrl);

  let i = props.length;
  while (i--) {
    let prop = props[i];
    Assertion.addMethod(prop, function(value) {
      const maybeURL = utils.flag(this, 'URL');
      if (maybeURL) {
        const contains = utils.flag(this, 'contains');
        const matcher = matchers[prop] || matchers.default;
        const match = matcher(value, maybeURL[prop], contains);
        this.assert(
          match,
          `expected #{this} to have ${prop} #{exp} but got #{act}`,
          `expected #{this} to not to have ${prop} #{act}`,
          value,
          maybeURL[prop]
        );
      } else {
        const str = this._obj;
        const url = new URL('about:blank');
        new Assertion(() => {
          url.href = str;
        }).to.not.throw();
        const contains = utils.flag(this, 'contains');
        const matcher = matchers[prop] || matchers.default;
        const match = matcher(value, url[prop], contains);
        this.assert(
          match,
          `expected #{this} to have ${prop} #{exp} but got #{act}`,
          `expected #{this} to not to have ${prop} #{act}`,
          value,
          url[prop]
        );
      }
    });
  }
}
