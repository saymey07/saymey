import React, { useState } from 'react';
import { 
  BarChart3, 
  Users, 
  HardHat, 
  Layers, 
  Truck,
  Building2, 
  BookOpenCheck,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { 
  Personnel, 
  PersonelOdeme, 
  Santiye, 
  SantiyeGider, 
  Taseron, 
  Firma, 
  FirmaCari, 
  Cek, 
  Puantaj, 
  Mesai, 
  KrediKartiHarcama 
} from '../types';
import { PersonnelPaymentsReport } from './reports/PersonnelPaymentsReport';
import { SiteProfitabilityReport } from './reports/SiteProfitabilityReport';
import { SubcontractorBalanceReport } from './reports/SubcontractorBalanceReport';
import { SupplierAccountsReport } from './reports/SupplierAccountsReport';
import { CustomerAccountsReport } from './reports/CustomerAccountsReport';
import { CheckCashflowAnalysisReport } from './reports/CheckCashflowAnalysisReport';

export type ReportTabType = 
  | 'personnel_payments'
  | 'site_profitability'
  | 'subcontractor_balance'
  | 'supplier_accounts'
  | 'customer_accounts'
  | 'check_cashflow';

interface ReportsCenterProps {
  personnelList: Personnel[];
  puantajList: Puantaj[];
  mesaiList: Mesai[];
  odemeList: PersonelOdeme[];
  santiyeler: Santiye[];
  giderler: SantiyeGider[];
  taseronlar: Taseron[];
  firmalar: Firma[];
  cariList: FirmaCari[];
  cekler: Cek[];
  kartHarcamalari?: KrediKartiHarcama[];
  defaultMonthStr?: string;
  onOpenCurrencies?: () => void;
}

export const ReportsCenter: React.FC<ReportsCenterProps> = ({
  personnelList,
  puantajList,
  mesaiList,
  odemeList,
  santiyeler,
  giderler,
  taseronlar,
  firmalar,
  cariList,
  cekler,
  kartHarcamalari = [],
  defaultMonthStr,
  onOpenCurrencies,
}) => {
  const [activeReportTab, setActiveReportTab] = useState<ReportTabType>('personnel_payments');

  const reportTabs = [
    {
      id: 'personnel_payments' as ReportTabType,
      label: 'Personel Ödemeleri',
      sublabel: 'Aylık/Yıllık Hakediş & Ödeme',
      icon: <Users className="w-4 h-4" />,
      color: 'indigo',
    },
    {
      id: 'site_profitability' as ReportTabType,
      label: 'Şantiye Kâr / Zarar',
      sublabel: 'Proje Gelir, Gider & Kârlılık',
      icon: <HardHat className="w-4 h-4" />,
      color: 'emerald',
    },
    {
      id: 'subcontractor_balance' as ReportTabType,
      label: 'Taşeron Alacak / Borç',
      sublabel: 'Hakediş, Çek & Kart Ödemeleri',
      icon: <Layers className="w-4 h-4" />,
      color: 'amber',
    },
    {
      id: 'supplier_accounts' as ReportTabType,
      label: 'Tedarikçi Hesap Analizi',
      sublabel: 'Alış Faturaları, Ödeme & Borçlar',
      icon: <Truck className="w-4 h-4" />,
      color: 'teal',
    },
    {
      id: 'customer_accounts' as ReportTabType,
      label: 'Müşteri Hesap Analizi',
      sublabel: 'Faturalar, Tahsilat & Alacaklar',
      icon: <Building2 className="w-4 h-4" />,
      color: 'blue',
    },
    {
      id: 'check_cashflow' as ReportTabType,
      label: 'Çek Vade Analizi',
      sublabel: 'Alınan vs Verilen Çek Dengesi',
      icon: <BookOpenCheck className="w-4 h-4" />,
      color: 'violet',
    },
  ];

  return (
    <div className="space-y-6">
      {/* TOP HEADER */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 to-indigo-900 text-white flex items-center justify-center shadow-xs">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Finansal & Operasyonel Raporlar</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  6 Rapor Modülü
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Personel hakedişleri, şantiye kârlılıkları, taşeron, tedarikçi ve müşteri cari hesapları ile çek likidite analizi
              </p>
            </div>
          </div>
        </div>

        {onOpenCurrencies && (
          <button
            onClick={onOpenCurrencies}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-2xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Döviz Kurlarını Güncelle</span>
          </button>
        )}
      </div>

      {/* REPORT SUB-NAV PILLS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {reportTabs.map((tab) => {
          const isActive = activeReportTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReportTab(tab.id)}
              className={`flex flex-col text-left p-3 rounded-2xl border transition-all duration-150 ${
                isActive
                  ? 'bg-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/20'
                  : 'bg-white/80 hover:bg-white border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.icon}
                </div>
                <span className={`text-xs font-bold ${isActive ? 'text-indigo-950' : 'text-slate-800'}`}>
                  {tab.label}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1.5 line-clamp-1">
                {tab.sublabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* ACTIVE REPORT CONTENT */}
      <div>
        {activeReportTab === 'personnel_payments' && (
          <PersonnelPaymentsReport
            personnelList={personnelList}
            puantajList={puantajList}
            mesaiList={mesaiList}
            odemeList={odemeList}
            santiyeler={santiyeler}
            taseronlar={taseronlar}
            giderler={giderler}
            defaultMonthStr={defaultMonthStr}
          />
        )}

        {activeReportTab === 'site_profitability' && (
          <SiteProfitabilityReport
            santiyeler={santiyeler}
            giderler={giderler}
            cariList={cariList}
            cekler={cekler}
            firmalar={firmalar}
            taseronlar={taseronlar}
            personnelList={personnelList}
            odemeList={odemeList}
          />
        )}

        {activeReportTab === 'subcontractor_balance' && (
          <SubcontractorBalanceReport
            taseronlar={taseronlar}
            firmalar={firmalar}
            cariList={cariList}
            giderler={giderler}
            cekler={cekler}
            kartHarcamalari={kartHarcamalari}
            santiyeler={santiyeler}
          />
        )}

        {activeReportTab === 'supplier_accounts' && (
          <SupplierAccountsReport
            firmalar={firmalar}
            cariList={cariList}
            cekler={cekler}
            santiyeler={santiyeler}
            kartHarcamalari={kartHarcamalari}
          />
        )}

        {activeReportTab === 'customer_accounts' && (
          <CustomerAccountsReport
            firmalar={firmalar}
            cariList={cariList}
            cekler={cekler}
            santiyeler={santiyeler}
          />
        )}

        {activeReportTab === 'check_cashflow' && (
          <CheckCashflowAnalysisReport
            cekler={cekler}
            firmalar={firmalar}
          />
        )}
      </div>
    </div>
  );
};
