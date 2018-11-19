'use strict';
import 'mocha/mocha';
import 'chai/chai';
import 'chai-dom';
import 'chai-string';
import chaiAsPromised from './chai-as-promised';
import chaiInterface from './chai-interface';
import chaiURL from './chai-url';

/**
 * @type {chai}
 */
window.chai = chai;
chai.use(chaiAsPromised);
chai.use(chaiInterface);
chai.use(chaiURL);

/**
 * @type {function() : chai.Assertion}
 */
window.expect = chai.expect;
