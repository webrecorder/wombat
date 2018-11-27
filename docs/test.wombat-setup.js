/* eslint-env mocha */

function makePropertyDescriptorTest (objectPath, prop, expectedInterface, skipGet, skipSet) {
  return function () {
    // get the original and wombat object represented by the object path expression
    // eg if objectPath is window.Node.prototype then original === window.Node.prototype and obj === wombatSandbox.window.Node.prototype
    const original = window.getViaPath(window.untamperedWithWinDocObj, objectPath);
    const obj = window.getViaPath(this.wombatSandbox, objectPath);
    // sometimes we need to skip a property get/set toString check
    let skipGetCheck = !!(skipGet && skipGet.has(prop));
    let skipSetCheck = !!(skipSet && skipSet.has(prop));
    // use the reflect object in the wombat sandbox context
    const newPD = this.wombatSandbox.window.Reflect.getOwnPropertyDescriptor(obj, prop);
    // eslint-disable-next-line no-unused-expressions
    expect(newPD, `The new property descriptor for ${objectPath}.${prop} should have been added`).to.not.be.null;
    expect(newPD).to.have.interface(expectedInterface, `The new property descriptor for ${objectPath}.${prop} is incorrect`);
    const originalPD = Reflect.getOwnPropertyDescriptor(original, prop);
    if (originalPD) {
      // do a quick deep check first to see if we modified something
      expect(newPD).to.not.deep.equal(originalPD, `The property descriptor for ${objectPath}.${prop} was not modified`);
      // now check each part of the expected property descriptor to make sure nothing went wrong
      if (!skipGetCheck && expectedInterface.get && newPD.get && originalPD.get) {
        expect(newPD.get.toString()).to.not.equal(originalPD.get.toString(), `${objectPath}.${prop} the "new" get function equals the original`);
      }
      if (!skipSetCheck && expectedInterface.set && newPD.set && originalPD.set) {
        expect(newPD.set.toString()).to.not.equal(originalPD.set.toString(), `${objectPath}.${prop} the "new" set function equals the original`);
      }
      if (originalPD.configurable != null && newPD.configurable != null) {
        expect(newPD.configurable).to.equal(originalPD.configurable, `${objectPath}.${prop} the "new" configurable pd does not equals the original`);
      }
      if (originalPD.writable != null && newPD.writable != null) {
        expect(newPD.writable).to.equal(originalPD.writable, `${objectPath}.${prop} the "new" writable pd does not equals the original`);
      }
      if (originalPD.value != null && newPD.value != null) {
        expect(newPD.value).to.not.equal(originalPD.writable, `${objectPath}.${prop} the "new" value pd equals the original`);
      }
    }
  };
}

