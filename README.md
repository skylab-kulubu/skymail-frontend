<div align="center">
  <a href="https://github.com/skylab-kulubu/skymail-frontend">
    <img src="https://avatars.githubusercontent.com/u/96308083?s=200&v=4" alt="Repo Logo" height="100">
  </a>
</div>

<h2 align="center">Skymail</h3>

<div align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg?labelColor=003694&color=ffffff" alt="License">
  <img src="https://img.shields.io/github/contributors/skylab-kulubu/skymail-frontend?labelColor=003694&color=ffffff" alt="GitHub contributors" >
  <img src="https://img.shields.io/github/stars/skylab-kulubu/skymail-frontend.svg?labelColor=003694&color=ffffff" alt="Stars">
  <img src="https://img.shields.io/github/forks/skylab-kulubu/skymail-frontend.svg?labelColor=003694&color=ffffff" alt="Forks">
  <img src="https://img.shields.io/github/issues/skylab-kulubu/skymail-frontend.svg?labelColor=003694&color=ffffff" alt="Issues">
</div>

## Özellikler

* **Mail template'ler:** kulübün gönderdiği maillerin konusu ve gövdesi.
* **Mail listeleri:** internal listeler ve Keycloak grupları.
* **Gönderimler:** bir listeye ya da tek tek kişilere mail gönderme.

Panel Next.js (App Router) + Tailwind 4 + TypeScript. Kabuk ve temel bileşenler
superadmin'den kopyalandı (ADR-0017); giriş Auth.js v5 ile Keycloak'ın `skymail`
public istemcisi üzerinden (sır yok, PKCE + `state`). Sayfalar tarayıcıdan
doğrudan SkyMail API'sine gider; tek HTTP istemcisi `src/lib/api/client.ts`.

## Yerelde çalıştırma

```sh
cp .env.example .env.local   # AUTH_SECRET'ı doldur: openssl rand -base64 33
yarn install
yarn dev                     # http://localhost:3000
```

Ortam değişkenleri çalışma zamanında okunur; imaj sandbox ve production için aynıdır.

| Değişken | Ne için | Örnek |
| --- | --- | --- |
| `AUTH_SECRET` | Auth.js oturum çerezini şifreler; Keycloak'a gitmez | `openssl rand -base64 33` |
| `AUTH_URL` | Sitenin dış adresi; yerelde boş | `https://mail.yildizskylab.com` |
| `KEYCLOAK_ISSUER` | Realm adresi | `https://e.yildizskylab.com/realms/e-skylab` |
| `KEYCLOAK_CLIENT_ID` | Public istemci (varsayılan `skymail`) | `skymail` |
| `API_URL` | SkyMail API'si | `https://api.yildizskylab.com/api/skymail/v1` |
| `ADMIN_URL`, `FORMS_ADMIN_URL` | Kulüp değiştiricideki diğer konsollar (boşsa production) | `https://admin.yildizskylab.com` |

`AUTH_SECRET`, `KEYCLOAK_ISSUER` ya da `API_URL` eksikse production sunucusu
eksikleri yazıp kapanır.

**Keycloak:** yerelde giriş için `skymail` istemcisinde şu adresler kayıtlı olmalı
(elle eklenir):

* Valid redirect URI: `http://localhost:3000/api/auth/callback/keycloak`
* Valid post logout redirect URI: `http://localhost:3000`
* Web origin: `http://localhost:3000`

> **Bugün (2026-09-23) sandbox realm'ında (`e-skylab-sandbox`) `skymail` istemcisi
> yok** — Keycloak "Client not found" diyor; yani sandbox'a karşı yerel giriş şu an
> çalışmaz. Production realm'ındaki `skymail` istemcisinde de yerel adresler kayıtlı
> değil. İnsan adımı, ikisinden biri: sandbox realm'ında `skymail` public istemcisini
> yukarıdaki adreslerle açmak, ya da bu adresleri production `skymail` istemcisine
> eklemek.

Canlıda geri dönüş adresi `<AUTH_URL>/api/auth/callback/keycloak`, çıkış dönüşü
sitenin kök adresidir (Refine uygulamasının kullandığı adres).

## Kontroller

```sh
yarn typecheck        # next typegen && tsc --noEmit
yarn build            # ortam değişkeni gerekmez
yarn lint             # ESLint (TypeScript, hooks, Next.js kuralları)
yarn api:check        # bütün Node testleri (src/**/*.test.ts): HTTP istemcisi, oturum token'ı, roller, tema ve render modülü
yarn emails:check     # serbest duyuru gövdesi: yalnız sunucunun izin listesindeki etiketler, yazılan metin işaretlemeye dönmez, bağlantı adresleri Go'nun okuduğu gibi
yarn templates:check  # yalnız render modülünün testleri: repo template'leri JSX modunda, Visual belge ve modu (emails:render kontrolleriyle), HTML modu, değişkenler, önizleme, kaydetme kararı
yarn emails:render    # repodaki Mail template'leri render edip denetler
yarn test:e2e         # tarayıcı testleri (Playwright): editörün riskli akışları, taklit API ile
```

`yarn test:e2e` paneli production build olarak 3013 portunda (ya da `E2E_PORT`'ta;
iki checkout aynı anda koşarken biri diğerinin sunucusunu kullanmasın) başlatır; SkyMail
API'si tarayıcıda ağ katmanında taklit edilir (`tests/e2e/fixtures/mock-api.ts`),
oturum atılabilir bir `AUTH_SECRET` ile üretilir, Keycloak'a gidilmez. Chromium
ilk seferde `yarn playwright install chromium` ile indirilir.

`dev` ve `build`, Next.js'ten önce `scripts/build-editor-assets.ts`'i koşar
(`yarn editor:assets`): Mail template editörünün render sandbox'ı
(`public/render-sandbox/`: opak kökenli iframe'in betiği ve render'ın koştuğu
worker) ve Monaco (`public/monaco/<sürüm>/vs`, CDN yerine panelin kendisinden).
İkisi de üretilir, git'e girmez; dosya adları ya da yolları içeriğe/sürüme
bağlı olduğu için kalıcı önbelleklenir.

İmaj: `docker build -t skymail-frontend .` — build argümanı yok; konteyner
`node server.js` ile başlar ve ayarlarını ortamdan okur.

## Katkıda Bulunanlar 🧙‍♂️

<a href="https://github.com/skylab-kulubu/skymail-frontend/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=skylab-kulubu/skymail-frontend" />
</a>

<sup><sub>[contrib.rocks](https://contrib.rocks) ile yapıldı.</sub></sup>

