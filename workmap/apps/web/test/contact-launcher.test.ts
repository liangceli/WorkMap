import assert from "node:assert/strict";
import test from "node:test";
import { closeReservedContactWindow, navigateReservedContactWindow, reserveContactWindow, toOutlookComposeHref } from "../components/office/contactLauncher.js";

test("email launcher reserves a separate window and never replaces WorkMap", () => {
  let closed = false;
  const popup = {
    closed: false,
    opener: {} as unknown,
    location: { href: "about:blank" },
    close: () => { closed = true; },
  } as unknown as Window;

  const reserved = reserveContactWindow(() => popup);
  assert.equal(reserved, popup);
  assert.equal(popup.opener, null);
  assert.equal(navigateReservedContactWindow(reserved, "mailto:employee@example.com"), true);
  assert.equal(popup.location.href, "mailto:employee@example.com");
  closeReservedContactWindow(reserved);
  assert.equal(closed, true);
});

test("mailto contact is converted to the Outlook application compose protocol", () => {
  assert.equal(
    toOutlookComposeHref("mailto:employee%40example.com?subject=Hello"),
    "ms-outlook://compose?to=employee%40example.com&subject=Hello",
  );
  assert.equal(toOutlookComposeHref("employee@example.com"), "ms-outlook://compose?to=employee%40example.com");
  assert.equal(toOutlookComposeHref("https://outlook.office.com/mail/deeplink/compose?to=employee@example.com"), "https://outlook.office.com/mail/deeplink/compose?to=employee@example.com");
  assert.equal(toOutlookComposeHref("javascript:alert(1)"), undefined);
});

test("blocked pop-up fails without navigating the current page", () => {
  assert.equal(reserveContactWindow(() => null), null);
  assert.equal(navigateReservedContactWindow(null, "mailto:employee@example.com"), false);
});
