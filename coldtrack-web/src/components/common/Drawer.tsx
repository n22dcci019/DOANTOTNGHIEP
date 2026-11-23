import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
interface DrawerProps { isOpen: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; width?: string }
export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, subtitle, children, footer, width = 'max-w-xl' }) => {
  const dialog = useRef<HTMLDivElement>(null); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null; const previousOverflow = document.body.style.overflow;
    const container = dialog.current;
    container?.focus(); document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return; }
      if (event.key !== 'Tab' || !container) return;
      const elements = [...container.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(element => element.getAttribute('aria-hidden') !== 'true');
      const first = elements[0], last = elements.at(-1);
      if (!first) { event.preventDefault(); container.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === container)) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', handleKey); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 overflow-hidden"><div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} aria-hidden="true" /><div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10"><div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`w-screen ${width} bg-white shadow-2xl flex flex-col border-l border-slate-200 outline-none`}><div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/50 gap-3"><div><h2 className="text-lg font-bold text-slate-900">{title}</h2>{subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}</div><button aria-label="Đóng chi tiết" type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"><X className="w-5 h-5" /></button></div><div className="flex-1 overflow-y-auto min-w-0 p-6 space-y-6">{children}</div>{footer && <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 flex-wrap">{footer}</div>}</div></div></div>;
};
