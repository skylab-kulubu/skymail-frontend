# SkyMail şablon kataloğu

`yarn emails:render` tarafından `emails/` içindeki kaynaklardan üretilir — elle düzenleme.

Her şablona ayrıca `Email` ve `FullName` değişkenleri mailer tarafından eklenir.

**Konu sütunu canlıya seed ile gider.** Seed her koşuda konuyu da buradan yazar. Son seed'den
sonra bir operatör şablonu SkyMail'de değiştirdiyse (konusu ya da bir taslağı dahil) SkyMail o
şablonu reddeder ve hiçbir şeyini yazmaz; seed reddedilenleri, nedenini ve zorlama komutunu
(`--force=<anahtar>`) listeler. Zorlamak operatörün sürümlerini silmez, geçmişte kalırlar (ADR-0047).

Konu satırı ve düz metin Go `text/template` ile render edilir: eksik bir değişken orada
`<no value>` basar (HTML tarafında boş basar), o yüzden konuda yalnızca gönderenin her
zaman verdiği değişkenler kullanılır.

| Şablon adı | key | Konu | Değişkenler |
| --- | --- | --- | --- |
| Serbest Gönderim | `free.basic` | {{.Subject}} | `Subject`, `Heading`, `BodyHtml`, `CtaLabel`, `CtaUrl` |
| Keycloak · E-posta Doğrulama 🔒 | `keycloak.verify-email` | E-posta adresini doğrula | `link`, `linkExpirationMinutes`, `firstName`, `username`, `realmDisplayName`, `subjectKey` |
| Keycloak · Parola Sıfırlama 🔒 | `keycloak.reset-password` | SKY LAB parola sıfırlama isteği | `link`, `linkExpirationMinutes`, `firstName`, `username`, `realmDisplayName`, `subjectKey` |
| Keycloak · E-posta Değişikliği Doğrulama 🔒 | `keycloak.update-email` | Yeni e-posta adresini doğrula | `link`, `linkExpirationMinutes`, `firstName`, `username`, `realmDisplayName`, `subjectKey` |
| Keycloak · YTÜ Hesabı Bağlama 🔒 | `keycloak.idp-link` | YTÜ hesabını SKY LAB hesabına bağla | `link`, `linkExpirationMinutes`, `firstName`, `username`, `realmDisplayName`, `subjectKey` |
| Keycloak · Kişisel E-posta Onayı 🔒 | `keycloak.personal-email-confirm` | Kişisel e-posta adresini doğrula | `code`, `codeExpirationMinutes`, `firstName`, `username`, `realmDisplayName`, `subjectKey` |
| Keycloak · Genel Sistem Postası 🔒 | `keycloak.generic` | SKY LAB hesap bildirimi | `link`, `linkExpirationMinutes`, `firstName`, `username`, `realmDisplayName`, `subjectKey` |
| Hoş Geldin 🔒 | `core.welcome` | SKY LAB ekosistemine hoş geldin | `FirstName`, `LastName`, `Email`, `SkyNumber`, `CreatedAt` |
| Katılım Sertifikası 🔒 | `core.certificate` | Katılım sertifikan hazır | `FirstName`, `EventName`, `VerifyURL`, `Serial`, `OwnerTeam` |
| Hesap Güvenlik Bildirimi 🔒 | `account.security-alert` | SKY LAB hesabında: {{.EventTitle}} | `EventTitle`, `EventDetail`, `OccurredAt`, `DeviceLabel`, `IpAddress`, `Location`, `SecureAccountUrl` |
| Birincil E-posta Değişti (eski adrese) 🔒 | `account.primary-email-changed` | SKY LAB hesabının e-posta adresi değişti | `OldEmail`, `NewEmail`, `OccurredAt`, `SecureAccountUrl` |
| Hesap Silme Talebi Alındı 🔒 | `account.deletion-requested` | Hesap silme talebini aldık | `RequestedAt`, `CompletesAt`, `CancelUrl` |
| Hesap Silindi 🔒 | `account.deletion-completed` | SKY LAB hesabın silindi | `CompletedAt`, `RetainedDataNote` |
| Etkinlik · Bilet Oluşturuldu | `event.ticket-created` | {{.EventName}} biletin hazır | `EventName`, `EventDate`, `Venue`, `TicketQrUrl`, `TicketCode`, `OwnerTeam`, `EventUrl` |
| Etkinlik · Hatırlatma | `event.reminder` | Yarın: {{.EventName}} | `EventName`, `StartsAt`, `Venue`, `TicketQrUrl`, `MapUrl` |
| Etkinlik · Güncellendi | `event.updated` | {{.EventName}} etkinliğinde değişiklik var | `EventName`, `ChangeSummary`, `NewStartsAt`, `NewVenue`, `EventUrl` |
| Etkinlik · İptal Edildi | `event.cancelled` | {{.EventName}} iptal edildi | `EventName`, `CancelReason`, `ContactEmail` |
| Mail Onayı · Onayını Bekliyor | `mail.approval-requested` | Onayını bekleyen bir gönderim var | `RequesterName`, `TemplateName`, `AudienceName`, `RecipientCount`, `PreviewUrl`, `ApproveUrl` |
| Mail Onayı · Sonuçlandı | `mail.approval-resolved` | {{if eq .Decision `approved`}}Gönderimin onaylandı ve gitti{{else if eq .Decision `rejected`}}Gönderimin reddedildi{{else if eq .Decision `returned`}}Gönderimin sana geri döndü{{else if eq .Decision `expired`}}Gönderimin süresi doldu{{else if eq .Decision `declined`}}Gönderimdeki düzenleme kabul edilmedi{{else}}Gönderim isteğin sonuçlandı{{end}} | `TemplateName`, `AudienceName`, `Decision`, `DecidedBy`, `DecisionNote`, `RequestUrl`, `DeadlineAt` |
| Operasyon · Gönderim Hatası | `ops.send-failed` | SkyMail gönderiminde hata | `TaskId`, `TemplateName`, `FailedCount`, `TotalCount`, `FirstError`, `TaskUrl` |
| Kulüp · Takım Üyeliği Değişti | `club.team-membership` | SKY LAB takım üyeliğinde değişiklik | `TeamName`, `Action`, `EffectiveAt`, `LeaderName` |

