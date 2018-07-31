export default class WombatTestUtil {
  constructor () {
    this.addedSandbox = false;
    this.isSandboxReady = false;
  }

  /**
   * @return {Promise<HTMLIFrameElement>}
   */
  addWombatSandbox () {
    console.log('adding wombat sandbox');
    if (!this.addedSandbox) {
      const container = document.getElementById('wombatSandboxContainer');
      const wbif = document.createElement('iframe');
      wbif.src = 'wombatSandbox.html';
      wbif.id = 'wombatSandbox';
      container.appendChild(wbif);
      this.sandbox = wbif;
      this.addedSandbox = true;
      return new Promise((resolve) => {
        this.done = resolve;
      });
    }
    return Promise.resolve(this.sandbox);
  }
  removeWombatSandbox () {
    if (this.addedSandbox) {
      this.sandbox = null;
      document.getElementById('wombatSandbox').remove();
      this.addedSandbox = false;
    }
  }
  sandboxReady () {
    if (this.done) {
      this.done(this.sandbox);
      this.done = null;
    }
  }
  /**
   * @return {Promise<HTMLIFrameElement>}
   */
  refreshSandbox () {
    this.sandbox.contentWindow.location.reload();
    return new Promise((resolve) => {
      this.done = resolve;
    });
  }
}
