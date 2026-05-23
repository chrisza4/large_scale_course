import { test, expect } from "@playwright/test";

test("single player sees current value on connect", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("current-value")).toBeVisible();
});

test("submitting a number updates own display", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("number-input").fill("42");
  await page.getByTestId("send-button").click();
  await expect(page.getByTestId("current-value")).toHaveText("42");
});

test("real-time broadcast to second player", async ({ browser }) => {
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  await page1.goto("/");
  await page2.goto("/");

  await page1.getByTestId("number-input").fill("99");
  await page1.getByTestId("send-button").click();

  await expect(page2.getByTestId("current-value")).toHaveText("99");

  await ctx1.close();
  await ctx2.close();
});

test("last-write-wins: second sender's value is shown on both pages", async ({ browser }) => {
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  await page1.goto("/");
  await page2.goto("/");

  await page1.getByTestId("number-input").fill("10");
  await page1.getByTestId("send-button").click();
  await expect(page1.getByTestId("current-value")).toHaveText("10");

  await page2.getByTestId("number-input").fill("20");
  await page2.getByTestId("send-button").click();

  await expect(page1.getByTestId("current-value")).toHaveText("20");
  await expect(page2.getByTestId("current-value")).toHaveText("20");

  await ctx1.close();
  await ctx2.close();
});
