export function chaiURL (chai, utils) {
  const Assertion = chai.Assertion
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
  ]

  function matcher (expected, actual, contains) {
    return contains ? actual.includes(expected) : actual === expected
  }

  const urlParser = new URL('about:blank')
  props.forEach(prop => {
    Assertion.addMethod(prop, function (value) {
      const str = this._obj

      // if url isn't a string we cannot continue
      new Assertion(str).to.be.a('string')

      urlParser.href = str
      const contains = utils.flag(this, 'contains')
      const match = matcher(value, urlParser[prop], contains)
      this.assert(
        match,
        `expected #{this} to have ${prop} #{exp} but got #{act}`,
        `expected #{this} to not to have ${prop} #{act}`,
        value,
        url[prop]
      )
    })
  })
}