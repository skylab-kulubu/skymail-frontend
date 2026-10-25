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
| Keycloak · E-posta Doğrulama 🔒 🙈 | `keycloak.verify-email` | E-posta adresini doğrula | `link`, `linkExpirationMinutes`, `firstName`, `username`, `realmDisplayName`, `subjectKey` |
| Keycloak · Parola Sıfırlama 🔒 🙈 | `keycloak.reset-password` | SKY LAB parola sıfırlama isteği | `link`, `linkExpirationMinutes`, `firstName`, `username`, `realmDisplayName`, `subjectKey` |
| Keycloak · E-posta Değişikliği Doğrulama 🔒 🙈 | `keycloak.update-email` | Yeni e-posta adresini doğrula | `link`, `linkExpirationMinutes`, `firstName`, `username`, `realmDisplayName`, `subjectKey` |
| Keycloak · YTÜ Hesabı Bağlama 🔒 🙈 | `keycloak.idp-link` | YTÜ hesabını SKY LAB hesabına bağla | `link`, `linkExpirationMinutes`, `firstName`, `username`, `realmDisplayName`, `subjectKey` |
| Keycloak · Kişisel E-posta Onayı 🔒 🙈 | `keycloak.personal-email-confirm` | Kişisel e-posta adresini doğrula | `code`, `codeExpirationMinutes`, `firstName`, `username`, `realmDisplayName`, `subjectKey` |
| Keycloak · Giriş Kodu 🔒 🙈 | `keycloak.login-code` | {{if eq .purpose `sudo`}}SKY LAB işlem onaylama kodun{{else if eq .purpose `signup`}}SKY LAB hesap açma kodun{{else if eq .purpose `link`}}SKY LAB hesap bağlama kodun{{else}}SKY LAB giriş kodun{{end}} | `code`, `codeExpirationMinutes`, `purpose`, `firstName`, `username`, `realmDisplayName`, `subjectKey` |
| Keycloak · E-posta Kodu Sınır Alarmı 🔒 | `keycloak.login-code-alarm` | {{if eq .subjectKey `skyLoginCodeAlarmFullSubject`}}SKY LAB: e-posta kodu gönderimi günlük sınıra ulaştı{{else if eq .subjectKey `skyLoginCodeAlarmCeilingSubject`}}SKY LAB: bir hesap e-posta kodunda günlük yanlış kod tavanına ulaştı{{else if eq .subjectKey `skyLoginCodeAlarmConsecutiveSubject`}}SKY LAB: bir hesap ardışık 100 yanlış e-posta koduna ulaştı{{else}}SKY LAB: e-posta kodu gönderimi günlük sınırın yarısında{{end}} | `realmDisplayName`, `subjectKey` |
| Keycloak · Genel Sistem Postası 🔒 🙈 | `keycloak.generic` | SKY LAB hesap bildirimi | `link`, `linkExpirationMinutes`, `firstName`, `username`, `realmDisplayName`, `subjectKey` |
| Hoş Geldin 🔒 | `core.welcome` | SKY LAB'e hoş geldin | `FirstName`, `LastName`, `Email`, `Username`, `SchoolEmail`, `SkyNumber`, `CreatedAt` |
| Katılım Sertifikası 🔒 | `core.certificate` | Katılım sertifikan hazır | `FirstName`, `EventName`, `VerifyURL`, `Serial`, `OwnerTeam` |
| Etkinlik İptali 🔒 | `core.event-cancelled` | {{.EventName}} iptal edildi | `EventName`, `EventStart`, `CancelReason`, `FirstName` |
| Etkinlik Yeniden Yayında 🔒 | `core.event-reinstated` | {{.EventName}} yeniden yayında | `EventName`, `EventStart`, `FirstName` |
| Geri Bildirim İsteği 🔒 🙈 | `core.feedback-request` | {{.EventName}} geri bildirim formu | `FirstName`, `EventName`, `Items` |
| Geri Bildirim Hatırlatması 🔒 🙈 | `core.feedback-reminder` | Hatırlatma: {{.EventName}} geri bildirim formu | `FirstName`, `EventName`, `Items` |
| İletişim İzni Onayı 🔒 🙈 | `core.contact-consent-confirm` | {{if eq .purpose `event_invitations`}}SKY LAB duyuru iznini onayla{{else if eq .purpose `promotional`}}SKY LAB tanıtım e-postası iznini onayla{{else}}SKY LAB iznini onayla{{end}} | `confirmUrl`, `withdrawUrl`, `purpose` |
| Hesap Güvenlik Bildirimi 🔒 🙈 | `account.security-alert` | SKY LAB hesabında: {{.EventTitle}} | `EventTitle`, `EventDetail`, `OccurredAt`, `DeviceLabel`, `IpAddress`, `Location`, `SecureAccountUrl` |
| Birincil E-posta Değişti (eski adrese) 🔒 🙈 | `account.primary-email-changed` | SKY LAB hesabının e-posta adresi değişti | `OldEmail`, `NewEmail`, `OccurredAt`, `SecureAccountUrl` |
| Hesap Silme Talebi Alındı 🔒 🙈 | `account.deletion-requested` | Hesap silme talebini aldık | `RequestedAt`, `CompletesAt`, `CancelUrl` |
| Hesap Silindi 🔒 🙈 | `account.deletion-completed` | SKY LAB hesabın silindi | `CompletedAt`, `RetainedDataNote` |
| Etkinlik · Bilet Oluşturuldu 🙈 | `event.ticket-created` | {{.EventName}} biletin hazır | `EventName`, `EventDate`, `Venue`, `TicketQrUrl`, `TicketCode`, `OwnerTeam`, `EventUrl` |
| Etkinlik · Hatırlatma 🙈 | `event.reminder` | Yarın: {{.EventName}} | `EventName`, `StartsAt`, `Venue`, `TicketQrUrl`, `MapUrl` |
| Etkinlik · Güncellendi | `event.updated` | {{.EventName}} etkinliğinde değişiklik var | `EventName`, `ChangeSummary`, `NewStartsAt`, `NewVenue`, `EventUrl` |
| Mail Onayı · Onayını Bekliyor | `mail.approval-requested` | Onayını bekleyen bir gönderim var | `RequesterName`, `TemplateName`, `AudienceName`, `AudienceKind`, `RecipientCount`, `PreviewUrl`, `ApproveUrl` |
| Mail Onayı · Sonuçlandı | `mail.approval-resolved` | {{if eq .Decision `approved`}}Gönderimin onaylandı ve gitti{{else if eq .Decision `rejected`}}Gönderimin reddedildi{{else if eq .Decision `returned`}}Gönderimin sana geri döndü{{else if eq .Decision `expired`}}Gönderimin süresi doldu{{else if eq .Decision `declined`}}Gönderimdeki düzenleme kabul edilmedi{{else}}Gönderim isteğin sonuçlandı{{end}} | `TemplateName`, `AudienceName`, `AudienceKind`, `RecipientCount`, `Decision`, `DecidedBy`, `DecisionNote`, `RequestUrl`, `DeadlineAt` |
| Operasyon · Gönderim Hatası | `ops.send-failed` | SkyMail gönderiminde hata | `TaskId`, `TemplateName`, `FailedCount`, `TotalCount`, `FirstError`, `TaskUrl` |
| Kulüp · Takım Üyeliği Değişti | `club.team-membership` | SKY LAB takım üyeliğinde değişiklik | `TeamName`, `Action`, `Role`, `EffectiveAt`, `LeaderName` |
| Kulüp · Yönetim Grubu Üyeliği Değişti | `club.role-membership` | SKY LAB yönetim yetkilerinde değişiklik | `GroupName`, `Role`, `Action`, `EffectiveAt`, `ActorName` |
| Kulüp · Grup Üyeliği Değişti | `club.group-membership` | SKY LAB grup üyeliğinde değişiklik | `GroupName`, `Action`, `EffectiveAt`, `ActorName` |
| Kulüp · Yetki Değişikliği Bildirimi | `club.privilege-change` | SKY LAB yönetim yetkilerinde değişiklik bildirimi | `Change`, `GroupName`, `GroupId`, `Root`, `SubjectName`, `ActorName`, `OccurredAt`, `RolesAdded`, `RolesRemoved`, `AdminRole`, `MemberCount` |
| Kulüp · Haber ve Duyuru | `club.news` | `{{.Subject}}` (gönderen yazmazsa kaydın başlığı; duyuruda başında "Duyuru: ") | `Subject`, `Preheader`, `Title`, `Summary`, `BodyHtml`, `FullBody`, `HeroUrl`, `HeroAlt`, `CtaHref`, `CtaLabel`, `ReadMoreUrl`, `KindLabel`, `AudienceReason`, `CategoryLabel` |
| Forms · Cevap Durumu 🔒 | `forms.status-changed` | {{if eq .status `approved`}}{{if or .nextFormId .linkedFormId}}Sonraki adıma geçtiniz{{else}}Cevabınız onaylandı{{end}}{{else if eq .status `declined`}}Cevabınız kabul edilmedi{{else if eq .status `returned`}}Cevabınızda düzeltme istendi{{else if eq .status `reopened`}}Yeniden başvurabilirsiniz{{else}}Cevabınız incelendi{{end}} · {{.formTitle}} | `formTitle`, `status`, `reviewNote`, `reviewedAt`, `nextFormId`, `questionCount`, `firstName`, `recipientName`, `linkedFormId` |
| Forms · Görev Güncellemesi 🔒 | `forms.attempt-update` | {{if eq .kind `reminder`}}Görevi henüz başlatmadınız{{else if eq .kind `extended`}}Sürenizi uzattık{{else if eq .kind `accepted`}}Tesliminiz kabul edildi{{else if eq .kind `closed`}}Tesliminiz kabul edilmedi{{else}}Süreniz doldu{{end}} · {{.formTitle}} | `formTitle`, `formId`, `kind`, `deadlineAt`, `minutes`, `duration`, `nextFormId`, `firstName`, `recipientName` |

