import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const base = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:5173';
const errors = [];
const visit = async (page, route) => { await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, route); };
const login = async email => {
  const page = await browser.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/login'); await page.locator('#email').fill(email); await page.locator('#password').fill('ColdTrack2026');
  await page.locator('button[type="submit"]').click(); await page.waitForURL(url => url.pathname !== '/login'); return page;
};
await mkdir('artifacts/ui-fixes', { recursive: true });
try {
  const admin = await login('khang.thai@coldtrack.vn');
  await admin.locator('.admin-page-heading').waitFor();
  await admin.setViewportSize({ width: 390, height: 900 });
  await admin.waitForFunction(() => document.querySelector('.admin-sidebar')?.inert === true);
  const link = admin.locator('.admin-sidebar nav a').first();
  await link.evaluate(element => element.focus());
  assert.equal(await link.evaluate(element => document.activeElement === element), false, 'Closed mobile sidebar must not receive focus');
  await admin.locator('.admin-menu-toggle').click();
  assert.equal(await admin.locator('.sidebar-mobile-close').evaluate(element => document.activeElement === element), true);
  assert.equal(await admin.locator('.admin-workspace').evaluate(element => element.inert), true);
  const logout = admin.locator('.admin-sidebar-user button'); await logout.focus(); await admin.keyboard.press('Tab');
  assert.equal(await admin.locator('.sidebar-mobile-close').evaluate(element => document.activeElement === element), true, 'Tab must wrap within mobile menu');
  await admin.keyboard.press('Escape');
  assert.equal(await admin.locator('.admin-sidebar').evaluate(element => element.inert), true);
  assert.equal(await admin.locator('.admin-menu-toggle').evaluate(element => document.activeElement === element), true);
  await visit(admin, '/admin/tai-xe'); await admin.getByRole('table').waitFor();
  await admin.getByRole('table').getByRole('button').nth(2).click(); await admin.locator('#managed-min').waitFor();
  for (const width of [1440, 390, 320]) {
    await admin.setViewportSize({ width, height: 1000 });
    const sizes = await admin.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth, main: document.querySelector('main').scrollWidth, available: document.querySelector('main').clientWidth }));
    assert.ok(sizes.page <= sizes.viewport && sizes.main <= sizes.available, JSON.stringify(sizes));
    await admin.screenshot({ path: `artifacts/ui-fixes/${width}-admin-drivers.png` });
  }
  await admin.locator('#managed-min').fill('-18'); await admin.locator('#managed-max').fill('-22');
  await admin.locator('#managed-min').locator('xpath=ancestor::form').locator('button[type="submit"]').click();
  await admin.locator('#managed-min-error').waitFor();
  await admin.screenshot({ path: 'artifacts/ui-fixes/admin-validation.png' });
  await admin.locator('#managed-min').fill('-20'); await admin.locator('#managed-max').fill('-18'); await admin.locator('#managed-reason').fill('Audit verification');
  await admin.locator('#managed-min').locator('xpath=ancestor::form').locator('button[type="submit"]').click();
  await admin.locator('.auth-notice').waitFor();
  await admin.getByRole('button', { name: /Báo sự cố/ }).click();
  const dialog = admin.getByRole('dialog'); await dialog.waitFor();
  await dialog.locator('button[type="submit"]').click(); await admin.locator('#managed-type-error').waitFor();
  await dialog.getByRole('combobox').selectOption('door'); await dialog.locator('#managed-description').fill('Audit incident');
  await admin.screenshot({ path: 'artifacts/ui-fixes/admin-incident.png' });
  await dialog.locator('button[type="submit"]').click(); await dialog.waitFor({ state: 'detached' });
  await admin.getByRole('button', { name: /Hoàn thành chặng/ }).click();
  await dialog.locator('button[type="submit"]').click(); await admin.locator('#finish-reason-error').waitFor();
  await admin.screenshot({ path: 'artifacts/ui-fixes/admin-finish.png' });
  await admin.locator('#finish-reason').fill('Refrigeration incident recorded by dispatch');
  await dialog.locator('button[type="submit"]').click(); await dialog.waitFor({ state: 'detached' });
  assert.equal(await admin.locator('#managed-min').count(), 0, 'Completed trip must leave active management');
  const driver = await login('khoa.tran@coldtrack.vn');
  await driver.locator('#refrigerator-target').waitFor(); assert.equal(await driver.locator('#refrigerator-target').isDisabled(), true);
  assert.equal(await driver.getByRole('button', { name: /Hoàn thành chặng|Báo sự cố/ }).count(), 0);
  for (const width of [1440, 390, 320]) {
    await driver.setViewportSize({ width, height: 1000 });
    assert.equal(await driver.evaluate(() => document.querySelector('main').scrollWidth > document.querySelector('main').clientWidth), false);
    await driver.screenshot({ path: `artifacts/ui-fixes/${width}-driver-sensors.png` });
  }
  const guest = await browser.newPage(); await guest.goto(base + '/unknown-page');
  assert.match(await guest.locator('h1').innerText(), /Không tìm thấy trang/);
  await guest.goto(base + '/login'); assert.equal(await guest.getByRole('button', { name: /Google/ }).count(), 0);
  await guest.goto(base + '/register'); assert.equal(await guest.getByRole('checkbox').count(), 0);
  assert.deepEqual(errors, []); console.log('PASS: sidebar keyboard, admin validation/incident/completion, driver permissions and connection gate, responsive 320/390/1440, auth, 404');
} finally { await browser.close(); }
