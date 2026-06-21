export function reserveContactWindow(openWindow: () => Window | null = () => window.open("about:blank", "_blank")) {
  const reservedWindow = openWindow();
  if (reservedWindow) reservedWindow.opener = null;
  return reservedWindow;
}

export function navigateReservedContactWindow(reservedWindow: Window | null, href: string) {
  if (!reservedWindow || reservedWindow.closed) return false;
  reservedWindow.location.href = href;
  return true;
}

export function closeReservedContactWindow(reservedWindow: Window | null) {
  if (reservedWindow && !reservedWindow.closed) reservedWindow.close();
}

export function toOutlookComposeHref(value: string | undefined) {
  const href = value?.trim();
  if (!href) return undefined;
  if (/^https:\/\//i.test(href) || /^ms-outlook:\/\//i.test(href)) return href;

  const mailtoValue = href.replace(/^mailto:/i, "");
  const [encodedAddress, query = ""] = mailtoValue.split("?", 2);
  let address = encodedAddress;
  try {
    address = decodeURIComponent(encodedAddress);
  } catch {
    return undefined;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return undefined;

  const sourceParams = new URLSearchParams(query);
  const outlookParams = new URLSearchParams({ to: address });
  for (const key of ["subject", "body"] as const) {
    const parameter = sourceParams.get(key);
    if (parameter) outlookParams.set(key, parameter);
  }
  return `ms-outlook://compose?${outlookParams.toString()}`;
}
