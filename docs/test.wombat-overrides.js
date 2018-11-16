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

  describe('init_wombat_loc', function () {
    it('should add WB_wombat_location to window', function () {
      const { window } = this.wombatSandbox;
      expect(window.WB_wombat_location).to.not.be.null;
    });

    it('should add the correct property values to WB_wombat_location', function () {
      const { window } = this.wombatSandbox;
      const url = new URL(window.wbinfo.url);
      console.log(url);
      console.log(Object.keys(url));
      for (const prop of Object.keys(url)) {
        console.log(prop);
      }
    });
  });
});
