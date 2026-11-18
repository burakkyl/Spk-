# Düzey — App Store ve Google Play yayın rehberi

Bu belge, mağaza incelemesinden geçmek için kodda yapılanları ve **mağaza panellerinde senin elle yapman gerekenleri** listeler.

## 1. Kodda yapılanlar (bu dal)

| Konu | Neden gerekli | Durum |
|---|---|---|
| Soru bankası yeniden kuruldu (`npm run build:bank`) | Aynı sorunun farklı sayılarla tekrarı ve "1.125 özgün soru" iddiası yanıltıcıydı (Apple 2.3 / Google *Misleading claims*) | 649 benzersiz soru; arayüzdeki sayılar otomatik hesaplanıyor |
| SPK/SPL ile bağlantısızlık beyanı | Resmî kurum adını kullanan uygulamalar beyan olmadan reddedilir (Apple 5.2 / Google *Impersonation*) | Hakkında sayfası, alt bilgi, kullanım koşulları |
| Gizlilik politikası (`public/legal/gizlilik-politikasi.html`) | İki mağaza da zorunlu tutar; uygulama içinden erişilebilir olmalı | Hakkında ve Plus ekranından açılıyor |
| Kullanım koşulları / EULA | Apple 3.1.2: abonelik ekranında EULA ve gizlilik bağlantısı zorunlu | Plus ekranı ve satın alma penceresinde |
| Otomatik yenileme açıklaması | Apple 3.1.2 ve Google Play abonelik politikası | Plus ekranında, okunaklı boyutta |
| Uydurma (yedek) fiyatlar kaldırıldı | Fiyat yalnızca mağazadan gelir; ürün yüklenmediyse buton devre dışı | ✓ |
| Satın alımları geri yükle | Apple zorunlu tutar | Plus ve Hakkında ekranında |
| İlerlemeyi sıfırlama | Veri silme imkânı (Data Safety: "kullanıcı verilerini silebilir") | Hakkında ekranında |
| `PrivacyInfo.xcprivacy` | Apple, 2024'ten beri gizlilik bildirim dosyası istiyor (UserDefaults kullanımı) | Eklendi ve Xcode projesine kaydedildi |
| `Info.plist`: `arm64`, `tr`, `ITSAppUsesNonExemptEncryption=false` | `armv7` yüklemede hata verebilir; şifreleme beyanı her sürümde sorulmasın | ✓ |

## 2. Yayından önce senin yapman gerekenler

1. **Gizlilik politikası URL'si:** GitHub > Settings > Pages > Source = **GitHub Actions** seç, sonra Actions > *Legal pages* > *Run workflow*.
   Adresler:
   - `https://burakkyl.github.io/Spk-/gizlilik-politikasi.html`
   - `https://burakkyl.github.io/Spk-/kullanim-kosullari.html`
2. **İletişim e-postası:** Gizlilik politikası, koşullar ve Hakkında ekranında `tburakkayli@gmail.com` kullanıldı. Farklı bir destek adresi istersen `app.js` içindeki `SUPPORT_EMAIL` ile `public/legal/*.html` dosyalarını güncelle.
3. **RevenueCat:** `.env` dosyasına `VITE_RC_IOS_API_KEY` ve `VITE_RC_ANDROID_API_KEY` ekle. Entitlement kimliği `premium` olmalı. *Current offering* içine haftalık, aylık ve ömür boyu paketleri ekle (paket türleri: `$rc_weekly`, `$rc_monthly`, `$rc_lifetime`).
4. **Expert review:** Mevzuat soruları (oranlar, süreler, tebliğ numaraları) yazıldıkları tarihteki metne göre hazırlandı. Yayından önce SPL sertifikalı birine örneklem kontrolü yaptırman önerilir. Hatalı soru bildirimi Hakkında ekranındaki e-postaya geliyor.
5. **Sürüm:** Her yüklemede Android `versionCode`'u (android/app/build.gradle) ve iOS build numarasını artır.

## 3. Fiyatlar

Uygulamada gösterilen liste fiyatları: **Haftalık 250 TL**, **Aylık 550 TL**, **Ömür boyu 3.000 TL** (`app.js` → `PLAN_PRICES`).

- Mağazadan gerçek fiyat yüklenince her zaman mağaza fiyatı gösterilir; liste fiyatı yalnızca yedektir.
- App Store Connect ve Google Play Console'da ürün fiyatlarını **aynı tutarlara** ayarla (Apple'da en yakın fiyat basamağını seç). Gösterilen fiyat ile tahsil edilen fiyat farklı olursa uygulama reddedilebilir.
- Aylık plandaki "~%49 tasarruf" ifadesi 250 TL × 52 / 12 ≈ 1.083 TL'ye göre hesaplandı. Fiyatları değiştirirsen bu metni de güncelle.

