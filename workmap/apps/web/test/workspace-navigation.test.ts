import assert from "node:assert/strict";
import test from "node:test";
import {
  getVirtualOfficeNavigationItemsForRole,
  getWorkspaceNavigationItemsForRole,
  toWorkflowRole,
} from "../lib/navigation/workspaceNavigation.js";

const hrefs = (items: ReturnType<typeof getWorkspaceNavigationItemsForRole>) => items.map((item) => item.href);

test("workspace navigation exposes the role-appropriate tabs", () => {
  assert.deepEqual(hrefs(getWorkspaceNavigationItemsForRole("EMPLOYEE")), [
    "/employees",
    "/compliance",
    "/virtual-office",
  ]);
  assert.deepEqual(hrefs(getWorkspaceNavigationItemsForRole("MANAGER")), [
    "/employees",
    "/dashboard",
    "/reports",
    "/compliance",
    "/virtual-office",
  ]);
  assert.deepEqual(hrefs(getWorkspaceNavigationItemsForRole("OWNER")), [
    "/employees",
    "/dashboard",
    "/reports",
    "/compliance",
    "/virtual-office",
    "/onboarding/invite",
    "/integrations",
    "/settings",
  ]);
  assert.deepEqual(hrefs(getWorkspaceNavigationItemsForRole("IT_ADMIN")), [
    "/employees",
    "/reports",
    "/compliance",
    "/virtual-office",
    "/integrations",
    "/settings",
  ]);
});

test("virtual office dropdown uses the same role rules and omits the current office page", () => {
  assert.deepEqual(hrefs(getVirtualOfficeNavigationItemsForRole("EMPLOYEE")), ["/employees", "/compliance"]);
  assert.equal(
    getVirtualOfficeNavigationItemsForRole("EMPLOYEE").some((item) => item.href === "/reports"),
    false,
  );
  assert.equal(
    getVirtualOfficeNavigationItemsForRole("OWNER").some((item) => item.href === "/reports"),
    true,
  );
  assert.equal(
    getVirtualOfficeNavigationItemsForRole("OWNER").some((item) => item.href === "/virtual-office"),
    false,
  );
});

test("backend role aliases map to the navigation role model", () => {
  assert.equal(toWorkflowRole("TEAM_LEAD"), "MANAGER");
  assert.equal(toWorkflowRole("HR_ADMIN"), "MANAGER");
  assert.equal(toWorkflowRole("OWNER"), "OWNER");
  assert.equal(toWorkflowRole("IT_ADMIN"), "IT_ADMIN");
  assert.equal(toWorkflowRole("EMPLOYEE"), "EMPLOYEE");
});
