const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bofbot", {
  login: (email, password) => ipcRenderer.invoke("auth:login", email, password),
  logout: () => ipcRenderer.invoke("auth:logout"),
  getSession: () => ipcRenderer.invoke("auth:getSession"),
  getPlan: () => ipcRenderer.invoke("plan:get"),
  pickOutputFolder: () => ipcRenderer.invoke("settings:pickFolder"),
  getMediaRoot: () => ipcRenderer.invoke("settings:getMediaRoot"),
  setMediaRoot: (p) => ipcRenderer.invoke("settings:setMediaRoot", p),
  openDashboard: () => ipcRenderer.invoke("shell:openDashboard"),
  openSignup: () => ipcRenderer.invoke("shell:openSignup"),
  openPricing: () => ipcRenderer.invoke("shell:openPricing"),
  openPath: (p) => ipcRenderer.invoke("shell:openPath", p),
  getRecentBatches: () => ipcRenderer.invoke("batch:recent"),
  deleteAllRecentOutput: () =>
    ipcRenderer.invoke("batch:deleteAllRecentOutput"),
  pickVideos: () => ipcRenderer.invoke("batch:pickVideos"),
  processBatch: (payload) => {
    // Plain JSON round-trip so the main process always gets plain objects/arrays (structured
    // clone can drop or mishandle some renderer-side object shapes).
    let plain = payload;
    try {
      plain = JSON.parse(JSON.stringify(payload));
    } catch {
      return Promise.resolve({ ok: false, error: "Invalid batch payload." });
    }
    return ipcRenderer.invoke("batch:process", plain);
  },
  onProgress: (fn) => {
    const channel = "batch:progress";
    const listener = (_e, data) => fn(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onPlanSnapshot: (fn) => {
    const channel = "plan:snapshot";
    const listener = (_e, data) => fn(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  downloadAppUpdate: () => ipcRenderer.invoke("update:download"),
  onUpdateAvailable: (fn) => {
    const channel = "update-available";
    const listener = (_e, data) => fn(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onUpdateError: (fn) => {
    const channel = "update-error";
    const listener = (_e, data) => fn(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onUpdateDownloadProgress: (fn) => {
    const channel = "update-download-progress";
    const listener = (_e, data) => fn(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
