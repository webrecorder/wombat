'use strict';
import 'mocha/mocha';
import 'chai/chai';
import 'chai-dom';
import 'chai-string';
import get from 'lodash-es/get';
import zip from 'lodash-es/zip';
import chaiAsPromised from './chai-as-promised';
import chaiInterface from './chai-interface';
import chaiURL from './chai-url';
import chaiWombat from './chai-wombat';

window.getViaPath = get;
window.zip = zip;

/**
 * @type {chai}
 */
window.chai = chai;
chai.use(chaiWombat);
chai.use(chaiAsPromised);
chai.use(chaiInterface);
chai.use(chaiURL);

/**
 * @type {function() : chai.Assertion}
 */
window.expect = chai.expect;
