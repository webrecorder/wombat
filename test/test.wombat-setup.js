/* eslint-env mocha */

const expect = chai.expect
const log = console.log.bind(console)
// console.log(chai, expect)

describe('Wombat setup', function () {
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

  describe('before initialization', function () {
    it('should put _WBWombat on window', function () {
      const {window} = this.wombatSandbox
      expect(window).to.have.property('_WBWombat').that.is.a('function', '_WBWombat should be placed on window before initialization and should be a function')
    })

    it('should not add __WB_replay_top to window', function () {
      const {window} = this.wombatSandbox
      expect(window).to.not.have.property('__WB_replay_top', '__WB_replay_top should not exist on window')
    })

    it('should not add _WB_wombat_location to window', function () {
      const {window} = this.wombatSandbox
      expect(window).to.not.have.property('_WB_wombat_location', '_WB_wombat_location should not exist on window')
    })

    it('should not add WB_wombat_location to window', function () {
      const {window} = this.wombatSandbox
      expect(window).to.not.have.property('WB_wombat_location', 'WB_wombat_location should not exist on window')
    })

    it('should not add __WB_check_loc to window', function () {
      const {window} = this.wombatSandbox
      expect(window).to.not.have.property('__WB_check_loc', '__WB_check_loc should not exist on window')
    })

    it('should not add __orig_postMessage property on window', function () {
      const {window} = this.wombatSandbox
      expect(window).to.not.have.property('__orig_postMessage', '__orig_postMessage should not exist on window')
    })

    it('should not add __WB_replay_top to window', function () {
      const {window} = this.wombatSandbox
      expect(window).to.not.have.property('__WB_replay_top', '__WB_replay_top should not exist on window')
    })

    it('should not add __WB_top_frame to window', function () {
      const {window} = this.wombatSandbox
      expect(window).to.not.have.property('__WB_top_frame', '__WB_top_frame should not exist on window')
    })

    it('should not add __wb_Date_now to window', function () {
      const {window} = this.wombatSandbox
      expect(window).to.not.have.property('__wb_Date_now', '__wb_Date_now should not exist on window')
    })

    it('should not expose CustomStorage', function () {
      const {window} = this.wombatSandbox
      expect(window).to.not.have.property('CustomStorage', 'CustomStorage should not exist on window')
    })

    it('should not expose FuncMap', function () {
      const {window} = this.wombatSandbox
      expect(window).to.not.have.property('FuncMap', 'FuncMap should not exist on window')
    })

    it('should not expose SameOriginListener', function () {
      const {window} = this.wombatSandbox
      expect(window).to.not.have.property('SameOriginListener', 'SameOriginListener should not exist on window')
    })

    it('should not expose WrappedListener', function () {
      const {window} = this.wombatSandbox
      expect(window).to.not.have.property('WrappedListener', 'WrappedListener should not exist on window')
    })

    it('should not add the __WB_pmw property to Object.prototype', function () {
      const {window} = this.wombatSandbox
      expect(window.Object.prototype.__WB_pmw).to.equal(undefined, 'Object.prototype.__WB_pmw should be undefined')
    })

    it('should not add the WB_wombat_top property to Object.prototype', function () {
      const {window} = this.wombatSandbox
      expect(window.Object.prototype.WB_wombat_top).to.equal(undefined, 'Object.prototype.WB_wombat_top should be undefined')
      expect(window.Object).to.not.have.own.property('WB_wombat_top')
    })

    it('should not have patched Element.prototype.insertAdjacentHTML', function () {
      const { window } = this.wombatSandbox
      const elementProto = window.Element.prototype
      expect(elementProto.insertAdjacentHTML.toString()).to.equal('function insertAdjacentHTML() { [native code] }', 'Element.prototype.insertAdjacentHTML should not have been patched')
    })
  })

  describe('initialization', function () {
    it('should not be possible using the Wombat constructor', function () {
      const {window} = this.wombatSandbox
      expect(() => new window.Wombat(window, window.wbinfo)).to.throw(TypeError, 'window.Wombat is not a constructor')
    })
    it('should be possible using _WBWombat function', function () {
      const {window} = this.wombatSandbox
      const wombat = window._WBWombat(window, window.wbinfo)
      expect(wombat).to.be.a('object').that.has.keys({extract_orig: 'ingnored', rewrite_url:'', watch_elem:'', init_new_window_wombat: '', init_paths: '', local_init: ''})
    })
  })

  describe('after initialization', function () {
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
