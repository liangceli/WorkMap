export type VirtualOfficeReadiness = {
  dataLoaded: boolean;
  mapLoaded: boolean;
  mainSceneReady: boolean;
  miniMapReady: boolean;
};

export function isVirtualOfficeInitialRenderReady(readiness: VirtualOfficeReadiness) {
  return readiness.dataLoaded && readiness.mapLoaded && readiness.mainSceneReady && readiness.miniMapReady;
}
