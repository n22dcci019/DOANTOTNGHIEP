import React from 'react';

export type BadgeVariant =
  | 'red'     // Nghiêm trọng, Không đạt
  | 'orange'  // Cảnh báo, Vượt ngưỡng
  | 'blue'    // Thông tin, Đang vận chuyển / Đang chạy, Đang hoạt động
  | 'green'   // Trong ngưỡng, Đạt chuẩn, Đúng nhiệt độ
  | 'gray';   // Chờ điều phối duyệt, Chờ xuất phát, Hoàn thành, Rảnh, Đang bảo trì

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; dotColor: string }> = {
  red: {
    bg: 'bg-red-50 text-red-700',
    text: 'text-red-700',
    border: 'border-red-200/80',
    dotColor: 'bg-red-500',
  },
  orange: {
    bg: 'bg-amber-50 text-amber-800',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dotColor: 'bg-amber-500',
  },
  blue: {
    bg: 'bg-sky-50 text-sky-700',
    text: 'text-sky-700',
    border: 'border-sky-200/80',
    dotColor: 'bg-sky-500',
  },
  green: {
    bg: 'bg-emerald-50 text-emerald-700',
    text: 'text-emerald-700',
    border: 'border-emerald-200/80',
    dotColor: 'bg-emerald-500',
  },
  gray: {
    bg: 'bg-slate-100 text-slate-700',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dotColor: 'bg-slate-400',
  },
};

/**
 * Tự động ánh xạ từ khóa nghiệp vụ sang màu theo RULES.md mục 13:
 * - đỏ: Nghiêm trọng, Không đạt
 * - cam: Cảnh báo, Vượt ngưỡng
 * - xanh dương: Thông tin, Đang chạy, Đang vận chuyển, Đang hoạt động
 * - xanh lá: Trong ngưỡng, Đạt chuẩn, Đúng nhiệt độ
 * - xám: Chờ, Hoàn thành, Rảnh, Đang bảo trì, Mất kết nối
 */
export function getVariantFromStatus(status: string): BadgeVariant {
  const s = status.trim().toLowerCase();

  if (s.includes('nghiêm trọng') || s.includes('không đạt') || s.includes('từ chối')) {
    return 'red';
  }
  if (s.includes('tiến sát') || s.includes('cảnh báo') || s.includes('vượt ngưỡng')) {
    return 'orange';
  }
  if (s.includes('trong ngưỡng') || s.includes('đạt chuẩn') || s.includes('đúng nhiệt độ')) {
    return 'green';
  }
  if (s.includes('thông tin') || s.includes('đang vận chuyển') || s.includes('đang hoạt động') || s.includes('đang chạy')) {
    return 'blue';
  }
  return 'gray';
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant,
  className = '',
  dot = true,
}) => {
  const chosenVariant = variant || getVariantFromStatus(label);
  const style = variantStyles[chosenVariant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.bg} ${style.border} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${style.dotColor} shrink-0`}
        />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
};
