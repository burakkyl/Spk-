# Düzey — SPK lisanslama hazırlık uygulaması

Üyelik ve giriş gerektirmeyen, Capacitor ile Android/iOS uygulamasına paketlenebilen, ayrıca PWA olarak kullanılabilen Türkçe çalışma uygulaması.

## İçerik ve erişim

- Toplam **45 deneme / 1.125 özgün soru**; her denemede 25 soru. Düzey 1 ve 3'te 14'er, Düzey 2'de 17 deneme bulunur.
- Denemeler SPL'nin kullanıcı tarafından paylaşılan konu başlıklarına göre gruplanmıştır: Düzey 1'de 4, Düzey 2'de 9, Düzey 3'te 12 ders başlığı. Her deneme kartında ilgili alt konu kapsamı belirtilir; uygulama yalnızca bu üç lisans düzeyini içerir.
- Her düzeyin yalnızca ilk denemesi ücretsiz; kalan **42 deneme** Düzey Plus satın alımıyla açılır.
- Cevap seçimi sonrası doğru/yanlış rengi, açıklama ve sonraki soru akışı bulunur. Cevap seçeneklerinin sırası denemede karıştırılır.
- İlerleme cihazda tutulur; hesap açılmaz.
- Sorular resmî SPK sorularının kopyası değildir. Yayın öncesi mevzuat ve finans uzmanı incelemesi gerekir.

## Yerelde çalıştırma

Node.js 22+ ile:

```sh
npm ci
npm run dev
```

Müfredat ve soru bankası denetimi: `npm test`. Prod derlemesi: `npm run build`. `npm run android:sync` ve `npm run ios:sync` web derlemesini Capacitor projelerine aktarır. iOS uygulamasını derlemek/imzalamak için macOS ve Xcode gerekir.

## Ödeme kurulumu

Uygulama içinde RevenueCat Capacitor SDK kullanılır; mağaza ödemeleri Android’de Google Play Billing, iOS’ta StoreKit ile yapılır. Satın alma ve geri yükleme anonim mağaza hesabı üzerinden çalışır, Düzey üyeliği oluşturulmaz. Mağaza tahsilatının açılması için aşağıdaki işler uygulama/mağaza sahibi tarafından tamamlanmalıdır:

1. Google Play Console ve App Store Connect’te `com.duzey.lisanslama` uygulama kimliğiyle haftalık ve aylık otomatik yenilenen abonelik, ayrıca ömür boyu kalıcı ürün oluşturun.
2. RevenueCat’te iki mağazayı bağlayıp `premium` entitlement’ı ve `current` offering’i oluşturun. Offering’e RevenueCat’in `WEEKLY`, `MONTHLY`, `LIFETIME` paket tipleriyle eşleşen üç ürünü ekleyin.
3. GitHub Actions Secrets’a `VITE_RC_ANDROID_API_KEY` ve `VITE_RC_IOS_API_KEY` ekleyin. SDK anahtarları public istemci anahtarlarıdır; RevenueCat secret/API yönetim anahtarlarını uygulamaya koymayın.
4. Store ürünleri ve RevenueCat offering’i sandbox/test kullanıcılarıyla doğrulayın; fiyat, deneme süresi, otomatik yenileme ve iptal metinlerini mağazada gerçek değerlerle yapılandırın.

Plansız veya API anahtarı olmadan ödeme alınmaz. Plan ekranı mağaza ürün fiyatı varsa onu gösterir; web önizlemesindeki TL tutarları taslak referanstır. Satın alma makbuzu doğrulaması RevenueCat’in mağaza bağlantısı üzerinden yapılır. RevenueCat ürün/entitlement kurulumunu bu depodan otomatik yapmak mümkün değildir.

## GitHub Actions ile AAB

`.github/workflows/android-aab.yml`, push/PR veya manuel çalıştırmada Android release AAB üretip 30 gün saklanan Actions artifact’i olarak yükler. `duzey-android-aab` adlı artifact içinden `app-release.aab` indirilebilir.

- Keystore Secrets tanımlı değilse **imzasız** release AAB çıkar; bu yalnızca build doğrulaması içindir ve Play Store’a yüklenemez.
- Play’e yüklenebilir imzalı AAB için Actions Secrets’a `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `ANDROID_STORE_PASSWORD` ekleyin. Keystore’u güvenli biçimde oluşturup base64 kodlayın; keystore/parolayı Git’e koymayın.
- Workflow otomatik olarak Play Store’a yayın yapmaz. İç test, mağaza metinleri, gizlilik beyanları ve imzalı yükleme ayrıca yapılmalıdır.

## Ekran görüntüsü / içerik koruması

Capacitor native uygulamasında `@capgo/capacitor-privacy-screen` etkin. Android `FLAG_SECURE` ile çoğu ekran görüntüsü ve ekran kaydını engeller. iOS’ta içerik/görüntü geçişi gizleme en iyi çaba olarak uygulanır; iOS sürümü ve sistem davranışı nedeniyle ekran yakalamayı her koşulda engelleme garantisi verilemez. Tarayıcı/PWA ortamı ekran görüntüsünü engelleyemez. Soru ekranında metin seçme, kopyalama, sürükleme ve sağ tık da sınırlandırılmıştır.

Bunlar mutlak kopyalama koruması değildir: uygulama kaynaklarına erişen biri istemciye indirilmiş soru verisini teknik olarak çıkarabilir; harici kamera ile çekim de engellenemez. Bu depodaki soru havuzu istemci tarafındaki JavaScript/asset dosyalarında bulunduğundan, yüksek güvenlikte bir soru bankası için içeriklerin sunucuda tutulması, satın alma/oturumun sunucu tarafında doğrulanması, soru başına yetkili API sunumu ve kötüye kullanım sınırlaması gerekir. Bağlı Supabase hesabında hazır proje bulunmadığı için bu sürümde sunucu tarafı soru bankası kurulmamıştır. Bu nedenle mevcut önlem “çalınamaz” garantisi değil, istemci tarafında caydırma ve ekran yakalama kısıtlamasıdır.
