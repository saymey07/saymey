import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, Printer, ChevronDown } from 'lucide-react';
import { ExportOptions, exportToExcel, exportToPDF, printReport } from '../utils/exportUtils';

interface ExportButtonProps {
  options: ExportOptions | (() => ExportOptions);
  buttonText?: string;
  variant?: 'primary' | 'secondary' | 'compact';
  className?: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  options,
  buttonText = 'Dışa Aktar',
  variant = 'secondary',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getOptions = (): ExportOptions => {
    return typeof options === 'function' ? options() : options;
  };

  const handleExcel = () => {
    setIsOpen(false);
    exportToExcel(getOptions());
  };

  const handlePDF = () => {
    setIsOpen(false);
    exportToPDF(getOptions());
  };

  const handlePrint = () => {
    setIsOpen(false);
    printReport(getOptions());
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs border ${
          variant === 'primary'
            ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
            : variant === 'compact'
            ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900 py-1 px-2.5'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
        }`}
        title="Listeyi Excel, PDF veya Yazıcı Çıktısı Olarak Dışa Aktar"
      >
        <Download className="w-3.5 h-3.5 text-slate-500" />
        <span>{buttonText}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-white shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in-50 zoom-in-95">
          <div className="px-3 py-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Dışa Aktarma Formatı
          </div>
          
          <button
            type="button"
            onClick={handleExcel}
            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold">Excel İndir</span>
              <span className="text-[10px] text-slate-400">.xlsx tablosu</span>
            </div>
          </button>

          <button
            type="button"
            onClick={handlePDF}
            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-rose-50 hover:text-rose-800 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <FileText className="w-4 h-4 text-rose-600 shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold">PDF İndir</span>
              <span className="text-[10px] text-slate-400">A4 doküman</span>
            </div>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-100"
          >
            <Printer className="w-4 h-4 text-indigo-600 shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold">Yazdır</span>
              <span className="text-[10px] text-slate-400">Yazıcı çıktısı / A4</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
