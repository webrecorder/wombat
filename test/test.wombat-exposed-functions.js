/* eslint-env mocha */

/*
{
      extract_orig: function (href) {
        return wombat.extract_orig(href)
      },
      rewrite_url: function (url, use_rel, mod) {
        return wombat.rewrite_url(url, use_rel, mod)
      },
      watch_elem: function (elem, func) {
        return wombat.watch_elem(elem, func)
      },
      init_new_window_wombat: function (win, src) {
        return wombat.init_new_window_wombat(win, src)
      },
      init_paths: function (wbinfo) {
        wombat.init_paths(wbinfo);
      },
      local_init: function (name) {
        var res = wombat.$wbwindow._WB_wombat_obj_proxy[name];
        if (name === 'document' && res && !res._WB_wombat_obj_proxy) {
          return wombat.init_document_obj_proxy(res) || res
        }
        return res
      }
    }
 */

describe('Wombat exposed functions', function () {
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

  describe('extract_orig', function () {
    before(function () {
      this._$internalHelper.init()
    })
    it('should return an original url', function () {
      const {window: {_wb_wombat}} = this.wombatSandbox
      const maybeURL =
        _wb_wombat.extract_orig('http://localhost:3030/jberlin/sw/20180510171123/https://n0tan3rd.github.io/replay_test/')
      expect(maybeURL).to.be.a.url.with.href('https://n0tan3rd.github.io/replay_test/')
    })
  })
})