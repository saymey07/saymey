# Personel Ödemeleri ve Şantiye Giderleri Bağımsızlaştırma Planı

Personel şantiye değiştirdiğinde geçmişte yapılmış maaş ve avans ödemelerinin eski şantiyede sabit kalmasını, yeni ödemelerin yeni şantiyeye yazılmasını ve ödeme anında şantiyenin manuel seçilebilmesini sağlayan uygulama planı.

## User Review & Critical Decisions

> [!IMPORTANT]
> Kullanıcı ile soru-cevap sürecinde netleştirilen kararlar:
> - **Onaylanan Karar 1**: Personel şantiye değiştirdiğinde geçmiş ödemeler eski şantiyesinde sabit kalacaktır. Kullanıcı ödeme yaparken veya düzenlerken şantiyeyi manuel olarak da seçebilecektir.
> - **Onaylanan Karar 2**: Sistemdeki mevcut geçmiş ödeme kayıtları personelin şu ana kadarki mevcut şantiyesinde dondurulacak (`santiyeId` ödeme kaydına işlenecek), böylece personel kartından şantiye değiştirilse dahi eski masraflar asla yeni şantiyeye kaymayacaktır.

---

### 1. Genel Bakış & Çözüm Özeti

- **Mevcut Sorun**: Şantiye giderleri ve şantiye kârlılık raporlarında (`SitesManagement.tsx` ve `SiteProfitabilityReport.tsx`) personel ödemeleri, ödemenin yapıldığı andaki şantiyeye değil dinamik olarak personelin profilindeki güncel `person.santiyeId` alanına göre filtreleniyordu. Bu nedenle personel yeni bir şantiyeye aktarıldığında geçmiş aylarda eski şantiyede yapılan tüm maaş ve avans masrafları da yeni şantiyeye taşınıyordu.
- **Hedef**: Her bir `PersonelOdeme` kaydı bağımsız bir `santiyeId` ve `santiyeAdi` taşıyacak. Ödeme anında personelin mevcut şantiyesi varsayılan olarak gelecek ancak kullanıcı dilerse farklı bir şantiye seçebilecek. Şantiye giderleri hesaplanırken doğrudan ödemenin kendi `santiyeId`'si baz alınacak.
- **Değer**: Şantiye kâr/zarar hesapları, hak ediş ve gider dağılımları geçmişe dönük bozulmayacak; her şantiye sadece kendi bünyesinde yapılan fiili personel masraflarını taşıyacaktır.

---

### 2. Kullanıcı Deneyimi & Arayüz Akışı

1. **Personel Ödeme Yap Ekranı (Maaş / Avans / Resmi Ödeme)**:
   - Ödeme modalında "İlgili Şantiye" seçim alanı eklenecektir.
   - Personel seçildiğinde personelin o an bağlı olduğu şantiye otomatik seçili gelecektir; kullanıcı isterse listeden başka bir şantiye seçebilecektir.
2. **Ödeme Düzenle Modalı (`EditPersonelOdemeModal`)**:
   - Geçmiş bir ödeme düzenlenirken hangi şantiyenin giderine yazıldığı görüntülenebilecek ve gerektiğinde şantiye değiştirilebilecektir.
3. **Personel Bilgilerini Düzenle Ekranında Şantiye Değişimi**:
   - Personel kartından şantiye "A Şantiyesi"nden "B Şantiyesi"ne alındığında, personelin profilindeki şantiye güncellenecektir.
   - Ancak geçmiş ödeme kayıtlarının üzerindeki "A Şantiyesi" kimliği değişmeyecek; "A Şantiyesi" giderlerinde eski ödemeler aynen korunacak, personelin bundan sonra alacağı ödemeler "B Şantiyesi" giderlerine yazılacaktır.
4. **Şantiyeler & Kârlılık Raporu Ekranları**:
   - Şantiye Giderleri tablosunda yer alan personel ödeme satırları artık personelin şu anki şantiyesine değil, ödemenin ait olduğu şantiyeye göre listelenecektir.

---

### 3. Temel Ürün Kararları & Mimari Yaklaşım

- **Karar 1: Ödeme Seviyesinde Şantiye Kimliği (`PersonelOdeme.santiyeId`)**
  - *Seçilen Yaklaşım*: `PersonelOdeme` modeline `santiyeId?: string` ve `santiyeAdi?: string` alanları eklenecektir.
  - *Neden*: Ödeme yapıldığı anda şantiye bilgisi mühürlenir. Personelin gelecekteki görev yeri değişiklikleri geçmiş muhasebe kayıtlarını etkilemez.
- **Karar 2: Mevcut Geçmiş Kayıtların Dondurulması (Backward Compatibility)**
  - *Seçilen Yaklaşım*: Sistem yüklendiğinde veya ödeme listesi işlenirken, üzerinde henüz `santiyeId` bulunmayan eski kayıtlar personelin o anki şantiyesiyle kalıcı olarak etiketlenecektir.
  - *Neden*: Kullanıcının 2. soruda onayladığı üzere geçmiş kayıtlar mevcut şantiyelerine dondurulur ve veri kaybı önlenir.

---

### 4. Teknik Mimari & Değişiklik Noktaları

```
┌────────────────────────────────────────────────────────┐
│     Personel Ödeme Ekleme / Düzenleme Modalı           │
│     - Personel: Ahmet Yılmaz                           │
│     - İlgili Şantiye: [Lord's Palace Hotel ▼] (Seçim)  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│   PersonelOdeme {                                      │
│     id: 'po-123',                                      │
│     personelId: 'p-1',                                 │
│     santiyeId: 's-101',  ◄── Kalıcı mühürlenir         │
│     miktar: 25.000 TL                                  │
│   }                                                    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│   SitesManagement & SiteProfitabilityReport            │
│   Gider Eşleme: targetSite = o.santiyeId || person.site│
│   Sonuç: Personel şantiye değiştirse de 's-101' kalır  │
└────────────────────────────────────────────────────────┘
```

#### Yapılacak Değişiklikler:
1. `src/types.ts`:
   - `PersonelOdeme` arayüzüne `santiyeId?: string` ve `santiyeAdi?: string` alanları eklenecektir.
2. `src/components/PersonnelPayroll.tsx`:
   - Bireysel ödeme modalında (`isPaymentModalOpen`) ve grup ödeme modalında `santiyeId` seçim dropdown'ı eklenecektir.
   - Oluşturulan `record: PersonelOdeme` nesnesine seçilen `santiyeId` kaydedilecektir.
3. `src/components/EditPaymentModal.tsx`:
   - `EditPersonelOdemeModal` içerisine Şantiye seçimi alanı eklenecektir.
4. `src/components/SitesManagement.tsx`:
   - `personelExpenses` dizisi oluşturulurken, `targetSite` tespiti personelin mevcut profilinden önce doğrudan `o.santiyeId` üzerinden yapılacaktır.
5. `src/components/reports/SiteProfitabilityReport.tsx`:
   - Personel ödemelerinin şantiyeye atanmasında `o.santiyeId` öncelikli kullanılacaktır.
6. Doğrulama ve Derleme:
   - Personel şantiye değiştirdiğinde geçmiş ödemelerin eski şantiyede kaldığı, yeni ödemelerin yeni şantiyeye yazıldığı otomatik test betiği ile doğrulanacaktır.
