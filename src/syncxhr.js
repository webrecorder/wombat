export class SyncXHRCache {
  constructor(wombat, orig_url, args, headers) {
    this.syncXHRCachePending = wombat.syncXHRCachePending;
    this.url = args[1];
    this.method = args[0];
    this.headers = headers;
    this.store = wombat.__sessionStorage;
    this.key = this.getKey(orig_url, wombat);
    this.win = wombat.$wbwindow;
    this.reload_url = wombat.wb_info.prefix + wombat.wb_info.request_ts + "mp_/" + wombat.wb_info.url;
  }

  getKey(orig_url, wombat) {
    const url = new URL(orig_url, wombat.$wbwindow.WB_wombat_location.origin);
    for (const name of url.searchParams.keys()) {
      if (name.startsWith('_')) {
        url.searchParams.delete(name);
      }
    }
    return url.href;
    //return wombat.wb_info.timestamp + '/ ' + url.href;
  }

  addToStorage(hash, dataUri) {
    if (!this.store.getItem('__wb_xhr_data:hash:' + hash)) {
      this.store.setItem('__wb_xhr_data:hash:' + hash, dataUri);
    }
    this.store.setItem('__wb_xhr_data:url:' + this.key, hash);
    this.syncXHRCachePending.delete(this.key);
  }

  getFromStorage() {
    if (!this.store) {
      return;
    }
    const hash = this.store.getItem('__wb_xhr_data:url:' + this.key);
    if (!hash) {
      return;
    }
    return this.store.getItem('__wb_xhr_data:hash:' + hash);
  }

  async fetchToBlob() {
    const url = this.url;
    const method = this.method;
    const headers = {...this.headers, 'X-Pywb-Requested-With': 'XMLHttpRequest'};
    const resp = await fetch(url, {method, headers});
    const blob = await resp.blob();

    // use etag if available
    let hash = resp.headers.get("x-archive-orig-etag");
    if (!hash) {
      try {
        const buff = await crypto.subtle.digest('SHA-1', await blob.arrayBuffer());
        const hashArray = Array.from(new Uint8Array(buff));
        hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        console.log(e);
        return;
      }
    }

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
      this.syncXHRCachePending.delete(this.key);
      return;
    }

/*
    let hash = 0;

    for (let i = 0; i < blob.size; i += 1024 * 16) {
      const slice = blob.slice(i, i + 1024 * 16);
      hash = hash32(new Uint8Array(await slice.arrayBuffer()), hash);
    }
*/
    try {
      this.addToStorage(hash, dataUri);
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        for (const key of Array.from(Object.keys(this.store))) {
          if (key.startsWith('__wb_xhr_data:')) {
            this.store.removeItem(key);
          }
        }
      }
      this.addToStorage(hash, dataUri);
    }

    if (!this.syncXHRCachePending.size) {
      this.win.location.href = this.reload_url;
    }
  }

  getCached(args) {
    const dataUri = this.getFromStorage();
    if (dataUri) {
      args[1] = dataUri;
      args[0] = 'GET';
    } else {
      this.syncXHRCachePending.add(this.key);
      this.fetchToBlob().catch((e) => console.log(e));
      throw new DOMException('NetworkError', 'Sync XHR not allowed');
    }
  }
}
