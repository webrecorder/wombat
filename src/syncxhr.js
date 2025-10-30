
export class SyncXHRCache {
  constructor(wombat, orig_url, args, headers) {
    this.syncXHRCachePending = wombat.syncXHRCachePending;
    this.url = args[1];
    this.method = args[0];
    this.headers = headers;
    this.store = wombat.__sessionStorage;
    this.key = this.getKey(orig_url, wombat);
    this.win = wombat.$wbwindow;
  }

  getKey(orig_url, wombat) {
    const url = new URL(orig_url, wombat.$wbwindow.WB_wombat_location.origin);
    for (const name of url.searchParams.keys()) {
      if (name.startsWith('_')) {
        url.searchParams.delete(name);
      }
    }
    return wombat.wb_info.timestamp + '/' + url.href;
  }

  addToStorage(key, dataUri) {
    this.store.setItem('__wb_xhr_data:' + key, dataUri);
    this.syncXHRCachePending.delete(key);
  }

  async fetchToBlob(key) {
    const url = this.url;
    const method = this.method;
    const headers = {...this.headers, 'X-Pywb-Requested-With': 'XMLHttpRequest'};
    const resp = await fetch(url, {method, headers});
    const blob = await resp.blob();

    // convert to data URI using FileReader.readAsDataURL()
    const dataUri = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    if (!this.store) {
      this.syncXHRCachePending.delete(key);
      return;
    }

    try {
      this.addToStorage(key, dataUri);
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        for (const key of Array.from(Object.keys(this.store))) {
          if (key.startsWith('__wb_xhr_data:')) {
            this.store.removeItem(key);
          }
        }
      }
      this.addToStorage(key, dataUri);
    }

    if (!this.syncXHRCachePending.size) {
      this.win.location.reload();
    }
  }

  getCached(args) {
    const dataUri = this.store && this.store.getItem('__wb_xhr_data:' + this.key);
    if (dataUri) {
      args[1] = dataUri;
      args[0] = 'GET';
    } else {
      this.syncXHRCachePending.add(this.key);
      this.fetchToBlob(this.key).catch((e) => console.log(e));
      throw new DOMException('NetworkError', 'Sync XHR not allowed');
    }
  }
}
