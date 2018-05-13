/* eslint-env mocha */

const expect = chai.expect
const log = console.log.bind(console)
// console.log(chai, expect)
describe('wombat setup', function () {
  before(async function () {
    const wombatIf = await window.wombatTestUtil.addWombatSandbox()
    /**
     * @type {{window: Window | null, document: Document | null}}
     */
    this.wombatSandbox = {
      window: wombatIf.contentWindow,
      document: wombatIf.contentDocument,
    }
  })

  context('before initialization', function () {
    it('should put _WBWombat on window', function () {
      const {window} = this.wombatSandbox
      expect(window._WBWombat).to.be.a('function')
    })

    it('should not add internal globals before initialization', function () {
      const {window} = this.wombatSandbox
      expect(window.__WB_replay_top).to.equal(undefined, '__WB_replay_top should not be added to window')
      expect(window._WB_wombat_location).to.equal(undefined, '_WB_wombat_location should not be added to window')
      expect(window.WB_wombat_location).to.equal(undefined, 'WB_wombat_location should not be added to window')
      expect(window.__WB_check_loc).to.equal(undefined, '__WB_check_loc should not be added to window')
      expect(window.__orig_postMessage).to.equal(undefined, '__orig_postMessage should not be added to window')
    })

    it('should not have patched prototypes', function () {
      const {window} = this.wombatSandbox
      expect(window.Object.prototype.__WB_pmw).to.equal(undefined, 'Object.prototype.__WB_pmw should be undefined')
      expect(window.Object.prototype.WB_wombat_top).to.equal(undefined, 'Object.prototype.WB_wombat_top should be undefined')
    })
  })

  context('initialization', function () {
    it('should not be possible using the Wombat constructor', function () {
      const {window} = this.wombatSandbox
      expect(() => new window.Wombat).to.throw(TypeError, 'window.Wombat is not a constructor')
    })
  })

  context('after initialization', function () {
    it('should not have removed _WBWombat from window', function () {
      const {window} = this.wombatSandbox
      expect(window._WBWombat).to.be.a('function')
    })
    it('should have added WombatLocation to window', function () {
      const {window} = this.wombatSandbox
      expect(window._WBWombat).to.be.a('function')
    })
  })
})
