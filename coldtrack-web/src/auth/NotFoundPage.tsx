import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';

export function NotFoundPage() {
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <section className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
      <SearchX size={40} className="mx-auto text-slate-500 mb-5" aria-hidden="true" />
      <p className="text-sm text-slate-600 mb-3">Mã lỗi: 404</p>
      <h1 className="text-2xl font-bold text-slate-900 mb-3">Không tìm thấy trang</h1>
      <p className="text-slate-600 mb-6">Đường dẫn không tồn tại hoặc đã được thay đổi. Hãy kiểm tra lại địa chỉ hoặc quay về trang chủ.</p>
      <Link to="/" className="inline-flex items-center justify-center rounded-lg bg-blue-600 text-white px-5 py-3">Về trang chủ</Link>
    </section>
  </main>;
}
