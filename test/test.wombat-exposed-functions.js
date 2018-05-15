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

    it('should extract the original url', function () {
      const {window: {_wb_wombat}} = this.wombatSandbox
      const maybeURL = _wb_wombat.extract_orig('http://localhost:3030/jberlin/sw/20180510171123/https://n0tan3rd.github.io/replay_test/')
      expect(maybeURL).to.be.a.url.equal('https://n0tan3rd.github.io/replay_test/')
    })

    it('should not modify an un-rewritten url', function () {
      const {window: {_wb_wombat}} = this.wombatSandbox
      const maybeURL = _wb_wombat.extract_orig('https://n0tan3rd.github.io/replay_test/')
      expect(maybeURL).to.be.a.url.equal('https://n0tan3rd.github.io/replay_test/')
    })

    it('should be able to extract the original url from an Hex (JS) encoded url', function () {
      const encoded = '\x68\x74\x74\x70\x3a\x2f\x2f\x6c\x6f\x63\x61\x6c\x68\x6f\x73\x74\x3a\x33\x30\x33\x30\x2f\x6a\x62\x65\x72\x6c\x69\x6e\x2f\x73\x77\x2f\x32\x30\x31\x38\x30\x35\x31\x30\x31\x37\x31\x31\x32\x33\x2f\x68\x74\x74\x70\x73\x3a\x2f\x2f\x6e\x30\x74\x61\x6e\x33\x72\x64\x2e\x67\x69\x74\x68\x75\x62\x2e\x69\x6f\x2f\x72\x65\x70\x6c\x61\x79\x5f\x74\x65\x73\x74\x2f'
      const {window: {_wb_wombat}} = this.wombatSandbox
      const maybeURL = _wb_wombat.extract_orig(encoded)
      expect(maybeURL).to.be.a.url.equal('https://n0tan3rd.github.io/replay_test/')
    })

    it('should be able to extract the original url from an Octal (JS) encoded url', function () {
      const encoded = '\150\164\164\160\072\057\057\154\157\143\141\154\150\157\163\164\072\063\060\063\060\057\152\142\145\162\154\151\156\057\163\167\057\062\060\061\070\060\065\061\060\061\067\061\061\062\063\057\150\164\164\160\163\072\057\057\156\060\164\141\156\063\162\144\056\147\151\164\150\165\142\056\151\157\057\162\145\160\154\141\171\137\164\145\163\164\057'
      const {window: {_wb_wombat}} = this.wombatSandbox
      const maybeURL = _wb_wombat.extract_orig(encoded)
      expect(maybeURL).to.be.a.url.equal('https://n0tan3rd.github.io/replay_test/')
    })

    it('should be able to extract the original url from an Unicode encoded url', function () {
      const encoded = '\u0068\u0074\u0074\u0070\u003a\u002f\u002f\u006c\u006f\u0063\u0061\u006c\u0068\u006f\u0073\u0074\u003a\u0033\u0030\u0033\u0030\u002f\u006a\u0062\u0065\u0072\u006c\u0069\u006e\u002f\u0073\u0077\u002f\u0032\u0030\u0031\u0038\u0030\u0035\u0031\u0030\u0031\u0037\u0031\u0031\u0032\u0033\u002f\u0068\u0074\u0074\u0070\u0073\u003a\u002f\u002f\u006e\u0030\u0074\u0061\u006e\u0033\u0072\u0064\u002e\u0067\u0069\u0074\u0068\u0075\u0062\u002e\u0069\u006f\u002f\u0072\u0065\u0070\u006c\u0061\u0079\u005f\u0074\u0065\u0073\u0074\u002f'
      const {window: {_wb_wombat}} = this.wombatSandbox
      const maybeURL = _wb_wombat.extract_orig(encoded)
      expect(maybeURL).to.be.a.url.equal('https://n0tan3rd.github.io/replay_test/')
    })

  })
})