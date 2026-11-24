// Optional QA dependency: npm install --prefix .local-data/qa --no-save playwright
const { chromium } = require("../.local-data/qa/node_modules/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const output = path.resolve(__dirname, "../artifacts");
fs.mkdirSync(output, { recursive: true });
async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (err) => errors.push(err.message));
  async function login(phone, role) {
    await page.goto("http://localhost:5173/login");
    await page.locator("#login-phone").fill(phone);
    await page.locator("#login-password").fill("123456");
    await page
      .getByRole("button", { name: "Tizimga kirish", exact: true })
      .click();
    await page.waitForURL(`**/${role}`);
    await page.locator(".page-loading").waitFor({ state: "hidden" });
  }
  async function check(label) {
    await page.waitForTimeout(700);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      `${label}: horizontal overflow`,
    );
    await page.screenshot({
      path: path.join(output, `${label}.png`),
      fullPage: true,
    });
    console.log(`OK ${label}`);
  }
  try {
    if (!process.argv.includes("--mobile-only")) {
      await page.goto("http://localhost:5173/login");
      await page.locator("#login-password").fill("sample");
      await page.getByRole("button", { name: "Parolni ko‘rsatish" }).click();
      assert.equal(
        await page.locator("#login-password").getAttribute("type"),
        "text",
      );
      await page.getByRole("button", { name: "Parolni yashirish" }).click();
      await check("login-desktop");
      await page.setViewportSize({ width: 390, height: 844 });
      await check("login-phone");
      await page.setViewportSize({ width: 1440, height: 1050 });
      await login("900000000", "admin");
      await page.locator('.stats-grid[aria-busy="false"]').waitFor();
      await check("admin-desktop");
      await page
        .getByRole("button", { name: "Yangilash", exact: true })
        .click();
      await page.locator('.stats-grid[aria-busy="false"]').waitFor();
      for (const route of ["users", "groups-subjects", "schedule", "report"]) {
        await page.goto(`http://localhost:5173/admin/${route}`);
        await page.locator(".page-loading").waitFor({ state: "hidden" });
        assert.ok(
          (await page.locator("main").innerText()).trim().length > 30,
          route,
        );
        await check(`admin-${route}`);
      }
      await page.goto("http://localhost:5173/admin");
      await page.locator('.stats-grid[aria-busy="false"]').waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      await check("admin-phone");
      await page.setViewportSize({ width: 768, height: 1024 });
      await check("admin-tablet");
      await page.setViewportSize({ width: 1440, height: 1050 });
      await context.clearCookies();
      await page.evaluate(() => localStorage.clear());
      await login("901000001", "teacher");
      await check("teacher-desktop");
      await page.goto("http://localhost:5173/teacher/stats");
      await page.locator(".page-loading").waitFor({ state: "hidden" });
      await check("teacher-stats");
      await page.evaluate(() => localStorage.clear());
      await login("931000001", "student");
      await check("student-desktop");
      await page.goto("http://localhost:5173/student/attendance");
      await page.locator(".page-loading").waitFor({ state: "hidden" });
      await check("student-attendance");
      // Corrupted persisted state must not prevent the application from loading.
      await page.evaluate(() => {
        localStorage.setItem("oxu_user", "{invalid");
        localStorage.removeItem("oxu_token");
      });
      await page.goto("http://localhost:5173");
      await page.locator("#login-phone").waitFor();
      console.log("OK corrupt cached user recovery");
    }
    await page.goto("http://localhost:8081", { timeout: 120000 });
    await page
      .getByText("Tizimga kirish", { exact: true })
      .waitFor({ timeout: 120000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await check("mobile-expo-login");
    for (const [role, phone, expected] of [
      ["admin", "900000000", "Hisoblar"],
      ["teacher", "901000001", "Haftalik jadval"],
      ["student", "931000001", "Davomatingiz nazorati"],
    ]) {
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.getByPlaceholder("90 000 00 00").fill(phone);
      await page.getByPlaceholder("••••••").fill("123456");
      await page.getByLabel("Kirish", { exact: true }).click();
      await page.getByText(expected, { exact: true }).first().waitFor();
      await check(`mobile-expo-${role}`);
    }
    assert.deepEqual(errors, [], "browser runtime errors");
    console.log("Browser checks passed. Screenshots: artifacts/");
  } finally {
    await browser.close();
  }
}
main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