describe('Wombat setup', function () {
  before(window.initTestContext());

  describe('before initialization', function () {
    it('should put _WBWombat on window', function () {
      const { window } = this.wombatSandbox;
      expect(window).to.have.property('_WBWombat').that.is.a('function', '_WBWombat should be placed on window before initialization and should be a function');
    });

    it('should not add __WB_replay_top to window', function () {
      const { window } = this.wombatSandbox;
      expect(window).to.not.have.property('__WB_replay_top', '__WB_replay_top should not exist on window');
    });

    it('should not add _WB_wombat_location to window', function () {
      const { window } = this.wombatSandbox;
      expect(window).to.not.have.property('_WB_wombat_location', '_WB_wombat_location should not exist on window');
    });

    it('should not add WB_wombat_location to window', function () {
      const { window } = this.wombatSandbox;
      expect(window).to.not.have.property('WB_wombat_location', 'WB_wombat_location should not exist on window');
    });

    it('should not add __WB_check_loc to window', function () {
      const { window } = this.wombatSandbox;
      expect(window).to.not.have.property('__WB_check_loc', '__WB_check_loc should not exist on window');
    });

    it('should not add __orig_postMessage property on window', function () {
      const { window } = this.wombatSandbox;
      expect(window).to.not.have.property('__orig_postMessage', '__orig_postMessage should not exist on window');
    });

    it('should not add __WB_replay_top to window', function () {
      const { window } = this.wombatSandbox;
      expect(window).to.not.have.property('__WB_replay_top', '__WB_replay_top should not exist on window');
    });

    it('should not add __WB_top_frame to window', function () {
      const { window } = this.wombatSandbox;
      expect(window).to.not.have.property('__WB_top_frame', '__WB_top_frame should not exist on window');
    });

    it('should not add __wb_Date_now to window', function () {
      const { window } = this.wombatSandbox;
      expect(window).to.not.have.property('__wb_Date_now', '__wb_Date_now should not exist on window');
    });

    it('should not expose CustomStorage', function () {
      const { window } = this.wombatSandbox;
      expect(window).to.not.have.property('CustomStorage', 'CustomStorage should not exist on window');
    });

    it('should not expose FuncMap', function () {
      const { window } = this.wombatSandbox;
      expect(window).to.not.have.property('FuncMap', 'FuncMap should not exist on window');
    });

    it('should not expose SameOriginListener', function () {
      const { window } = this.wombatSandbox;
      expect(window).to.not.have.property('SameOriginListener', 'SameOriginListener should not exist on window');
    });

    it('should not expose WrappedListener', function () {
      const { window } = this.wombatSandbox;
      expect(window).to.not.have.property('WrappedListener', 'WrappedListener should not exist on window');
    });

    it('should not add the __WB_pmw property to Object.prototype', function () {
      const { window } = this.wombatSandbox;
      expect(window.Object.prototype.__WB_pmw).to.equal(undefined, 'Object.prototype.__WB_pmw should be undefined');
    });

    it('should not add the WB_wombat_top property to Object.prototype', function () {
      const { window } = this.wombatSandbox;
      expect(window.Object.prototype.WB_wombat_top).to.equal(undefined, 'Object.prototype.WB_wombat_top should be undefined');
      expect(window.Object).to.not.have.own.property('WB_wombat_top');
    });

    it('should not have patched Element.prototype.insertAdjacentHTML', function () {
      const { window } = this.wombatSandbox;
      const elementProto = window.Element.prototype;
      expect(elementProto.insertAdjacentHTML.toString()).to.equal('function insertAdjacentHTML() { [native code] }', 'Element.prototype.insertAdjacentHTML should not have been patched');
    });
  });

  describe('initialization', function () {
    it('should not be possible using the function Wombat a constructor', function () {
      const { window } = this.wombatSandbox;
      expect(() => new window.Wombat(window, window.wbinfo)).to.throw(TypeError, 'window.Wombat is not a constructor');
    });

    it('should not be possible by invoking the function Wombat', function () {
      const { window } = this.wombatSandbox;
      expect(() => window.Wombat(window, window.wbinfo)).to.throw(TypeError, 'window.Wombat is not a function');
    });

    describe('using _WBWombatInit as a plain function', function () {
      beforeEach(async function () {
        await this._$internalHelper.refresh();
      });

      it('should not throw an error', function () {
        const { window } = this.wombatSandbox;
        expect(() => window._WBWombatInit(window.wbinfo)).to.not.throw(TypeError, 'window._WBWombat is not a function');
      });

      it('should not return an object containing the exposed functions', function () {
        const { window } = this.wombatSandbox;
        expect(window._WBWombatInit(window.wbinfo)).to.eq(undefined, 'window._WBWombatInit(window.wbinfo) should not return anything');
      });

      it('should add the property _wb_wombat to the window which is an object containing the exposed functions', function () {
        const { window } = this.wombatSandbox;
        window._WBWombatInit(window.wbinfo);
        expect(window._wb_wombat).to.have.interface({
          actual: Boolean,
          extract_orig: Function,
          rewrite_url: Function,
          watch_elem: Function,
          init_new_window_wombat: Function,
          init_paths: Function,
          local_init: Function
        });
      });
    });
  });

  describe('after initialization', function () {
    before('wombatSetupAfterInitialization', async function () {
      await this._$internalHelper.refreshInit();
    });

    describe('internal globals', function () {
      it('should not have removed _WBWombat from window', function () {
        const { window } = this.wombatSandbox;
        expect(window._WBWombat).to.be.a('function');
        expect(window._WBWombatInit).to.be.a('function');
      });

      it('should add the property __WB_replay_top to window that is equal to the same window', function () {
        const { window } = this.wombatSandbox;
        expect(window).to.have.property('__WB_replay_top').that.is.equal(window);
      });

      it('should define the property __WB_top_frame when it is the top replayed page', function () {
        const { window } = this.wombatSandbox;
        expect(window).to.have.property('__WB_top_frame').that.is.not.equal(undefined, '__WB_top_frame not defined when it is the top replayed page and it should be our window');
      });

      it('should define the WB_wombat_top property on Object.prototype', function () {
        const { window } = this.wombatSandbox;
        expect(window.Object.prototype)
          .to.have.ownPropertyDescriptor('WB_wombat_top')
          .that.has.interface({
          configurable: Boolean,
          enumerable: Boolean,
          get: Function,
          set: Function
        });
      });

      it('should add the _WB_wombat_location property to window', function () {
        const { window } = this.wombatSandbox;
        // eslint-disable-next-line no-unused-expressions
        expect(window._WB_wombat_location).to.not.be.null;
        // eslint-disable-next-line no-unused-expressions
        expect(window.WB_wombat_location).to.not.be.null;
      });

      it('should add the __wb_Date_now property to window', function () {
        const { window } = this.wombatSandbox;
        expect(window).to.have.property('__wb_Date_now').that.is.a('function', '__wb_Date_now should be added a property of window');
      });

      it('should add the __WB_timediff property to window.Date', function () {
        const { window } = this.wombatSandbox;
        expect(window.Date).to.have.property('__WB_timediff').that.is.a('number', '__WB_timediff.Date should be added a property of window');
      });

      it('should persist the original window.postMessage as __orig_postMessage', function () {
        const { window } = this.wombatSandbox;
        expect(window).to.have.property('__orig_postMessage').that.is.a('function');
        expect(window.__orig_postMessage.toString()).to.have.string('[native code]');
      });

      it('should not expose WombatLocation on window', function () {
        const { window } = this.wombatSandbox;
        expect(window, 'WombatLocation should not be exposed directly').to.not.have.property('WombatLocation');
      });
    });

    describe('property descriptor changes', function () {
      const msg = 'should update the or add a property descriptor for';
      window.TestedPropertyDescriptorUpdates.forEach(aTest => {
        aTest.props.forEach(prop => {
          if (aTest.docOrWin) {
            it(
              `${msg} ${aTest.docOrWin}.${prop}`,
              makePropertyDescriptorTest(aTest.docOrWin, prop, aTest.expectedInterface, aTest.skipGet, aTest.skipSet)
            );
          } else if (aTest.objPaths) {
            aTest.objPaths.forEach(objPath => {
              it(
                `${msg} ${objPath.substr(objPath.indexOf('.') + 1)}.${prop}`,
                makePropertyDescriptorTest(objPath, prop, aTest.expectedInterface, aTest.skipGet, aTest.skipSet)
              );
            });
          } else {
            it(
              `${msg} ${aTest.objPath.substr(aTest.objPath.indexOf('.') + 1)}.${prop}`,
              makePropertyDescriptorTest(aTest.objPath, prop, aTest.expectedInterface, aTest.skipGet, aTest.skipSet)
            );
          }
        });
      });
    });

    describe('overrides', function () {
      window.TestFunctionChanges.forEach(aTest => {
        if (aTest.constructors) {
          aTest.constructors.forEach(cnstructor => {
            it(`should update the constructor for ${cnstructor.substr(cnstructor.indexOf('.') + 1)}`, function () {
              const original = window.getViaPath(window.untamperedWithWinDocObj, cnstructor);
              const obj = window.getViaPath(this.wombatSandbox, cnstructor);
              expect(obj.toString()).to.not.equal(original.toString(), `The ${cnstructor} was not updated`);
            });
          });
        } else if (aTest.objPath && aTest.origs) {
          window.zip(aTest.fns, aTest.origs).forEach(([fn, ofn]) => {
            it(`should override ${aTest.objPath.substr(aTest.objPath.indexOf('.') + 1)}.${fn}`, function () {
              const original = window.getViaPath(window.untamperedWithWinDocObj, aTest.objPath);
              const obj = window.getViaPath(this.wombatSandbox, aTest.objPath);
              expect(obj[fn].toString()).to.not.eq(original[fn].toString(), `${aTest.objPath}.${fn} was not updated`);
              expect(obj[ofn].toString()).to.equal(original[fn].toString(), `The persisted original function for ${aTest.objPath}.${fn} does not equal the original`);
            });
          });
        } else if (aTest.fnPath) {
          it(`should override ${aTest.fnPath}`, function () {
            const original = window.getViaPath(window.untamperedWithWinDocObj, aTest.fnPath);
            const fn = window.getViaPath(this.wombatSandbox, aTest.fnPath);
            expect(fn.toString()).to.not.eq(original.toString(), `${aTest.fnPath} was not updated`);
            if (aTest.oPath) {
              const ofnOnfn = window.getViaPath(this.wombatSandbox, aTest.oPath);
              expect(ofnOnfn.toString()).to.eq(original.toString(), `The persisted original function for ${aTest.fnPath} does not match the ordinal`);
            }
          });
        } else {
          if (window.getViaPath(window.untamperedWithWinDocObj, aTest.objPath)) {
            aTest.fns.forEach(fn => {
              it(`should override ${aTest.objPath.substr(aTest.objPath.indexOf('.') + 1)}.${fn}`, function () {
                const original = window.getViaPath(window.untamperedWithWinDocObj, aTest.objPath);
                const obj = window.getViaPath(this.wombatSandbox, aTest.objPath);
                expect(obj[fn].toString()).to.not.eq(original[fn].toString(), `${aTest.objPath}.${fn} was not updated`);
              });
            });
          }
        }
      });
    });

    it('should have sent actual top the loadMSG', function () {
      expect(this.wombatMSGs.size).to.eq(1, 'Wombat should have notified top the page has loaded');
      expect(this.wombatMSGs.numValues('load')).to.eq(2, 'Wombat should have notified top the page has loaded only once');
      expect(this.wombatMSGs.firstValue('load')).to.deep.eq({
          icons: [],
          is_live: false,
          readyState: 'complete',
          request_ts: '20180803160549',
          title: 'Wombat sandbox',
          ts: '20180803160549',
          url: 'https://tests.wombat.io',
          wb_type: 'load'
        },
        'The message sent by wombat to inform top it has loaded should have the correct properties'
      );
    });
  });
});
