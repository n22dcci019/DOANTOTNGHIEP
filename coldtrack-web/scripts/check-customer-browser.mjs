import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ locale: 'vi-VN' }); const problems = []; let checks = 0;
page.on('pageerror', error => problems.push(error.message));
const navigate = async path => { await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, path); await page.locator('.admin-page-heading').waitFor(); };
await mkdir('artifacts/customer', { recursive: true });
try {
  await page.goto('http://127.0.0.1:5176/login');
  await page.getByLabel('Email hoặc tên đăng nhập').fill('an.nguyen@megafood.vn'); await page.getByLabel('Mật khẩu', { exact: true }).fill('ColdTrack2026');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL('**/kh/lo-hang'); await page.locator('.admin-page-heading').waitFor();
  const menu = page.getByRole('navigation', { name: 'Menu chính' }); if (await menu.getByRole('link').count() !== 4) problems.push('Customer sidebar does not have four links.');
  if (await page.getByRole('columnheader', { name: /Tài xế|Biển số|Thiết bị/ }).count()) problems.push('Internal columns exposed.');
  await navigate('/kh/tao-lo-hang');
  await page.getByLabel(/^Điểm lấy hàng/).selectOption('hcm'); await page.getByLabel(/^Điểm giao hàng/).selectOption('ct');
  await page.getByLabel(/^Loại hàng hóa/).selectOption('ice-cream');
  if (await page.getByLabel(/^Nhiệt độ mục tiêu/).inputValue() !== '-22' || await page.getByLabel(/^Dung sai/).inputValue() !== '2') problems.push('Product defaults not applied.');
  await page.getByLabel(/^Khối lượng/).fill('1500'); await page.getByLabel(/^Quy cách đóng gói/).selectOption('Thùng xốp bảo ôn tiêu chuẩn');
  await page.getByLabel(/^Ngày khởi hành/).fill('2026-10-30'); await page.getByLabel(/^Giờ khởi hành/).fill('16:00');
  await page.getByRole('button', { name: 'Lưu nháp' }).click(); await page.getByRole('dialog', { name: 'Tóm tắt bản nháp' }).waitFor();
  const routes = ['/kh/lo-hang', '/kh/lo-hang?ma=CT-2026-0156', '/kh/tao-lo-hang', '/kh/tao-lo-hang/xem-lai', '/kh/lich-su', '/kh/lich-su?ma=CT-2026-0301', '/kh/cai-dat', '/kh/cai-dat?tab=notifications'];
  for (const width of [1440, 1280, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of routes) {
      await navigate(path); if (path.includes('?ma=') || path.includes('/xem-lai')) await page.getByRole('dialog').waitFor();
      const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, content: document.querySelector('.admin-content').scrollWidth, available: document.querySelector('.admin-content').clientWidth }));
      if (size.document > size.viewport || size.content > size.available) problems.push(`${width} ${path}: ${JSON.stringify(size)}`);
      checks++;
      if (width === 1440 || width === 390) await page.screenshot({ path: `artifacts/customer/${width}-${path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`, fullPage: false });
    }
  }
  await navigate('/kh/tao-lo-hang'); await page.getByRole('button', { name: 'Gửi yêu cầu tạo lô hàng' }).click();
  await page.waitForURL('**/kh/lo-hang'); await page.getByText(/Đã gửi yêu cầu tạo lô hàng thành công!/).waitFor();
  await navigate('/kh/lo-hang?ma=CT-2026-0148'); await page.getByText('Không tìm thấy lô hàng thuộc tài khoản của bạn.').waitFor();
  await navigate('/kh/cai-dat?tab=thresholds'); if (await page.getByRole('tab', { name: /Ngưỡng nhiệt/ }).count()) problems.push('Customer threshold tab is exposed.');
  await page.getByLabel('Họ và tên').fill('Nguyễn Văn An cập nhật'); await page.getByRole('button', { name: 'Lưu thay đổi' }).click(); await page.getByText('Thông tin tài khoản đã được cập nhật thành công!').waitFor();
  await page.evaluate(() => { history.pushState({}, '', '/admin'); dispatchEvent(new PopStateEvent('popstate')); }); await page.getByRole('heading', { name: 'Không có quyền truy cập' }).waitFor();
  console.log(JSON.stringify({ checks, workflows: ['customer login and four sidebar items', 'product defaults and draft', 'creation and success redirect', 'foreign shipment hidden', 'customer-only settings', 'admin route denied'], problems }, null, 2));
  if (problems.length) process.exitCode = 1;
} finally { await browser.close(); }

