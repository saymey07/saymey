import { SantiyeGider, FirmaCari, Cek, Firma, Taseron } from '../types';

export interface InvoiceAllocationResult {
  id: string;
  originalTRY: number;
  paidAmountTRY: number;
  openDifferenceTRY: number; // Kalan açık fatura farkı (şantiyeye yansıtılan tutar)
  status: 'tamamen_odendi' | 'kismen_odendi' | 'odenmedi';
}

export interface RevenueInvoiceAllocationResult {
  id: string;
  originalTRY: number;
  collectedAmountTRY: number;
  openDifferenceTRY: number; // Kalan açık alacak farkı (şantiyeye yansıtılan tutar)
  status: 'tamamen_tahsil' | 'kismen_tahsil' | 'tahsil_edilmedi';
}

/**
 * Normalizes firm/subcontractor identity to prevent fragmentation
 * between firmalar and taseronlar records.
 */
export const getCanonicalFirmKey = (
  firmaId?: string,
  firmaName?: string,
  firmalar?: Firma[],
  taseronlar?: Taseron[]
): string => {
  if (firmaId && firmaId.trim()) {
    const f = firmalar?.find((item) => item.id === firmaId);
    const t = taseronlar?.find(
      (item) => item.id === firmaId || (f && (item.id === f.id || item.isim.trim().toLowerCase() === f.isim.trim().toLowerCase()))
    );
    if (t) return `tas-${t.id}`;
    if (f) return `firma-${f.id}`;
    return `id-${firmaId.trim()}`;
  }

  if (firmaName && firmaName.trim()) {
    const clean = firmaName.trim().toLowerCase();
    const t = taseronlar?.find((item) => item.isim.trim().toLowerCase() === clean);
    if (t) return `tas-${t.id}`;
    const f = firmalar?.find((item) => item.isim.trim().toLowerCase() === clean);
    if (f) return `firma-${f.id}`;
    return `name-${clean}`;
  }

  return 'unknown_firm';
};

/**
 * Allocates actual payments made to a firm/subcontractor against purchase invoices
 * in chronological FIFO order to determine remaining open invoice differences.
 * This guarantees: Total Expenses = Actual Payments + Sum(Open Differences) = max(Payments, Invoices).
 * Eliminates 2x double counting when an invoice is already paid.
 */
export const allocateInvoicePaymentsFIFO = (
  totalPaidTRY: number,
  invoices: Array<{ id: string; tryVal: number; tarih?: string }>
): Map<string, InvoiceAllocationResult> => {
  const result = new Map<string, InvoiceAllocationResult>();
  let remainingPaidPool = Math.max(0, totalPaidTRY);

  // Sort invoices chronologically (FIFO)
  const sorted = [...invoices].sort((a, b) => (a.tarih || '').localeCompare(b.tarih || ''));

  for (const inv of sorted) {
    const invTRY = Math.max(0, inv.tryVal);
    if (remainingPaidPool >= invTRY) {
      result.set(inv.id, {
        id: inv.id,
        originalTRY: invTRY,
        paidAmountTRY: invTRY,
        openDifferenceTRY: 0,
        status: 'tamamen_odendi',
      });
      remainingPaidPool -= invTRY;
    } else if (remainingPaidPool > 0) {
      const openDiff = invTRY - remainingPaidPool;
      result.set(inv.id, {
        id: inv.id,
        originalTRY: invTRY,
        paidAmountTRY: remainingPaidPool,
        openDifferenceTRY: openDiff,
        status: 'kismen_odendi',
      });
      remainingPaidPool = 0;
    } else {
      result.set(inv.id, {
        id: inv.id,
        originalTRY: invTRY,
        paidAmountTRY: 0,
        openDifferenceTRY: invTRY,
        status: 'odenmedi',
      });
    }
  }

  return result;
};

/**
 * Allocates actual collections received from a customer against sales/progress invoices
 * in chronological FIFO order to determine remaining open receivable differences.
 * This guarantees: Total Revenue = Actual Collections + Sum(Open Differences) = max(Collections, Invoices).
 * Eliminates 2x double counting when a sales invoice is already collected.
 */
export const allocateInvoiceCollectionsFIFO = (
  totalCollectedTRY: number,
  salesInvoices: Array<{ id: string; tryVal: number; tarih?: string }>
): Map<string, RevenueInvoiceAllocationResult> => {
  const result = new Map<string, RevenueInvoiceAllocationResult>();
  let remainingCollectionPool = Math.max(0, totalCollectedTRY);

  // Sort sales invoices chronologically (FIFO)
  const sorted = [...salesInvoices].sort((a, b) => (a.tarih || '').localeCompare(b.tarih || ''));

  for (const inv of sorted) {
    const invTRY = Math.max(0, inv.tryVal);
    if (remainingCollectionPool >= invTRY) {
      result.set(inv.id, {
        id: inv.id,
        originalTRY: invTRY,
        collectedAmountTRY: invTRY,
        openDifferenceTRY: 0,
        status: 'tamamen_tahsil',
      });
      remainingCollectionPool -= invTRY;
    } else if (remainingCollectionPool > 0) {
      const openDiff = invTRY - remainingCollectionPool;
      result.set(inv.id, {
        id: inv.id,
        originalTRY: invTRY,
        collectedAmountTRY: remainingCollectionPool,
        openDifferenceTRY: openDiff,
        status: 'kismen_tahsil',
      });
      remainingCollectionPool = 0;
    } else {
      result.set(inv.id, {
        id: inv.id,
        originalTRY: invTRY,
        collectedAmountTRY: 0,
        openDifferenceTRY: invTRY,
        status: 'tahsil_edilmedi',
      });
    }
  }

  return result;
};
