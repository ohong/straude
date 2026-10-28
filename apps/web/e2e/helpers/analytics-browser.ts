import { devices, expect, type Page } from "@playwright/test";

/** Test browser environment only; app/SDK bot and consent guards stay enabled. */
export const ANALYTICS_BROWSER_USE = {
  userAgent: devices["Desktop Chrome"].userAgent,
  launchOptions: { args: ["--disable-blink-features=AutomationControlled"] },
};

export async function configureAnalyticsBrowser(page: Page) {
  // Chromium's UA override does not replace HeadlessChrome client-hint brands.
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setUserAgentOverride", {
    userAgent: ANALYTICS_BROWSER_USE.userAgent,
    userAgentMetadata: {
      brands: [{ brand: "Chromium", version: ANALYTICS_BROWSER_USE.userAgent.match(/Chrome\/(\d+)/)?.[1] ?? "145" }],
      platform: "Windows", platformVersion: "10.0.0", architecture: "x86", model: "", mobile: false,
    },
  });
}

export async function assertAnalyticsBrowser(page: Page) {
  // Check the real origin: client hints can be absent on about:blank.
  const markers = await page.evaluate(() => {
    const browser = navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } };
    return { webdriver: navigator.webdriver, userAgent: navigator.userAgent,
      brands: browser.userAgentData?.brands?.map(({ brand }) => brand) ?? [] };
  });
  expect(markers.webdriver).toBe(false);
  expect(markers.userAgent).not.toContain("HeadlessChrome");
  expect(markers.brands.every((brand) => !brand.toLowerCase().includes("headless"))).toBe(true);
  return markers;
}
