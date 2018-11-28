/* eslint-env mocha */

describe('Wombat exposed functions', function () {

  const funkyEncodings = [
    {
      howEncoded: 'Octal',
      unrw: '\150\164\164\160\163\072\057\057\156\060\164\141\156\063\162\144\056\147\151\164\150\165\142\056\151\157\057\162\145\160\154\141\171\137\164\145\163\164\057',
      rw: '\150\164\164\160\072\057\057\154\157\143\141\154\150\157\163\164\072\063\060\063\060\057\152\142\145\162\154\151\156\057\163\167\057\062\060\061\070\060\065\061\060\061\067\061\061\062\063\057\150\164\164\160\163\072\057\057\156\060\164\141\156\063\162\144\056\147\151\164\150\165\142\056\151\157\057\162\145\160\154\141\171\137\164\145\163\164\057',
      plain: 'https://n0tan3rd.github.io/replay_test/'
    },
    {
      howEncoded: 'Hex',
      unrw: '\x68\x74\x74\x70\x73\x3a\x2f\x2f\x6e\x30\x74\x61\x6e\x33\x72\x64\x2e\x67\x69\x74\x68\x75\x62\x2e\x69\x6f\x2f\x72\x65\x70\x6c\x61\x79\x5f\x74\x65\x73\x74\x2f',
      rw: '\x68\x74\x74\x70\x3a\x2f\x2f\x6c\x6f\x63\x61\x6c\x68\x6f\x73\x74\x3a\x33\x30\x33\x30\x2f\x6a\x62\x65\x72\x6c\x69\x6e\x2f\x73\x77\x2f\x32\x30\x31\x38\x30\x35\x31\x30\x31\x37\x31\x31\x32\x33\x2f\x68\x74\x74\x70\x73\x3a\x2f\x2f\x6e\x30\x74\x61\x6e\x33\x72\x64\x2e\x67\x69\x74\x68\x75\x62\x2e\x69\x6f\x2f\x72\x65\x70\x6c\x61\x79\x5f\x74\x65\x73\x74\x2f',
      plain: 'https://n0tan3rd.github.io/replay_test/'
    },
    {
      howEncoded: 'Unicode',
      unrw: '\u0068\u0074\u0074\u0070\u0073\u003a\u002f\u002f\u006e\u0030\u0074\u0061\u006e\u0033\u0072\u0064\u002e\u0067\u0069\u0074\u0068\u0075\u0062\u002e\u0069\u006f\u002f\u0072\u0065\u0070\u006c\u0061\u0079\u005f\u0074\u0065\u0073\u0074\u002f',
      rw: '\u0068\u0074\u0074\u0070\u003a\u002f\u002f\u006c\u006f\u0063\u0061\u006c\u0068\u006f\u0073\u0074\u003a\u0033\u0030\u0033\u0030\u002f\u006a\u0062\u0065\u0072\u006c\u0069\u006e\u002f\u0073\u0077\u002f\u0032\u0030\u0031\u0038\u0030\u0035\u0031\u0030\u0031\u0037\u0031\u0031\u0032\u0033\u002f\u0068\u0074\u0074\u0070\u0073\u003a\u002f\u002f\u006e\u0030\u0074\u0061\u006e\u0033\u0072\u0064\u002e\u0067\u0069\u0074\u0068\u0075\u0062\u002e\u0069\u006f\u002f\u0072\u0065\u0070\u006c\u0061\u0079\u005f\u0074\u0065\u0073\u0074\u002f',
      plain: 'https://n0tan3rd.github.io/replay_test/'
    }
  ];

  before(window.initTestContext());

  describe('extract_orig', function () {
    before(async function () {
      await this._$internalHelper.refreshInit();
    });

    it('should extract the original url', function () {
      const {window: {_wb_wombat}} = this.wombatSandbox;
      const maybeURL = _wb_wombat.extract_orig('http://localhost:3030/jberlin/sw/20180510171123/https://n0tan3rd.github.io/replay_test/');
      expect(maybeURL).to.be.a.url.equal('https://n0tan3rd.github.io/replay_test/');
    });

    it('should not modify an un-rewritten url', function () {
      const {window: {_wb_wombat}} = this.wombatSandbox;
      const maybeURL = _wb_wombat.extract_orig('https://n0tan3rd.github.io/replay_test/');
      expect(maybeURL).to.be.a.url.equal('https://n0tan3rd.github.io/replay_test/');
    });

    funkyEncodings.forEach(encoding => {
      it(`should be able to extract the original url from an ${encoding.howEncoded} encoded url`, function () {
        const {window: {_wb_wombat}} = this.wombatSandbox;
        const maybeURL = _wb_wombat.extract_orig(encoding.rw);
        expect(maybeURL).to.be.a.url.equal(encoding.plain);
        expect(maybeURL).to.be.a.url.equal(encoding.unrw);
      });
    });
  });

  describe('rewrite_url', function () {
    before(async function () {
      await this._$internalHelper.refreshInit();
    });

    funkyEncodings.forEach(encoding => {
      it(`should be able to rewrite an ${encoding.howEncoded} encoded url`, function () {
        const {window} = this.wombatSandbox;
        const maybeURL = window._wb_wombat.rewrite_url(encoding.unrw);
        expect(maybeURL).to.be.a.url.equal(`${window.wbinfo.prefix}${window.wbinfo.wombat_ts}${window.wbinfo.mod}/${encoding.plain}`);
      });
    });
  })
});