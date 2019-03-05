self.isFetchOverriden = () => self.fetch.toString().includes('rewrite_url');
self.isImportScriptsOverriden = () =>
  self.importScripts.toString().includes('rewrite_url');
self.isAjaxRewritten = () =>
  self.XMLHttpRequest.prototype.open.toString().includes('rewrite_url');

