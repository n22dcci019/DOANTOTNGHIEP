import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const problems = [];
page.on('pageerror', error => problems.push(error.message));
await mkdir('artifacts/auth', { recursive: true });
try {
  for (const width of [1440, 1280, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 1024 });
    for (const route of ['/login', '/forgot-password', '/reset/expired', '/reset?token=invalid', '/reset/success', '/register']) {
      await page.goto(`http://127.0.0.1:5173${route}`);
      await page.locator('.auth-heading').waitFor();
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      if (dimensions.document > dimensions.viewport) problems.push(`${width} ${route}: overflow ${dimensions.document}`);
      if (width === 1440 || width === 390) await page.screenshot({ path: `artifacts/auth/${width}-${route.replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}.png`, fullPage: true });
    }
  }
  await page.goto('http://127.0.0.1:5173/login');
  await page.getByLabel('Email hoặc tên đăng nhập').fill('khang.thai@coldtrack.vn');
  await page.getByLabel(/^Mật khẩu/).fill('Wrong123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByText('Email hoặc mật khẩu không chính xác.').waitFor();
  console.log(JSON.stringify({ viewportChecks: 30, screenshots: 'artifacts/auth', problems }, null, 2));
  if (problems.length) process.exitCode = 1;
} finally { await browser.close(); }

