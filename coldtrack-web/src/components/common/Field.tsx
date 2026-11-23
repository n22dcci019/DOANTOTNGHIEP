import React from 'react';

interface FieldProps {
  label: string;
  value?: string | number;
  readOnly?: boolean;
  required?: boolean;
  type?: string;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  helperText?: string;
  unit?: string;
  icon?: React.ReactNode;
  className?: string;
  multiline?: boolean;
  rows?: number;
}

export const Field: React.FC<FieldProps> = ({
  label,
  value,
  readOnly = false,
  required = false,
  type = 'text',
  placeholder,
  onChange,
  error,
  helperText,
  unit,
  icon,
  className = '',
  multiline = false,
  rows = 3,
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
        <span>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </span>
        {readOnly && (
          <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded">
            Chỉ đọc
          </span>
        )}
      </label>

      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3 text-slate-400 flex items-center pointer-events-none">
            {icon}
          </div>
        )}

        {multiline ? (
          <textarea
            value={value ?? ''}
            readOnly={readOnly}
            disabled={readOnly}
            placeholder={placeholder}
            onChange={onChange}
            rows={rows}
            className={`w-full text-sm rounded-xl transition-all duration-150 outline-none p-3 ${
              readOnly
                ? 'bg-slate-100 text-slate-800 border-none cursor-default font-medium'
                : 'bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900 shadow-sm'
            } ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
          />
        ) : (
          <input
            type={type}
            value={value ?? ''}
            readOnly={readOnly}
            disabled={readOnly}
            placeholder={placeholder}
            onChange={onChange}
            className={`w-full text-sm rounded-xl transition-all duration-150 outline-none ${
              icon ? 'pl-9' : 'pl-3.5'
            } ${unit ? 'pr-12' : 'pr-3.5'} py-2.5 ${
              readOnly
                ? 'bg-slate-100 text-slate-800 border-none cursor-default font-medium'
                : 'bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900 shadow-sm'
            } ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
          />
        )}

        {unit && !multiline && (
          <span className="absolute right-3.5 text-xs font-semibold text-slate-500 pointer-events-none">
            {unit}
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
};
