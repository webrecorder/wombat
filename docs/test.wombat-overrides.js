/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
describe('Wombat overrides', function () {
  const expect = window.chai.expect;
  before(window.initTestContext({ init: true }));

  describe('init_top_frame', function () {
    it('should set __WB_replay_top correctly', function () {
      const { window } = this.wombatSandbox;
      expect(window.__WB_replay_top).to.equal(window, 'The replay top should equal to frames window object');
    });

    it('should set __WB_orig_parent correctly', function () {
      const { window: wbWindow } = this.wombatSandbox;
      expect(wbWindow.__WB_orig_parent).to.equal(window, '__WB_orig_parent should equal the actual top');
    });

    it('should set parent to itself (__WB_replay_top)', function () {
      const { window } = this.wombatSandbox;
      expect(window.parent).to.equal(window.__WB_replay_top, 'parent should equal to itself (__WB_replay_top)');
    });
  });

  describe('WombatLocation', function () {
    it('should be added to window as WB_wombat_location', function () {
      const { window } = this.wombatSandbox;
      expect(window.WB_wombat_location).to.not.be.null;
    });

    window.URLParts.forEach(part => {
      it(`should make available '${part}' on WB_wombat_location`, function () {
        const { window } = this.wombatSandbox;
        const url = new URL(window.wbinfo.url);
        expect(url[part]).to.equal(window.WB_wombat_location[part]);
      });
    });

    it('should have return the href property as the value for toString', function () {
      const { window } = this.wombatSandbox;
      expect(window.WB_wombat_location.toString()).to.equal(window.wbinfo.url);
    });

    it('should have return itself as the value for valueOf', function () {
      const { window } = this.wombatSandbox;
      expect(window.WB_wombat_location.valueOf()).to.equal(window.WB_wombat_location);
    });

    if (typeof self.Symbol !== 'undefined' && typeof self.Symbol.toStringTag !== 'undefined') {
      it('should have a Symbol.toStringTag value of "Location"', function () {
        const { window } = this.wombatSandbox;
        expect(window.WB_wombat_location[self.Symbol.toStringTag]).to.equal(location[self.Symbol.toStringTag]);
      });
    }
  });

  describe('WombatLocation browser navigation control', function () {
    afterEach(async function () {
      await this._$internalHelper.goBackToTest();
    });

    it('should rewrite Location.replace usage', async function () {
      this.wombatSandbox.window.WB_wombat_location.replace('/it');
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(this.wombatSandbox.window.location.href).equal(`${location.protocol}//localhost:${location.port}/20180803160549mp_/https://tests.wombat.io/it`);
    });

    it('should rewrite Location.assign usage', async function () {
      this.wombatSandbox.window.WB_wombat_location.assign('/it');
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(this.wombatSandbox.window.location.href).equal(`${location.protocol}//localhost:${location.port}/20180803160549mp_/https://tests.wombat.io/it`);
    });

    it('should reload the page via Location.reload usage', async function () {
      const loc = this.wombatSandbox.window.location.href;
      this.wombatSandbox.window.WB_wombat_location.reload();
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(this.wombatSandbox.window.location.href).equal(loc);
    });
  });
});

