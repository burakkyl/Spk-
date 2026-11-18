# Android: GitHub Actions ile AAB derleme ve Google Play'e yükleme

İş akışı: `.github/workflows/android-aab.yml`

| Tetikleyici | Ne olur? |
|---|---|
| Pull request, herhangi bir dala push | AAB derlenir ve **Actions → çalışma → Artifacts** altında 30 gün saklanır. Play'e yüklenmez. |
| **Actions → Android AAB → Run workflow** | "Google Play'e yükle" işaretlenirse AAB seçilen kanala (internal / alpha / beta / production) yüklenir. |
| `v1.0.1` gibi bir etiket gönderme | AAB derlenir ve otomatik olarak **internal (iç test)** kanalına *draft* olarak yüklenir. |

`versionCode` her çalışmada otomatik artar (`100 + çalışma numarası`). Sürüm adı `package.json` içindeki `version` alanından, etiketten (`v1.0.1` → `1.0.1`) veya formdaki "Sürüm adı" alanından alınır.

---

## 1. Yükleme anahtarı (upload key) oluştur — bir kez

Bilgisayarında (Java yüklü olmalı):

```bash
keytool -genkeypair -v -keystore duzey-upload.jks -alias duzey -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 duzey-upload.jks > duzey-upload.b64     # macOS: base64 -i duzey-upload.jks -o duzey-upload.b64
```

> ⚠️ `duzey-upload.jks` dosyasını ve şifreleri **Git'e koyma**, güvenli bir yerde (parola yöneticisi) yedekle. Kaybedersen Play Console'dan anahtar sıfırlama talep etmen gerekir.

Play Console'da **Play App Signing** açık olmalı (yeni uygulamalarda varsayılan). Bu durumda Google uygulamayı kendi anahtarıyla imzalar; senin anahtarın yalnızca "yükleme anahtarı"dır.

## 2. GitHub Secrets ekle

GitHub → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Değer |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `duzey-upload.b64` dosyasının içeriği |
| `ANDROID_KEY_ALIAS` | `duzey` (keytool'da verdiğin alias) |
| `ANDROID_KEY_PASSWORD` | Anahtar şifresi |
| `ANDROID_STORE_PASSWORD` | Keystore şifresi |
| `VITE_RC_ANDROID_API_KEY` | RevenueCat → Project → API keys → Google Play public SDK anahtarı (`goog_…`) |
| `VITE_RC_IOS_API_KEY` | RevenueCat Apple public SDK anahtarı (`appl_…`) |
| `PLAY_SERVICE_ACCOUNT_JSON` | 3. adımda indirilen JSON dosyasının **tüm içeriği** |

## 3. Google Play hizmet hesabı (PLAY_SERVICE_ACCOUNT_JSON) — bir kez

1. [Google Cloud Console](https://console.cloud.google.com/) → yeni proje oluştur (ör. `duzey-play`).
2. **APIs & Services → Library → "Google Play Android Developer API" → Enable**.
3. **IAM & Admin → Service Accounts → Create service account** (ör. `github-play-upload`). Rol vermene gerek yok.
4. Oluşan hesapta **Keys → Add key → Create new key → JSON** → dosya iner.
5. [Play Console](https://play.google.com/console) → **Kullanıcılar ve izinler → Yeni kullanıcı davet et** → hizmet hesabının e-postasını (`…@….iam.gserviceaccount.com`) gir →
   uygulama izinleri: *Düzey* için **"Sürümleri test kanallarında yayınla"**, **"Sürümleri üretimde yayınla"** (istersen) ve **"Uygulama bilgilerini görüntüle"**.
6. JSON dosyasının içeriğini `PLAY_SERVICE_ACCOUNT_JSON` secret'ına yapıştır, sonra dosyayı bilgisayarından sil.

## 4. İlk yükleme — elle

Google Play API, **hiç AAB yüklenmemiş bir uygulamaya** yükleme yapamaz. Bu yüzden ilk sefer:

1. Actions → **Android AAB → Run workflow** ("Google Play'e yükle" işaretsiz) → çalışma bitince **Artifacts** altından AAB'yi indir.
2. Play Console → uygulamayı oluştur → **Test → Dahili test → Yeni sürüm oluştur** → AAB'yi elle yükle.

Bundan sonraki tüm sürümler GitHub'dan yüklenebilir.

## 5. Sürüm yayınlama

**Elle:** Actions → Android AAB → Run workflow → 
- *Google Play'e yükle*: ✅
- *Play kanalı*: `internal` (iç test) · `alpha` (kapalı test) · `beta` (açık test) · `production`
- *Sürüm durumu*: Uygulama henüz incelemeden geçip yayımlanmadıysa **`draft`** seç (Google, yayımlanmamış uygulamalarda başka duruma izin vermez). Yayımlandıktan sonra `completed` doğrudan kullanıcılara sunar.
- *Sürüm notları*: Play'de "Bu sürümdeki yenilikler" alanına Türkçe olarak yazılır.

**Etiketle:**
```bash
git tag v1.0.1 && git push origin v1.0.1
```

`draft` olarak yüklenen sürümü Play Console → ilgili kanal → **Sürümü incele → Yayına başla** ile yayınlarsın.

### İsteğe bağlı: onaylı yükleme
GitHub → **Settings → Environments → google-play → Required reviewers** ile kendini ekleyersen, her Play yüklemesi senin onayını bekler.

## Sorun giderme

| Hata | Çözüm |
|---|---|
| `Play'e yükleme için imzalama secret'ları gerekli` | 2. adımdaki 4 keystore secret'ını ekle. |
| `APK specifies a version code that has already been used` | Play'e elle daha büyük bir versionCode yüklediysen iş akışındaki `VERSION_CODE_BASE` değerini artır. |
| `Package not found: com.duzey.lisanslama` | İlk AAB'yi elle yüklemen gerekiyor (4. adım) veya hizmet hesabına uygulama izni verilmemiş. |
| `The caller does not have permission` | Play Console'da hizmet hesabının izinlerini kontrol et (izinlerin etkinleşmesi birkaç dakika sürebilir). |
| `Only releases with status draft may be created on draft app` | Sürüm durumu olarak `draft` seç. |
| `The Android App Bundle was signed with the wrong key` | Play Console → Kurulum → Uygulama imzalama sayfasındaki yükleme anahtarı ile secret'taki keystore aynı olmalı. |
