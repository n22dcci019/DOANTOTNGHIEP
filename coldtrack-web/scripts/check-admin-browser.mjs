import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage(); const problems = []; const base = 'http://127.0.0.1:5175';
page.on('pageerror', error => problems.push(error.message));
const navigate = async path => { await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, path); await page.locator('.admin-page-heading').waitFor(); };
await mkdir('artifacts/admin', { recursive: true });
try {
  await page.goto(`${base}/login`);
  await page.getByLabel('Email hoặc tên đăng nhập').fill('khang.thai@coldtrack.vn');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('ColdTrack2026');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL('**/admin'); await page.locator('.admin-page-heading').waitFor();
  const routes = ['/admin', '/admin/lo-hang', '/admin/lo-hang/CT-2026-0156', '/admin/lo-hang?status=Chờ+điều+phối+duyệt', '/admin/lo-hang/CT-2026-0401/duyet', '/admin/canh-bao', '/admin/canh-bao/CB-2026-001', '/admin/xe', '/admin/xe/xe-01', '/admin/lich-su', '/admin/lich-su/CT-2026-0301', '/admin/nhat-ky', '/admin/cai-dat', '/admin/cai-dat?tab=notifications', '/admin/cai-dat?tab=thresholds'];
  let checks = 0;
  for (const width of [1440, 1280, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of routes) {
      await navigate(path);
      if (/\/CT-|\/xe-01|\/CB-/.test(path.split('?')[0])) await page.getByRole('dialog').waitFor();
      const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, main: document.querySelector('.admin-content')?.scrollWidth, available: document.querySelector('.admin-content')?.clientWidth }));
      if (overflow.document > overflow.viewport || overflow.main > overflow.available) problems.push(`${width} ${path}: ${JSON.stringify(overflow)}`);
      checks++;
      if (width === 1440 || width === 390) await page.screenshot({ path: `artifacts/admin/${width}-${path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`, fullPage: true });
    }
  }
  await navigate('/admin/lo-hang'); await page.getByRole('textbox', { name: 'Tìm kiếm', exact: true }).fill('khong-ton-tai'); await page.getByText('Không tìm thấy dữ liệu').waitFor();
  await navigate('/admin/lo-hang/CT-2026-0401/duyet');
  await page.getByRole('combobox', { name: 'Xe chỉ định' }).selectOption('xe-ranh-01');
  await page.getByRole('combobox', { name: 'Tài xế phụ trách' }).selectOption('driver-free-01');
  await page.getByRole('button', { name: 'Duyệt & phân công', exact: true }).click();
  await page.getByRole('dialog', { name: 'Chi tiết lô hàng CT-2026-0401' }).waitFor();
  await navigate('/admin/canh-bao/CB-2026-001');
  await page.getByRole('textbox', { name: 'Ghi chú xử lý' }).fill('Đã liên hệ tài xế kiểm tra dàn lạnh.');
  await page.getByRole('button', { name: 'Đánh dấu đã xử lý' }).click(); await page.getByText('Đã xử lý cảnh báo', { exact: true }).waitFor();
  await navigate('/admin/cai-dat?tab=thresholds');
  await page.getByRole('textbox', { name: 'Lý do thay đổi' }).fill('Cập nhật cấu hình cho đơn mới');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await page.getByText('Đã lưu ngưỡng nhiệt độ. Áp dụng cho đơn tạo sau thời điểm này.').waitFor();
  console.log(JSON.stringify({ checks, workflows: ['search empty state', 'approve assignment', 'resolve alert', 'save thresholds'], problems }, null, 2));
  if (problems.length) process.exitCode = 1;
} finally { await browser.close(); }
