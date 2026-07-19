/* eslint-disable @typescript-eslint/no-require-imports */
/* global require */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("workmapAgent", {
  getState: () => ipcRenderer.invoke("agent:get-state"),
  getDiagnostics: () => ipcRenderer.invoke("agent:get-diagnostics"),
  openDiagnosticsFolder: () => ipcRenderer.invoke("agent:open-diagnostics-folder"),
  exportDiagnostics: () => ipcRenderer.invoke("agent:export-diagnostics"),
  pair: (code) => ipcRenderer.invoke("agent:pair", code),
  hide: () => ipcRenderer.invoke("agent:hide"),
  quit: () => ipcRenderer.invoke("agent:quit"),
  openWorkMap: () => ipcRenderer.invoke("agent:open-workmap"),
  onPairProgress: (listener) => {
    const handler = (_event, stage) => listener(stage);
    ipcRenderer.on("agent:pair-progress", handler);
    return () => ipcRenderer.removeListener("agent:pair-progress", handler);
  },
});
