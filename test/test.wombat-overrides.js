/* eslint-env mocha */

describe('Wombat overrides', function () {
  before(async function () {
    let wombatIf = await window.wombatTestUtil.addWombatSandbox()
    /**
     * @type {{window: Window | null, document: Document | null}}
     */
    this.wombatSandbox = {
      window: wombatIf.contentWindow,
      document: wombatIf.contentDocument
    }

    const testSelf = this
    this._$internalHelper = {
      validTestTitles: {
        '"before all" hook': true,
        '"before" hook': true
      },
      checkValidCall () {
        if (!this.validTestTitles[testSelf.test.title]) {
          throw new Error(`Invalid usage of internal helpers at ${testSelf.test.title}`)
        }
      },
      async refresh () {
        this.checkValidCall()
        wombatIf = await window.wombatTestUtil.refreshSandbox()
        testSelf.wombatSandbox.window = wombatIf.contentWindow
        testSelf.wombatSandbox.document = wombatIf.contentDocument
      },
      async refreshInit () {
        await this.refresh()
        this.init()
      },
      init () {
        testSelf.wombatSandbox.window._WBWombat(testSelf.wombatSandbox.window, testSelf.wombatSandbox.window.wbinfo)
      }
    }
  })

  after(function () {
    window.wombatTestUtil.removeWombatSandbox()
  })
})