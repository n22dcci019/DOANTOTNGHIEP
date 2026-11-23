import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
try {
  await page.goto('http://127.0.0.1:5174/forgot-password');
  await page.getByLabel('Email', { exact: true }).fill('khang.thai@coldtrack.vn');
  await page.getByRole('button', { name: 'Gửi liên kết đặt lại' }).click();
  await page.getByRole('link', { name: 'Mô phỏng mở liên kết email' }).click();
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('ChangedPass123');
  await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('ChangedPass123');
  await page.screenshot({ path: 'artifacts/auth/1440-reset-valid.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/auth/390-reset-valid.png', fullPage: true });
  for (const width of [1440, 1280, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 1024 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Reset form overflow at ' + width);
  }
  const resetUrl = page.url();
  await page.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click();
  await page.getByRole('link', { name: 'Đăng nhập ngay' }).click();
  await page.getByLabel('Email hoặc tên đăng nhập').fill('khang.thai@coldtrack.vn');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('ChangedPass123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL('**/admin');
  // SPA navigation retains the mock service instance, just as opening the email preview does.
  await page.evaluate(url => { history.pushState({}, '', url); dispatchEvent(new PopStateEvent('popstate')); }, resetUrl);
  await page.getByRole('heading', { name: 'Liên kết đã hết hạn' }).waitFor();
  console.log('PASS: forgot → email preview → reset → success → login with new password; reused token rejected; valid reset form has no horizontal overflow at 5 viewport widths.');
} finally { await browser.close(); }