## 4. App Store Connect

- **Kategori:** Eğitim. **Yaş derecelendirmesi:** 4+ (tüm sorulara "Hayır").
- **App Privacy (Uygulama Gizliliği):**
  - *Purchases → Purchase History*: Toplanıyor. Kullanıcıyla ilişkilendirilmiyor. Takip için kullanılmıyor. Amaç: App Functionality (RevenueCat).
  - Diğer tüm kategoriler: **Toplanmıyor**.
- **Abonelikler:** Haftalık ve aylık ürünleri aynı *Subscription Group* içinde oluştur. Ömür boyu ürün *Non-Consumable* olmalı. Her ürün için Türkçe görünen ad ve açıklama gir ve ürünleri ilk sürümle birlikte incelemeye gönder.
- **Açıklama metnine eklenmesi zorunlu satırlar:**
  - "Düzey, SPK veya SPL ile bağlantılı olmayan bağımsız bir çalışma uygulamasıdır. Sorular resmî sınav soruları değildir."
  - Kullanım Koşulları: `https://burakkyl.github.io/Spk-/kullanim-kosullari.html` (veya Apple standart EULA'sını seç).
- **Review Notes (inceleme notu) önerisi:**
  > The app is an independent study tool for the Turkish Capital Markets Licensing exams. It is not affiliated with the Capital Markets Board (SPK) or SPL; this is stated on the About screen and in the description. No account is required. The first practice test of each level is free; Düzey Plus (weekly/monthly auto-renewing subscriptions or a lifetime purchase) unlocks the rest. Restore Purchases is on the Plus and About screens.
- **iPad:** Proje iPhone ve iPad'i destekliyor (`TARGETED_DEVICE_FAMILY = 1,2`), bu yüzden **iPad ekran görüntüsü de gerekir** (13"). İstemezsen Xcode'da yalnızca iPhone'u seç.
- **Ekran görüntüleri:** 6,9" iPhone ekran görüntüleri gerekli. Görüntülerde "resmî", "SPK onaylı" gibi ifadeler kullanma.

## 5. Google Play Console

- **Uygulama içeriği → Gizlilik politikası:** Yukarıdaki URL.
- **Veri güvenliği (Data Safety):**
  - Veri topluyor mu? **Evet**. Toplanan tek tür: *Finansal bilgiler → Satın alma geçmişi* (RevenueCat aracılığıyla).
  - Paylaşılıyor mu? **Hayır**. RevenueCat hizmet sağlayıcısı sayılır.
  - İşleniş amacı: *Uygulama işlevselliği*. Toplama isteğe bağlı değil (yalnızca satın alma yapılırsa).
  - Aktarım sırasında şifreleniyor mu? **Evet**. Silme talebi: e-posta ile.
- **Reklamlar:** Hayır. **Hedef kitle:** 18+. **Uygulama erişimi:** Tüm işlevler giriş gerektirmez.
- **Finansal özellikler beyanı:** "Uygulamam finansal ürün/hizmet sunmuyor". Yalnızca eğitim içeriği var.
- **Abonelikler:** Ürün kimlikleri RevenueCat'tekilerle aynı olmalı. Google, abonelik ürünlerine *base plan* tanımlanmasını ister.
- **Kapalı test:** Yeni kişisel geliştirici hesaplarında üretime çıkmadan önce **en az 12 test kullanıcısıyla 14 gün kapalı test** zorunludur.

## 6. Soru bankası

- Kaynaklar `content/` altında. `public/spl-bank.js` dosyası **otomatik üretilir**, elle düzenleme.
- Yeni soru eklemek için `content/new/*.js` dosyasına `[konu, soru, [4 seçenek], doğruIndeks, açıklama]` biçiminde ekle, ardından `npm run build:bank && npm test` çalıştır.
- `npm test` şunları denetler: 4 farklı seçenek, geçerli cevap, açıklama, tekrar eden kök, her derste en az 25 soru, her düzeyde ilk denemenin ücretsiz olması, deneme içinde tekrar olmaması.
- Bilinen iyileştirme alanı: soruların yaklaşık %70'inde doğru seçenek en uzun seçenek. Eski havuzdan gelen sorularda çeldiricilerin uzatılması önerilir.