🔒 = sistem şablonu: arşivlenemez, anahtarı değiştirilemez.
🙈 = içeriği maskeli: SkyMail gönderimin içeriğini gösterir ama kodları ve tek kullanımlık bağlantıları sunucuda gizler (kod, tek kullanımlık ya da hesap bağlantısı, bilet kodu taşır).

## Ne zaman gider

- **Serbest Gönderim** (`free.basic`) — SkyMail'de elle: alıcıları seç, konuyu ve gövdeyi yaz, gönder.
- **Keycloak · E-posta Doğrulama** (`keycloak.verify-email`) — Keycloak, hesap açılışında veya e-posta doğrulanmamışken (sky-account SPI üzerinden SkyMail'e düşer).
- **Keycloak · Parola Sıfırlama** (`keycloak.reset-password`) — Keycloak, giriş ekranında "parolamı unuttum" akışında.
- **Keycloak · E-posta Değişikliği Doğrulama** (`keycloak.update-email`) — Keycloak, kişi hesabının e-posta adresini değiştirdiğinde — doğrulama YENİ adrese gider.
- **Keycloak · YTÜ Hesabı Bağlama** (`keycloak.idp-link`) — Keycloak, YTÜ Microsoft kimliği mevcut bir SKY LAB hesabına bağlanırken (IdP link).
- **Keycloak · Kişisel E-posta Onayı** (`keycloak.personal-email-confirm`) — Account center'da ya da ilk YTÜ girişinin sonundaki öneride kişisel e-posta eklendiğinde; 6 haneli kod, 10 dakika geçerli, yalnız isteyen kişinin açık oturumunda çalışır (K3c, ADR-0044 güncellemesi). Keycloak'tan K5 ile gelir.
- **Keycloak · Giriş Kodu** (`keycloak.login-code`) — Keycloak'ın e.yildizskylab.com giriş sayfasında "E-postayla devam et" ile kod istendiğinde (sky-email-code, eskylab-login-ux 08, ADR-0063). Kod hesabın birincil e-postasına gider; 6 haneli, 10 dakika geçerli, yalnız isteyen tarayıcıda çalışır. purpose: login (giriş), signup (kayıt), link (YTÜ ilk girişinde var olan hesabı bağlama) ve sudo (Hesap Merkezi’nde işlem onaylama; yalnız parolası, passkey’i ve TOTP’si olmayanlara, o anki doğrulanmış birincil adrese, Account center oturumuna bağlı). Keycloak'tan K5 ile gelir.
- **Keycloak · E-posta Kodu Sınır Alarmı** (`keycloak.login-code-alarm`) — Keycloak, realm'in gün içinde (UTC) gönderdiği e-posta kodları günlük genel sınırın yarısına ve sonuna ulaştığında ve günün ilk hesabı yanlış kod tavanına ulaştığında (güvenlik incelemesi K2), günde birer kez, /ADMIN grubunun her üyesine ayrı ayrı (SKY_EMAIL_CODE_ALARM_GROUP; eskylab-login-ux 08). Ayrıca bir hesabın kalıcı ardışık yanlış e-posta kodu sayacı 99'dan 100'e yükseldiğinde, işlem commit olduktan sonra bir kez aynı gruba uyarı gider (eskylab-login-ux 24). Kod isteyen kişiyi, adresi ya da IP'yi taşımaz. SkyMail'e ulaşılamazsa Keycloak aynı uyarıyı sayılarla, düz metinle SMTP'den yollar.
- **Keycloak · Genel Sistem Postası** (`keycloak.generic`) — Keycloak gönderici SPI'ın yedeği: eşlenmemiş bir sistem postası (ileride eklenecek bir required action gibi) bu anahtara düşer. subjectKey hangi posta olduğunu söyler.
- **Hoş Geldin** (`core.welcome`) — core-backend, yeni bir User ilk kez göründüğünde (SKYMAIL_WELCOME_TEMPLATE_ID).
- **Katılım Sertifikası** (`core.certificate`) — core-backend, yoklama kesinleştikten sonra sertifika üretildiğinde (SKYMAIL_CERTIFICATE_TEMPLATE_ID, certificate/service.go).
- **Etkinlik İptali** (`core.event-cancelled`) — core-backend, etkinlik iptal edilirken "Bilet sahiplerine bildir" seçiliyse, bilet sahiplerinin her birine bir kez (internal/eventstatusmail).
- **Etkinlik Yeniden Yayında** (`core.event-reinstated`) — core-backend, iptal geri alınırken "Katılımcılara tekrar bildir" seçiliyse, iptal postası ulaşan her bilet sahibine bir kez (internal/eventstatusmail).
- **Geri Bildirim İsteği** (`core.feedback-request`) — core-backend, etkinlik ya da oturum bitişinden 2 saat sonra (ya da "Şimdi gönder" ile) yoklaması alınan her bilet sahibine; kişi başına günde tek posta, o günün formları tek listede (ADR-0069).
- **Geri Bildirim Hatırlatması** (`core.feedback-reminder`) — core-backend, ilk geri bildirim postasından 3 gün sonra, tek sefer, henüz cevaplanmamış ve iptal edilmemiş formlarla; kişi başına günde tek posta (ADR-0069).
- **İletişim İzni Onayı** (`core.contact-consent-confirm`) — core-backend, girişsiz verilen bir iletişim izni (Guest apply, Forms, Place, Guessr) pending yazıldığında; aynı izin için günde en çok bir, toplam en çok üç posta (çift onay, ADR-0062, docs/contact-consents.md). CONTACT_CONSENT_KEY açıkken gider. Ad taşımaz.
- **Hesap Güvenlik Bildirimi** (`account.security-alert`) — Account center / sky-account SPI, hesapta güvenlikle ilgili bir şey değiştiğinde: parola değişti, geçiş anahtarı eklendi/silindi, doğrulama uygulaması eklendi/kaldırıldı, yeni cihazdan giriş, tüm oturumlar kapatıldı, kullanıcı adı değişti, kişisel e-posta eklendi/kaldırıldı.
- **Birincil E-posta Değişti (eski adrese)** (`account.primary-email-changed`) — Account center, birincil e-posta değiştiğinde — ESKİ adrese gider. Yeni adres zaten doğrulama postası aldığı için bu, değişikliği kaçıran kişiye tek uyarıdır.
- **Hesap Silme Talebi Alındı** (`account.deletion-requested`) — Account center, kişi hesabını sildiğinde. Erişim anında kapanır, kişisel veriler sonra anonimleştirilir (ADR-0042). ACCOUNT_ERASURE_MODE açıldığında devreye girer.
- **Hesap Silindi** (`account.deletion-completed`) — Account center, anonimleştirme tamamlandığında. Bu, bu adrese gönderdiğimiz son postadır.
- **Etkinlik · Bilet Oluşturuldu** (`event.ticket-created`) — core-backend, Member apply / Guest apply / Apply-for-other bir Ticket yazdığında. NOT: bu gönderimi yapan kod henüz yazılmadı.
- **Etkinlik · Hatırlatma** (`event.reminder`) — Etkinlikten bir gün önce, bileti olan herkese. NOT: zamanlayıcı ve gönderim kodu henüz yazılmadı; konu satırı T-1 varsayıyor.
- **Etkinlik · Güncellendi** (`event.updated`) — Etkinliğin saati veya yeri değiştiğinde, bileti olan herkese. NOT: gönderim kodu henüz yazılmadı.
- **Mail Onayı · Onayını Bekliyor** (`mail.approval-requested`) — SkyMail, gönderme yetkisi olmayan biri taslak gönderdiğinde onaycılara (ADR-0031, CONTEXT.md "Mail onayı", ticket 19).
- **Mail Onayı · Sonuçlandı** (`mail.approval-resolved`) — SkyMail, bir onay isteği sonuçlandığında. approved/rejected/returned/expired talebi açana, declined onaycılara gider (ADR-0031, ticket 19).
- **Operasyon · Gönderim Hatası** (`ops.send-failed`) — SkyMail, bir görevdeki mailler yeniden denemeler bittikten sonra da gönderilemediğinde, gönderimi başlatan kişiye. NOT: bu uyarıyı gönderen kod henüz yazılmadı.
- **Kulüp · Takım Üyeliği Değişti** (`club.team-membership`) — core-backend, admin panelinde bir kişi bir takıma ya da takımın LIDERLER/KOORDINATORLER alt grubuna eklendiğinde veya oradan çıkarıldığında; değişikliği kuyruğa yazar ve SkyMail'e anahtarla gönderir (core-backend#215, docs/team-membership-mail.md).
- **Kulüp · Yönetim Grubu Üyeliği Değişti** (`club.role-membership`) — core-backend, admin panelinde bir kişi ayrıcalıklı bir gruba (Yönetim Kurulu, Denetim Kurulu, yönetici grubu ya da bunların alt grupları; AUTHZ_PRIVILEGED_ROOTS) eklendiğinde veya oradan çıkarıldığında; değişikliği kuyruğa yazar ve SkyMail'e anahtarla gönderir (docs/team-membership-mail.md).
- **Kulüp · Grup Üyeliği Değişti** (`club.group-membership`) — core-backend, admin panelinde bir kişi takım ya da yönetim grubu olmayan bir gruba (kulüp, alan grupları ör. /UYELER/ARGE, alanın LIDERLER'i, teknik gruplar) eklendiğinde veya oradan çıkarıldığında; değişikliği kuyruğa yazar ve SkyMail'e anahtarla gönderir (docs/team-membership-mail.md).
- **Kulüp · Yetki Değişikliği Bildirimi** (`club.privilege-change`) — core-backend, yönetim yetkisi veren bir değişiklikte (docs/privilege-change-mail.md): bir grubun rol eşlemesi değişince yalnız ADMIN üyelerine; bir yönetim grubuna (ADMIN, YK, DK ya da altları; AUTHZ_PRIVILEGED_ROOTS) kişi eklenince ya da çıkarılınca ADMIN üyelerine ve o kökün diğer üyelerine. Değişikliği yapan ve eklenen/çıkarılan kişi bu postayı almaz; kişi kendi club.role-membership postasını alır. Core kuyruğa yazar ve SkyMail'e anahtarla gönderir.
- **Kulüp · Haber ve Duyuru** (`club.news`) — SkyMail, bir News kaydı (inscribed `news`) e-postayla gönderilirken (`POST /v1/news_sends`, duyuru-haber bilet 06): kaydın gönderim anındaki hâli, core'un çözdüğü kitlenin her kişisine bir kez. `AudienceReason`, `CategoryLabel` ve `UnsubscribeUrl` kişinin kendisinin (core'un kitle ucundan); künye "neden aldın" cümlesini ve kategoriden çıkış bağlantısını gösterir. Sözleşme değişkenleri `ReadMoreUrl` ve `UnsubscribeUrl`.
- **Forms · Cevap Durumu** (`forms.status-changed`) — forms-backend, ekip bir cevabı onayladığında (approved), reddettiğinde (declined) ya da düzeltme istediğinde (returned); akış adımındaysa sonraki adımın formu nextFormId ile gelir. Ekip bir başvuruyu kapatıp yeniden başvuruya açtığında da (reopened) akışın ilk formu nextFormId ile gelir (FormMailNotifier.NotifyStatusChangedAsync / NotifyRunReopenedAsync). Gövde forms-frontend mail-templates/StatusChanged.jsx.
- **Forms · Görev Güncellemesi** (`forms.attempt-update`) — forms-backend, süreli bir görevde (süre sınırlı form): görevi başlatmamış kişiye hatırlatma (reminder), ekip süreyi uzattığında (extended), süre dolduğunda cevap varsa (expired) ya da yoksa (expiredEmpty), süre dolduğunda kaydedilen cevap teslim olarak kabul edildiğinde (accepted) ya da edilmediğinde (closed) (FormMailNotifier.NotifyAttemptAsync, FormAttemptService). Gövde forms-frontend mail-templates/AttemptUpdate.jsx.
