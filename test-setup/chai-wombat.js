export default function chaiWombat (chai, utils) {
  const noop = () => {};
  chai.Assertion.addChainableMethod('rewritten', noop, function noRW () {
    utils.flag(this, 'object')._no_rewrite = true;
  });

  chai.Assertion.addChainableMethod('fullHTMLDoc', noop, function reconstructFullHTML () {
    const obj = utils.flag(this, 'object');
    utils.flag(this, 'object', `<!doctype html>${obj.outerHTML}`);
  });

  chai.Assertion.addChainableMethod('rewrittenFullHTMLDoc', noop, function reconstructFullHTML () {
    const obj = utils.flag(this, 'object');
    obj._no_rewrite = true;
    utils.flag(this, 'object', `<!doctype html>${obj.outerHTML}`);
  });

  chai.Assertion.addChainableMethod('htmlDoc', noop, function reconstructFullHTML () {
    const obj = utils.flag(this, 'object');
    utils.flag(this, 'object', obj.outerHTML);
  });

  chai.Assertion.addChainableMethod('rewrittenHTMLDoc', noop, function reconstructFullHTML () {
    const obj = utils.flag(this, 'object');
    obj._no_rewrite = true;
    utils.flag(this, 'object', obj.outerHTML);
  });

  chai.Assertion.addMethod('elementWithId', function getElementIded (id) {
    const obj = utils.flag(this, 'object');
    const elem = obj.getElementById(id);
    new chai.Assertion(elem, `The element id'd '${id}' does not exist`).to.not.be.null;
    utils.flag(this, 'object', elem);
  });

  chai.Assertion.addMethod('rewrittenHTML', function (html) {
    this.rewritten.html(html);
  });

  chai.Assertion.addChainableMethod('rewrittenOuterHTML', noop, function (html) {
    const obj = utils.flag(this, 'object');
    obj._no_rewrite = true;
    utils.flag(this, 'object', obj.outerHTML);
  });

  chai.Assertion.addMethod('rewrittenText', function (text) {
    this.rewritten.text(text);
  });

  chai.Assertion.addMethod('rewrittenAttr', function checkRWAttr (name, val) {
    const elem = utils.flag(this, 'object');
    if (!utils.flag(this, 'negate') || val == null) {
      this.assert(
        elem.hasAttribute(name)
        , `expected ${elem.localName} to have an attribute #{exp}`
        , `expected ${elem.localName} not to have an attribute #{exp}`
        , name
      );
    }
    const actual = window.Element.prototype.getAttribute.call(elem, name);
    if (val != null) {
      this.assert(
        val === actual
        , `expected ${elem.localName} to have an attribute ${utils.inspect(name)} with the value #{exp}, but the value was #{act}`
        , `expected ${elem.localName} not to have an attribute ${utils.inspect(name)} with the value #{act}`
        , val
        , actual
      );
    }
    utils.flag(this, 'object', actual);
  });
}
