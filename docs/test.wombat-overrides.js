/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
describe('Wombat overrides', function () {
  const expect = window.chai.expect;
  const prefix = window.WB_PREFIX;
  before(window.initTestContext({ init: true }));

  afterEach(async function () {
    this.wombatMSGs.clear();
    await this.$internalHelper.refreshInit();
  });

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
      await this.$internalHelper.goBackToTest();
    });

    it('should rewrite Location.replace usage', async function () {
      this.wombatSandbox.window.WB_wombat_location.replace('/it');
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(this.wombatSandbox.window.location.href).equal(`${window.WB_PREFIX}mp_/https://tests.wombat.io/it`);
    });

    it('should rewrite Location.assign usage', async function () {
      this.wombatSandbox.window.WB_wombat_location.assign('/it');
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(this.wombatSandbox.window.location.href).equal(`${window.WB_PREFIX}mp_/https://tests.wombat.io/it`);
    });

    it('should reload the page via Location.reload usage', async function () {
      const loc = this.wombatSandbox.window.location.href;
      this.wombatSandbox.window.WB_wombat_location.reload();
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(this.wombatSandbox.window.location.href).equal(loc);
    });
  });

  describe('browser history control', function () {
    afterEach(async function () {
      await this.$internalHelper.goBackToTest();
      this.wombatMSGs.clear();
    });

    it('should rewrite history.pushState', function () {
      const { window, originalLocation } = this.wombatSandbox;
      window.history.pushState(null, null, '/it');
      expect(window.location.href).to.equal(`${originalLocation}it`);
      expect(window.WB_wombat_location.href).to.equal('https://tests.wombat.io/it');
    });

    it('should rewrite history.replaceState', async function () {
      const { window, originalLocation } = this.wombatSandbox;
      window.history.replaceState(null, null, '/it2');
      expect(window.location.href).to.equal(`${originalLocation}it2`);
      expect(window.WB_wombat_location.href).to.equal('https://tests.wombat.io/it2');
    });

    it('should send the "replace-url" msg to the top frame on history.pushState usage', async function () {
      const { window } = this.wombatSandbox;
      window.history.pushState(null, null, '/it3');
      await this.delay(1);
      expect(this.wombatMSGs.has('replace-url')).to.be.true;
      expect(this.wombatMSGs.firstValue('replace-url'))
        .to.haveOwnProperty('url')
        .that.equals('https://tests.wombat.io/it3');
    });

    it('should send the "replace-url" msg to the top frame on history.replaceState usage', async function () {
      const { window } = this.wombatSandbox;
      window.history.replaceState(null, null, '/it4');
      await this.delay(1);
      expect(this.wombatMSGs.has('replace-url')).to.be.true;
      expect(this.wombatMSGs.firstValue('replace-url'))
        .to.haveOwnProperty('url')
        .that.equals('https://tests.wombat.io/it4');
    });
  });

  describe('document.title', function () {
    it('should send the "title" messasge to the top frame when document.title is changed', async function () {
      const { document } = this.wombatSandbox;
      document.title = 'abc';
      await this.delay(1);
      expect(this.wombatMSGs.has('title')).to.be.true;
      expect(this.wombatMSGs.firstValue('title'))
        .to.haveOwnProperty('title')
        .that.equals('abc');
    });
  });

  // describe.skip('window.postMessage', function () {
  //   it('should send the "title" messasge to the top frame when document.title is changed', async function () {
  //     const { document } = this.wombatSandbox;
  //     document.title = 'abc';
  //     await this.delay(1);
  //     expect(this.wombatMSGs.has('title')).to.be.true;
  //     expect(this.wombatMSGs.firstValue('title'))
  //       .to.haveOwnProperty('title')
  //       .that.equals('abc');
  //   });
  // });

  describe('document.write', function () {
    afterEach(async function () {
      await this.$internalHelper.refreshInit();
    });

    it('should not perform rewriting when "write" is called with no arguments', function () {
      const { document } = this.wombatSandbox;
      document.write();
      expect(document.documentElement).to.be.null;
    });

    it('should perform rewriting when "write" is called with one argument', function () {
      const { document } = this.wombatSandbox;
      const expectedURL = `${window.WB_PREFIX}mp_/http://example.com`;
      document.write('<a id="it" href="http://example.com">hi</a>');
      expect(document).to.have.elementWithId('it').that.has.rewrittenAttr('href', expectedURL);
      expect(document.body).to.have.rewrittenHTML(`<a id="it" href="${expectedURL}">hi</a>`);
    });

    it('should perform rewriting when "write" is called with multiple arguments', function () {
      const { document } = this.wombatSandbox;
      const expectedURL = `${window.WB_PREFIX}mp_/http://example.com`;
      document.write('<a id="it" href="http://example.com">hi</a>', '<a id="it2" href="http://example.com">hi</a>');
      expect(document).to.have.elementWithId('it').that.has.rewrittenAttr('href', expectedURL);
      expect(document).to.have.elementWithId('it2').that.has.rewrittenAttr('href', expectedURL);
      expect(document.body).to.have.rewrittenHTML(`<a id="it" href="${expectedURL}">hi</a><a id="it2" href="${expectedURL}">hi</a>`);
    });

    it('should perform rewriting when "write" is called with a full string of HTML starting with <!doctype html>', function () {
      const { document } = this.wombatSandbox;
      const unrwHTML = window.fullHTML({});
      document.write(unrwHTML);
      expect(document).to.have.elementWithId('theScript').that.has.rewrittenAttr('src', `${window.WB_PREFIX}js_/http://javaScript.com/script.js`);
      expect(document).to.have.elementWithId('theLink').that.has.rewrittenAttr('href', `${window.WB_PREFIX}cs_/http://cssHeaven.com/angelic.css`);
      expect(document.documentElement).to.have.fullHTMLDoc.equal(unrwHTML);
      expect(document.documentElement).to.have.rewrittenFullHTMLDoc.equal(window.fullHTML({ prefix: window.WB_PREFIX }));
    });

    it('should perform rewriting when "write" is called with a full string of HTML starting with <html>', function () {
      const { document } = this.wombatSandbox;
      const unrwHTML = window.fullHTML({ onlyHTML: true });
      document.write(unrwHTML);
      expect(document).to.have.elementWithId('theScript').that.has.rewrittenAttr('src', `${window.WB_PREFIX}js_/http://javaScript.com/script.js`);
      expect(document).to.have.elementWithId('theLink').that.has.rewrittenAttr('href', `${window.WB_PREFIX}cs_/http://cssHeaven.com/angelic.css`);
      expect(document.documentElement).to.have.htmlDoc.equal(unrwHTML);
      expect(document.documentElement).to.have.rewrittenHTMLDoc.equal(window.fullHTML({ prefix: window.WB_PREFIX, onlyHTML: true }));
    });

    it('should perform rewriting when "write" is called with a full string of HTML starting with <head>', function () {
      const { document } = this.wombatSandbox;
      const unrwHTML = window.fullHTML({ onlyHead: true });
      document.write(unrwHTML);
      expect(document).to.have.elementWithId('theLink').that.has.rewrittenAttr('href', `${window.WB_PREFIX}cs_/http://cssHeaven.com/angelic.css`);
      expect(document.documentElement).to.have.html(unrwHTML);
      expect(document.documentElement).to.have.rewrittenHTML(window.fullHTML({ prefix: window.WB_PREFIX, onlyHead: true }));
    });

    it('should perform rewriting when "write" is called with a full string of HTML starting with <body>', function () {
      const { document } = this.wombatSandbox;
      const unrwHTML = window.fullHTML({ onlyBody: true });
      document.write(unrwHTML);
      expect(document).to.have.elementWithId('theScript').that.has.rewrittenAttr('src', `${window.WB_PREFIX}js_/http://javaScript.com/script.js`);
      expect(document.documentElement).to.have.html(unrwHTML);
      expect(document.documentElement).to.have.rewrittenHTML(window.fullHTML({ prefix: window.WB_PREFIX, onlyBody: true }));
    });
  });

  describe('document.writeln', function () {
    afterEach(async function () {
      await this.$internalHelper.refreshInit();
    });

    it('should not perform rewriting when "writeln" is called with no arguments', function () {
      const { document } = this.wombatSandbox;
      document.writeln();
      expect(document.documentElement).to.be.null;
    });

    it('should perform rewriting when "writeln" is called with one argument', function () {
      const { document } = this.wombatSandbox;
      const expectedURL = `${window.WB_PREFIX}mp_/http://example.com`;
      document.writeln('<a id="it" href="http://example.com">hi</a>');
      expect(document).to.have.elementWithId('it').that.has.rewrittenAttr('href', expectedURL);
      expect(document.body).to.have.rewrittenHTML(`<a id="it" href="${expectedURL}">hi</a>\n`);
    });

    it('should perform rewriting when "writeln" is called with multiple arguments', function () {
      const { document } = this.wombatSandbox;
      const expectedURL = `${window.WB_PREFIX}mp_/http://example.com`;
      document.writeln('<a id="it" href="http://example.com">hi</a>', '<a id="it2" href="http://example.com">hi</a>');
      expect(document).to.have.elementWithId('it').that.has.rewrittenAttr('href', expectedURL);
      expect(document).to.have.elementWithId('it2').that.has.rewrittenAttr('href', expectedURL);
      expect(document.body).to.have.rewrittenHTML(`<a id="it" href="${expectedURL}">hi</a><a id="it2" href="${expectedURL}">hi</a>\n`);
    });

    it('should perform rewriting when "write" is called with a full string of HTML starting with <!doctype html>', function () {
      const { document } = this.wombatSandbox;
      const unrwHTML = window.fullHTML({});
      document.writeln(unrwHTML);
      expect(document).to.have.elementWithId('theScript').that.has.rewrittenAttr('src', `${window.WB_PREFIX}js_/http://javaScript.com/script.js`);
      expect(document).to.have.elementWithId('theLink').that.has.rewrittenAttr('href', `${window.WB_PREFIX}cs_/http://cssHeaven.com/angelic.css`);
      expect(document.documentElement).to.have.fullHTMLDoc.equal(unrwHTML);
      expect(document.documentElement).to.have.rewrittenFullHTMLDoc.equal(window.fullHTML({ prefix: window.WB_PREFIX }));
    });

    it('should perform rewriting when "write" is called with a full string of HTML starting with <html>', function () {
      const { document } = this.wombatSandbox;
      const unrwHTML = window.fullHTML({ onlyHTML: true });
      document.writeln(unrwHTML);
      expect(document).to.have.elementWithId('theScript').that.has.rewrittenAttr('src', `${window.WB_PREFIX}js_/http://javaScript.com/script.js`);
      expect(document).to.have.elementWithId('theLink').that.has.rewrittenAttr('href', `${window.WB_PREFIX}cs_/http://cssHeaven.com/angelic.css`);
      expect(document.documentElement).to.have.htmlDoc.equal(unrwHTML);
      expect(document.documentElement).to.have.rewrittenHTMLDoc.equal(window.fullHTML({ prefix: window.WB_PREFIX, onlyHTML: true }));
    });

    it('should perform rewriting when "write" is called with a full string of HTML starting with <head>', function () {
      const { document } = this.wombatSandbox;
      const unrwHTML = window.fullHTML({ onlyHead: true });
      document.writeln(unrwHTML);
      expect(document).to.have.elementWithId('theLink').that.has.rewrittenAttr('href', `${window.WB_PREFIX}cs_/http://cssHeaven.com/angelic.css`);
      expect(document.documentElement).to.have.html(unrwHTML.replace('">', '">\n'));
      expect(document.documentElement).to.have.rewrittenHTML(window.fullHTML({ prefix: window.WB_PREFIX, onlyHead: true }).replace('">', '">\n'));
    });

    it('should perform rewriting when "write" is called with a full string of HTML starting with <body>', function () {
      const { document } = this.wombatSandbox;
      const unrwHTML = window.fullHTML({ onlyBody: true });
      document.writeln(unrwHTML);
      expect(document).to.have.elementWithId('theScript').that.has.rewrittenAttr('src', `${window.WB_PREFIX}js_/http://javaScript.com/script.js`);
      expect(document.documentElement).to.have.html(unrwHTML);
      expect(document.documentElement).to.have.rewrittenHTML(window.fullHTML({ prefix: window.WB_PREFIX, onlyBody: true }));
    });
  });

  describe('XMLHttpRequest', function () {
    it('should rewrite the URL argument of "open"', async function () {
      const { window } = this.wombatSandbox;
      let reqDone;
      let to;
      const prom = new Promise(resolve => {
        reqDone = resolve;
        to = setTimeout(() => resolve(false), 5000);
      });
      const onLoad = () => {
        clearTimeout(to);
        reqDone(true);
      };
      const xhr = new window.XMLHttpRequest();
      xhr.addEventListener('load', onLoad);
      xhr.open('GET', '/test');
      xhr.send();
      const loaded = await prom;
      if (!loaded) throw new Error('no reply from server in 5 seconds');
      const response = JSON.parse(xhr.responseText);
      expect(response.headers).to.have.ownProperty('x-pywb-requested-with').that.equals('XMLHttpRequest');
      expect(response).to.have.ownProperty('url').that.equals('/live/20180803160549mp_/https://tests.wombat.io/test');
    });

    it('should rewrite the "responseURL" property', async function () {
      const { window } = this.wombatSandbox;
      let reqDone;
      let to;
      const prom = new Promise(resolve => {
        reqDone = resolve;
        to = setTimeout(() => resolve(false), 5000);
      });
      const onLoad = () => {
        clearTimeout(to);
        reqDone(true);
      };
      const xhr = new window.XMLHttpRequest();
      xhr.addEventListener('load', onLoad);
      xhr.open('GET', '/test');
      xhr.send();
      const loaded = await prom;
      if (!loaded) throw new Error('no reply from server in 5 seconds');
      expect(xhr.responseURL).to.be.a.url.that.equals('https://tests.wombat.io/test');
    });
  });

  describe('fetch', function () {
    it('should rewrite the input argument when it is a string (URL)', async function () {
      const { window } = this.wombatSandbox;
      let to;
      let response = await Promise.race([
        window.fetch('/test'),
        new Promise(resolve => {
          to = setTimeout(() => resolve('timed out'), 5000);
        })
      ]);
      if (response === 'timed out') throw new Error('no reply from server in 5 seconds');
      clearTimeout(to);
      const data = await response.json();
      expect(data).to.have.ownProperty('url').that.equals('/live/20180803160549mp_/https://tests.wombat.io/test');
    });

    it('should rewrite the input argument when it is an Request object', async function () {
      const { window } = this.wombatSandbox;
      let to;
      let response = await Promise.race([
        window.fetch(new window.Request('/test', { method: 'GET' })),
        new Promise(resolve => {
          to = setTimeout(() => resolve('timed out'), 5000);
        })
      ]);
      if (response === 'timed out') throw new Error('no reply from server in 5 seconds');
      clearTimeout(to);
      const data = await response.json();
      expect(data).to.have.ownProperty('url').that.equals('/live/20180803160549mp_/https://tests.wombat.io/test');
    });

    it('should rewrite the input argument when it is a object with an href property', async function () {
      const { window } = this.wombatSandbox;
      let to;
      let response = await Promise.race([
        window.fetch({ href: '/test' }),
        new Promise(resolve => {
          to = setTimeout(() => resolve('timed out'), 5000);
        })
      ]);
      if (response === 'timed out') throw new Error('no reply from server in 5 seconds');
      clearTimeout(to);
      const data = await response.json();
      expect(data).to.have.ownProperty('url').that.equals('/live/20180803160549mp_/https://tests.wombat.io/test');
    });
  });

  describe('Request', function () {
    const prefix = window.WB_PREFIX;
    it('should rewrite the input argument to the constructor when it is a string (URL)', async function () {
      const { window } = this.wombatSandbox;
      const req = new window.Request('/test', { method: 'GET' });
      expect(req.url).to.be.a.url.that.equals(`${prefix}mp_/https://tests.wombat.io/test`);
    });

    it('should rewrite the input argument to the constructor when it is an object with a url property', async function () {
      const { window } = this.wombatSandbox;
      const req = new window.Request(new window.Request('/test', { method: 'GET' }));
      expect(req.url).to.be.a.url.that.equals(`${prefix}mp_/https://tests.wombat.io/test`);
    });
  });

  describe('Audio', function () {
    it('should rewrite the URL argument to the constructor', function () {
      const { window } = this.wombatSandbox;
      const audio = new window.Audio('https://music.com/music.mp3');
      expect(audio).to.have.rewrittenAttr('src', `${prefix.substring(prefix.indexOf('/live'))}oe_/https://music.com/music.mp3`);
      expect(audio).to.have.attr('src', 'https://music.com/music.mp3');
    });
  });

  describe('FontFace', function () {
    it('should rewrite the source argument to the constructor', function () {
      const { window } = this.wombatSandbox;
      const fontFace = new window.FontFace('DaFont', 'url(daFont.woff2)');
    });
  });

  describe('Web Workers', function () {
    after(async function () {
      await this.$internalHelper.refreshInit();
    });
    this.timeout(5000);
    it('should rewrite the URL argument to the constructor of "Worker"', async function () {
      const { window } = this.wombatSandbox;
      const worker = new window.Worker('/worker.js');
      await this.delay(2000);
      const res = await fetch('/wasWorkerRequest');
      const data = await res.json();
      expect(data.requested).to.equal('yes');
      worker.terminate();
    });

    it('should rewrite the URL argument to the constructor of "SharedWorker"', async function () {
      const { window } = this.wombatSandbox;
      const worker = new window.SharedWorker('/worker.js');
      await this.delay(2000);
      const res = await fetch('/wasWorkerRequest');
      const data = await res.json();
      expect(data.requested).to.equal('yes');
    });
  });

  describe('Service Worker', function () {
    this.timeout(5000);
    it('should rewrite the URL argument of "navigator.serviceWorker.register"', async function () {
      const { window } = this.wombatSandbox;
      const sw = await window.navigator.serviceWorker.register('/worker.js');
      await sw.unregister();
      expect(sw.scope).to.be.a.url.that.equals(`${prefix}mp_/https://tests.wombat.io/`);
    });
  });

  describe('Text', function () {
    window.TextNodeTest.fnTests.forEach(fn => {
      it(`should rewrite the data argument of "Text.${fn}" when it is a child of a style tag`, function () {
        const { tn, tnParent, cleanUp } = window.TextNodeTest.makeTextNode(this.wombatSandbox.document, true);
        if (fn === 'insertData') {
          tn[fn](0, window.TextNodeTest.theStyle);
        } else if (fn === 'replaceData') {
          tn[fn](0, 0, window.TextNodeTest.theStyle);
        } else {
          tn[fn](window.TextNodeTest.theStyle);
        }
        expect(tnParent).to.have.text(window.TextNodeTest.theStyleRw);
        cleanUp();
      });

      it(`should rewrite the data argument of "Text.${fn}" when it is not a child of a style tag`, function () {
        const { tn, tnParent, cleanUp } = window.TextNodeTest.makeTextNode(this.wombatSandbox.document, false);
        if (fn === 'insertData') {
          tn[fn](0, window.TextNodeTest.theStyle);
        } else if (fn === 'replaceData') {
          tn[fn](0, 0, window.TextNodeTest.theStyle);
        } else {
          tn[fn](window.TextNodeTest.theStyle);
        }
        expect(tnParent).to.have.text(window.TextNodeTest.theStyle);
        cleanUp();
      });
    });
  });

  describe('Assignment of HTMLElement.[innerHTML | outerHTML]', function () {
    window.HTMLAssign.innerOuterHTML.forEach(aTest => {
      it(`should rewrite assignments to ${aTest.which}`, function () {
        const { document } = this.wombatSandbox;
        const div = document.createElement('div');
        document.body.appendChild(div);
        div[aTest.which] = aTest.unrw;
        if (aTest.which === 'outerHTML') {
          expect(document).to.have.elementWithId('oHTML').with.rewrittenOuterHTML.equal(aTest.rw);
          document.getElementById('oHTML').remove();
        } else {
          expect(div).to.have.rewrittenHTML(aTest.rw);
          div.remove();
        }
      });
    });
  });

  describe('Assignment of HTMLIframeElement.srcdoc', function () {
    it(`should rewrite assignments to HTMLIframeElement.srcdoc`, function () {
      const unrw = window.fullHTML({ onlyHTML: true });
      const rw = window.fullHTML({ prefix: window.WB_PREFIX, onlyHTML: true });
      const { document } = this.wombatSandbox;
      const iframe = document.createElement('iframe');
      iframe.srcdoc = unrw;
      expect(iframe).to.have.rewrittenAttr('srcdoc', rw);
    });
  });

  describe('Assignment of HTMLStyleElement.textContent', function () {
    it(`should rewrite assignments to HTMLStyleElement.textContent`, function () {
      const { document } = this.wombatSandbox;
      const style = document.createElement('style');
      style.textContent = window.TextNodeTest.theStyle;
      expect(style.textContent).to.equal(window.TextNodeTest.theStyleRw);
    });
  });

  describe('retrieval of document.[URL, documentURL, baseURI]', function () {
    ['URL', 'documentURI', 'baseURI'].forEach(which => {
      it(`should rewrite retrievals to to document.${which}`, function () {
        expect(this.wombatSandbox.document[which]).to.be.a.url.equal('https://tests.wombat.io/');
      });
    });
  });

  describe('Element.prototype', function () {
    it('should rewrite elements added via "insertAdjacentElement"', function () {
      const div = this.wombatSandbox.document.createElement('div');
      this.wombatSandbox.document.body.appendChild(div);
      const a = window.untamperedWithWinDocObj.document.createElement('a');
      a.href = 'http://example.com';
      a.id = 'aa';
      div.insertAdjacentElement('afterend', a);
      expect(div.nextElementSibling).to.have.rewrittenAttr('href', `${this.testHelpers.baseURLMP}/http://example.com`);
      this.wombatSandbox.document.getElementById('aa').remove();
      div.remove();
    });

    it('should rewrite strings of html added via "insertAdjacentHTML"', function () {
      const div = this.wombatSandbox.document.createElement('div');
      this.wombatSandbox.document.body.appendChild(div);
      div.insertAdjacentHTML('afterend', '<a id="aa" href="http://example.com"></a>');
      expect(div.nextElementSibling).to.have.rewrittenAttr('href', `${this.testHelpers.baseURLMP}/http://example.com`);
      this.wombatSandbox.document.getElementById('aa').remove();
      div.remove();
    });

    window.ElementGetSetAttribute.forEach(aTest => {
      if (aTest.elem === 'link') {
        for (const [as, mod] of Object.entries(window.LinkAsTypes)) {
          it(`should un-rewrite the value returned by getAttribute for the href attribute of <link rel="preload" as="${as}">`, function () {
            const { document } = this.wombatSandbox;
            const elem = document.createElement(aTest.elem);
            elem.rel = 'preload';
            elem.as = as;
            elem.setAttribute(aTest.prop, aTest.unrw);
            expect(elem.getAttribute(aTest.prop)).to.equal(aTest.unrw);
          });

          it(`should un-rewrite the value returned by getAttribute for the href attribute of <link rel="import" as="${as}">`, function () {
            const { document } = this.wombatSandbox;
            const elem = document.createElement(aTest.elem);
            elem.rel = 'preload';
            elem.as = as;
            elem.setAttribute(aTest.prop, aTest.unrw);
            expect(elem.getAttribute(aTest.prop)).to.equal(aTest.unrw);
          });

          it(`should rewrite the value set by setAttribute for the href attribute of <link rel="preload" as="${as}">`, function () {
            const { document } = this.wombatSandbox;
            const elem = document.createElement(aTest.elem);
            elem.rel = 'preload';
            elem.as = as;
            elem.setAttribute(aTest.prop, aTest.unrw);
            expect(elem.getAttribute(aTest.prop)).to.equal(aTest.unrw);
            expect(elem).to.have.rewrittenAttr(aTest.prop, `${prefix}${mod}/${aTest.unrw}`);
          });

          it(`should rewrite the value set by setAttribute for the href attribute of <link rel="import" as="${as}">`, function () {
            const { document } = this.wombatSandbox;
            const elem = document.createElement(aTest.elem);
            elem.rel = 'preload';
            elem.as = as;
            elem.setAttribute(aTest.prop, aTest.unrw);
            expect(elem.getAttribute(aTest.prop)).to.equal(aTest.unrw);
            expect(elem).to.have.rewrittenAttr(aTest.prop, `${prefix}${mod}/${aTest.unrw}`);
          });
        }
      } else {
        window.zip(aTest.props, aTest.unrws).forEach(([prop, unrw]) => {
          it(`should un-rewrite the value returned by getAttribute for ${aTest.elem}.${prop}`, function () {
            const { document } = this.wombatSandbox;
            const elem = document.createElement(aTest.elem);
            elem.setAttribute(prop, unrw);
            expect(elem.getAttribute(prop)).to.equal(prop === 'srcset' ? `${this.testHelpers.baseURLMP}/${unrw}` : unrw);
          });

          it(`should rewrite the value set by setAttribute for ${aTest.elem}.${prop}`, function () {
            const { document } = this.wombatSandbox;
            const elem = document.createElement(aTest.elem);
            elem.setAttribute(prop, unrw);
            expect(elem.getAttribute(prop)).to.equal(prop === 'srcset' ? `${this.testHelpers.baseURLMP}/${unrw}` : unrw);
            expect(elem).to.have.rewrittenAttr(prop, prop === 'srcset' ? `${this.testHelpers.baseURLMP}/${unrw}` : `${prefix}${window.TagToMod[elem.tagName][prop]}/${unrw}`);
          });
        });
      }
    });
  });
});
