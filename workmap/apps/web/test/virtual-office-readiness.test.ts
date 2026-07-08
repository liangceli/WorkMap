import assert from "node:assert/strict";
import test from "node:test";
import { isVirtualOfficeInitialRenderReady } from "../lib/office/virtualOfficeReadiness.js";

const READY = {
  dataLoaded: true,
  mapLoaded: true,
  mainSceneReady: true,
  miniMapReady: true,
};

test("virtual office remains covered until every initial render gate is ready", () => {
  assert.equal(isVirtualOfficeInitialRenderReady(READY), true);

  for (const key of Object.keys(READY) as Array<keyof typeof READY>) {
    assert.equal(
      isVirtualOfficeInitialRenderReady({ ...READY, [key]: false }),
      false,
      `${key} must block the completed office UI`,
    );
  }
});
