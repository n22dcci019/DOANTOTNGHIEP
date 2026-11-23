import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const problems = []; let checks = 0; const base = 'http://127.0.0.1:5178';
await mkdir('artifacts/landing', { recursive: true });
const page = await browser.newPage({ locale: 'vi-VN' }); page.on('pageerror', error => problems.push(error.message));
const visit = async (target, path) => { await target.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, path); };
try {
  await page.goto(base); await page.getByRole('switch', { name: 'Bật giám sát Kem' }).waitFor();
  if (await page.locator('.admin-sidebar').count()) problems.push('Public page has sidebar');
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => scrollTo(0, 0));
    const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, sections: [...document.querySelectorAll('.landing-page section')].filter(section => section.scrollWidth > innerWidth).map(section => section.id) }));
    if (overflow.document > width || overflow.sections.length) problems.push({ width, overflow }); checks++;
    await page.screenshot({ path: `artifacts/landing/${width}-home.png`, fullPage: true });
    if (width === 1440 || width === 390) await page.screenshot({ path: `artifacts/landing/${width}-viewport.png` });
    if (width <= 768) { await page.getByRole('button', { name: 'Mở menu', exact: true }).click(); await page.getByRole('navigation', { name: 'Menu trang chủ' }).getByRole('link', { name: 'Dịch vụ' }).click(); if (await page.getByRole('button', { name: 'Mở menu', exact: true }).getAttribute('aria-expanded') !== 'false') problems.push('Mobile menu did not close'); }
  }
  await page.getByRole('button', { name: 'Tra cứu', exact: true }).click(); await page.getByText('Vui lòng nhập mã kiện hàng.').waitFor(); await page.getByRole('button', { name: 'CT-2026-0901', exact: true }).click(); await page.getByRole('button', { name: 'Tra cứu', exact: true }).click(); await page.getByRole('article', { name: 'Kết quả tra cứu' }).waitFor();
  const food = page.getByRole('switch', { name: 'Bật giám sát Kem' }); await food.focus(); await page.keyboard.press('Space'); if (await food.isChecked()) problems.push('Keyboard switch failed');
  const question = page.getByRole('button', { name: 'Khách hàng xem được những thông tin nào?' }); await question.focus(); await page.keyboard.press('Enter'); if (await question.getAttribute('aria-expanded') !== 'true') problems.push('FAQ did not expand'); await page.keyboard.press('Enter'); if (await question.getAttribute('aria-expanded') !== 'false') problems.push('FAQ did not collapse');
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.getByRole('article', { name: 'Kết quả tra cứu' }).screenshot({ path: 'artifacts/landing/tracking-result.png' });
  for (const item of [{ email: 'khang.thai@coldtrack.vn', home: '/admin', target: '/admin/lo-hang?status=Hoàn+thành#danh-sach' }, { email: 'an.nguyen@megafood.vn', home: '/kh/lo-hang', target: '/kh/lich-su?ma=CT-2026-0301' }, { email: 'khoa.tran@coldtrack.vn', home: '/tx/chuyen', target: '/tx/canh-bao?view=open' }]) {
    const member = await browser.newPage(); member.on('pageerror', error => problems.push(error.message));
    await member.goto(base + item.target); await member.waitForURL('**/login'); await member.getByLabel('Email hoặc tên đăng nhập').fill(item.email); await member.getByLabel('Mật khẩu', { exact: true }).fill('ColdTrack2026'); await member.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await member.waitForURL(url => url.pathname + decodeURI(url.search) + url.hash === decodeURI(item.target)); checks++;
    for (const guest of ['/login', '/register', '/forgot-password']) { await visit(member, guest); await member.waitForURL(base + item.home); if (await member.locator('.auth-shell').count()) problems.push(`Authenticated guest form visible: ${guest}`); checks++; }
    await visit(member, '/'); await member.getByRole('heading', { name: 'Vận chuyển thực phẩm lạnh, kiểm soát từng độ C' }).waitFor(); const enter = member.getByRole('link', { name: 'Vào hệ thống' }); if (await enter.getAttribute('href') !== item.home) problems.push('Wrong role landing link'); checks++; await member.close();
  }
  console.log(JSON.stringify({ checks, workflows: ['public root without sidebar', 'responsive and mobile navigation', 'empty/sample tracking', 'keyboard food switch', 'keyboard FAQ', 'role-safe return URL', 'authenticated guest guards', 'authenticated landing links'], problems }, null, 2)); if (problems.length) process.exitCode = 1;
} finally { await browser.close(); }
