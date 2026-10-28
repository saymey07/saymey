import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  header: string;
  dataKey: string;
  width?: number; // approx width for print/pdf
  align?: 'left' | 'center' | 'right';
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  columns: ExportColumn[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  summaryRows?: { label: string; value: string }[];
  orientation?: 'portrait' | 'landscape';
}

// Türkçe karakterleri PDF standart fontları için güvenli hale getirme yardımcısı
function sanitizeTurkishChars(str: string): string {
  if (!str) return '';
  return String(str);
}

/**
 * Excel (.xlsx) formatında indirme
 */
export function exportToExcel(options: ExportOptions) {
  try {
    const { title, subtitle, filename, columns, data, summaryRows } = options;

    // Excel satırları oluştur
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[][] = [];

    // Başlık ve Alt Başlık
    rows.push([title]);
    if (subtitle) {
      rows.push([subtitle]);
    }
    rows.push([`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`]);
    rows.push([]); // Boş satır

    // Sütun Başlıkları
    const headers = columns.map(c => c.header);
    rows.push(headers);

    // Veri Satırları
    data.forEach((item, index) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: any[] = [];
      columns.forEach(col => {
        if (col.dataKey === '__index') {
          row.push(index + 1);
        } else {
          const val = item[col.dataKey];
          row.push(val !== undefined && val !== null ? val : '');
        }
      });
      rows.push(row);
    });

    // Özet Satırları
    if (summaryRows && summaryRows.length > 0) {
      rows.push([]); // Boş satır
      summaryRows.forEach(s => {
        const sumRow = new Array(columns.length).fill('');
        sumRow[0] = s.label;
        sumRow[1] = s.value;
        rows.push(sumRow);
      });
    }

    // Worksheet oluştur
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Sütun genişliklerini hesapla
    const colWidths = columns.map((col) => {
      let maxLen = col.header.length;
      data.forEach(item => {
        const val = String(item[col.dataKey] || '');
        if (val.length > maxLen) maxLen = Math.min(val.length, 45);
      });
      return { wch: Math.max(maxLen + 3, 12) };
    });
    ws['!cols'] = colWidths;

    // Workbook oluştur ve indir
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rapor');

    const cleanFilename = (filename || 'rapor').endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(wb, cleanFilename);
  } catch (error) {
    console.error('Excel export error:', error);
    alert('Excel dosyası oluşturulurken bir hata oluştu.');
  }
}

/**
 * jsPDF + autoTable ile PDF indirme
 */
export function exportToPDF(options: ExportOptions) {
  try {
    const { 
      title, 
      subtitle, 
      filename, 
      columns, 
      data, 
      summaryRows, 
      orientation = 'landscape' 
    } = options;

    const doc = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4',
    });

    // Başlık
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(sanitizeTurkishChars(title), 14, 15);

    let currentY = 21;
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(sanitizeTurkishChars(subtitle), 14, currentY);
      currentY += 5;
    }

    // Tarih
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120);
    const dateText = `Tarih: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(dateText, 14, currentY);
    currentY += 4;

    // Tablo verisi
    const tableHeaders = columns.map(c => sanitizeTurkishChars(c.header));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableBody = data.map((item, idx) => {
      return columns.map(col => {
        if (col.dataKey === '__index') return String(idx + 1);
        const val = item[col.dataKey];
        return sanitizeTurkishChars(val !== undefined && val !== null ? String(val) : '-');
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const columnStyles: Record<number, any> = {};
    columns.forEach((col, idx) => {
      if (col.align === 'right') {
        columnStyles[idx] = { halign: 'right' };
      } else if (col.align === 'center') {
        columnStyles[idx] = { halign: 'center' };
      }
    });

    autoTable(doc, {
      head: [tableHeaders],
      body: tableBody,
      startY: currentY,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [30, 41, 59], // Slate 800
        textColor: 255,
        fontStyle: 'bold',
        halign: 'left',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252], // Slate 50
      },
      columnStyles: columnStyles,
      margin: { top: 10, left: 10, right: 10, bottom: 12 },
      didDrawPage: (dataObj) => {
        // Sayfa numarası
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Sayfa ${dataObj.pageNumber} / ${pageCount}`,
          doc.internal.pageSize.width - 25,
          doc.internal.pageSize.height - 6
        );
      }
    });

    // Özet Tablosu
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 30;
    if (summaryRows && summaryRows.length > 0 && finalY < doc.internal.pageSize.height - 25) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(50);
      let sumY = finalY + 7;
      summaryRows.forEach(s => {
        doc.text(`${s.label}: ${s.value}`, 14, sumY);
        sumY += 4.5;
      });
    }

    const cleanFilename = (filename || 'rapor').endsWith('.pdf') ? filename : `${filename}.pdf`;
    doc.save(cleanFilename);
  } catch (error) {
    console.error('PDF export error:', error);
    alert('PDF dosyası oluşturulurken bir hata oluştu.');
  }
}

/**
 * Yazıcı Dostu Yazdırma Fonksiyonu
 */
export function printReport(options: ExportOptions) {
  try {
    const { title, subtitle, columns, data, summaryRows } = options;

    let printWindow: Window | null = null;
    try {
      printWindow = window.open('', '_blank', 'width=1100,height=850');
    } catch {
      printWindow = null;
    }

    const rowsHtml = data.map((item, idx) => {
      const cells = columns.map(col => {
        const val = col.dataKey === '__index' ? (idx + 1) : (item[col.dataKey] ?? '-');
        const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
        return `<td class="${alignClass}" style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${val}</td>`;
      }).join('');
      return `<tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">${cells}</tr>`;
    }).join('');

    const headersHtml = columns.map(col => {
      const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
      return `<th class="${alignClass}" style="padding: 8px; background-color: #1e293b; color: #ffffff; font-size: 11px; font-weight: 600; text-transform: uppercase;">${col.header}</th>`;
    }).join('');

    const summaryHtml = summaryRows && summaryRows.length > 0 ? `
      <div style="margin-top: 15px; padding: 12px; background-color: #f1f5f9; border-radius: 6px; display: inline-block; min-width: 320px;">
        <h4 style="margin: 0 0 6px 0; font-size: 12px; font-weight: bold; color: #334155;">Özet Bilgiler</h4>
        ${summaryRows.map(s => `
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; color: #1e293b;">
            <span style="font-weight: 500;">${s.label}:</span>
            <span style="font-weight: 700;">${s.value}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #0f172a; margin: 0; padding: 15px; }
          .text-left { text-align: left; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          @media print {
            button { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;">
          <div>
            <h1 style="margin: 0; font-size: 18px; font-weight: bold; color: #0f172a;">${title}</h1>
            ${subtitle ? `<p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">${subtitle}</p>` : ''}
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            <div><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div><strong>Toplam Kayıt:</strong> ${data.length} adet</div>
            <button onclick="window.print()" style="margin-top: 6px; padding: 4px 12px; background: #0f172a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Yazdır (Print)</button>
          </div>
        </div>

        <table>
          <thead><tr>${headersHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        ${summaryHtml}

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      // Fallback to hidden iframe if window.open was blocked
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 4000);
        }, 500);
      }
    }
  } catch (error) {
    console.error('Print error:', error);
    alert('Yazdırma işlemi başlatılırken bir hata oluştu.');
  }
}