🔒 = sistem şablonu: arşivlenemez, anahtarı değiştirilemez.

## Ne zaman gider

- **Serbest Gönderim** (`free.basic`) — SkyMail'de elle: alıcıları seç, konuyu ve gövdeyi yaz, gönder.
- **Keycloak · E-posta Doğrulama** (`keycloak.verify-email`) — Keycloak, hesap açılışında veya e-posta doğrulanmamışken (sky-account SPI üzerinden SkyMail'e düşer).
- **Keycloak · Parola Sıfırlama** (`keycloak.reset-password`) — Keycloak, giriş ekranında "parolamı unuttum" akışında.
- **Keycloak · E-posta Değişikliği Doğrulama** (`keycloak.update-email`) — Keycloak, kişi hesabının e-posta adresini değiştirdiğinde — doğrulama YENİ adrese gider.
- **Keycloak · YTÜ Hesabı Bağlama** (`keycloak.idp-link`) — Keycloak, YTÜ Microsoft kimliği mevcut bir SKY LAB hesabına bağlanırken (IdP link).
- **Keycloak · Kişisel E-posta Onayı** (`keycloak.personal-email-confirm`) — Account center'da kişisel e-posta eklendiğinde; 6 haneli kod, 10 dakika geçerli, yalnız isteyen kişinin açık oturumunda çalışır (K3c, ADR-0044 güncellemesi). Keycloak'tan K5 ile gelir.
- **Keycloak · Genel Sistem Postası** (`keycloak.generic`) — Keycloak gönderici SPI'ın yedeği: eşlenmemiş bir sistem postası (ileride eklenecek bir required action gibi) bu anahtara düşer. subjectKey hangi posta olduğunu söyler.
- **Hoş Geldin** (`core.welcome`) — core-backend, yeni bir User ilk kez göründüğünde (SKYMAIL_WELCOME_TEMPLATE_ID).
- **Katılım Sertifikası** (`core.certificate`) — core-backend, yoklama kesinleştikten sonra sertifika üretildiğinde (SKYMAIL_CERTIFICATE_TEMPLATE_ID, certificate/service.go).
- **Hesap Güvenlik Bildirimi** (`account.security-alert`) — Account center / sky-account SPI, hesapta güvenlikle ilgili bir şey değiştiğinde: parola değişti, geçiş anahtarı eklendi/silindi, doğrulama uygulaması eklendi/kaldırıldı, yeni cihazdan giriş, tüm oturumlar kapatıldı, kullanıcı adı değişti, kişisel e-posta eklendi/kaldırıldı.
- **Birincil E-posta Değişti (eski adrese)** (`account.primary-email-changed`) — Account center, birincil e-posta değiştiğinde — ESKİ adrese gider. Yeni adres zaten doğrulama postası aldığı için bu, değişikliği kaçıran kişiye tek uyarıdır.
- **Hesap Silme Talebi Alındı** (`account.deletion-requested`) — Account center, kişi hesabını sildiğinde. Erişim anında kapanır, kişisel veriler sonra anonimleştirilir (ADR-0042). ACCOUNT_ERASURE_MODE açıldığında devreye girer.
- **Hesap Silindi** (`account.deletion-completed`) — Account center, anonimleştirme tamamlandığında. Bu, bu adrese gönderdiğimiz son postadır.
- **Etkinlik · Bilet Oluşturuldu** (`event.ticket-created`) — core-backend, Member apply / Guest apply / Apply-for-other bir Ticket yazdığında. NOT: bu gönderimi yapan kod henüz yazılmadı.
- **Etkinlik · Hatırlatma** (`event.reminder`) — Etkinlikten bir gün önce, bileti olan herkese. NOT: zamanlayıcı ve gönderim kodu henüz yazılmadı; konu satırı T-1 varsayıyor.
- **Etkinlik · Güncellendi** (`event.updated`) — Etkinliğin saati veya yeri değiştiğinde, bileti olan herkese. NOT: gönderim kodu henüz yazılmadı.
- **Etkinlik · İptal Edildi** (`event.cancelled`) — Etkinlik iptal edildiğinde, bileti olan herkese. NOT: gönderim kodu henüz yazılmadı.
- **Mail Onayı · Onayını Bekliyor** (`mail.approval-requested`) — SkyMail, gönderme yetkisi olmayan biri taslak gönderdiğinde onaycılara (ADR-0031, CONTEXT.md "Mail onayı", ticket 19).
- **Mail Onayı · Sonuçlandı** (`mail.approval-resolved`) — SkyMail, bir onay isteği sonuçlandığında. approved/rejected/returned/expired talebi açana, declined onaycılara gider (ADR-0031, ticket 19).
- **Operasyon · Gönderim Hatası** (`ops.send-failed`) — SkyMail, bir görevdeki mailler yeniden denemeler bittikten sonra da gönderilemediğinde, gönderimi başlatan kişiye. NOT: bu uyarıyı gönderen kod henüz yazılmadı.
- **Kulüp · Takım Üyeliği Değişti** (`club.team-membership`) — Superadmin'de bir kişi takıma eklendiğinde veya çıkarıldığında. NOT: gönderim kodu henüz yazılmadı.
