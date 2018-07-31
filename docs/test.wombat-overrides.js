/* eslint-env mocha */
describe('Wombat overrides', function () {
  const expect = window.chai.expect;
  before(window.initTestContext({init: true}));

  describe('init_top_frame', function () {
    it('should set __WB_replay_top correctly', function () {
      const {window} = this.wombatSandbox;
      expect(window.__WB_replay_top).to.equal(window, 'The replay top should equal to frames window object');
    });

    it('should set __WB_orig_parent correctly', function () {
      const {window: wbWindow} = this.wombatSandbox;
      expect(wbWindow.__WB_orig_parent).to.equal(window, '__WB_orig_parent should equal the actual top');
    });

    it('should set parent to itself (__WB_replay_top)', function () {
      const {window} = this.wombatSandbox;
      expect(window.parent).to.equal(window.__WB_replay_top, 'parent should equal to itself (__WB_replay_top)');
    });
  });

  describe('WombatLocation', function () {
    it('s', function () {
      const {window} = this.wombatSandbox;
      console.log(window.WB_wombat_location);
    });
  });
});
