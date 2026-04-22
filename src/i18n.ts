import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      tr: {
        translation: {
          templates: {
            templates: "Şablonlar",
            titles: {
              create: "Şablon Oluştur",
              edit: "Şablonu Düzenle",
              list: "Şablonlar",
              show: "Şablonu Görüntüle",
            },
            fields: {
              name: "Şablon Adı",
              name_required: "Lütfen şablon adını giriniz",
              name_placeholder: "Örn: Hoş Geldin E-postası",
              subject: "E-posta Konusu",
              subject_required: "Lütfen e-posta konusunu giriniz",
              subject_placeholder: "Örn: Hoş Geldiniz!",
              id: "ID",
              created_at: "Oluşturulma Tarihi",
              react_email_editor: "React Email Editörü (JSX)",
              live_preview: "Canlı Önizleme (HTML Çıktısı)",
              available_variables: "Kullanılabilir Değişkenler",
              render_error: "Render Hatası",
              html_content: "HTML İçeriği",
              plain_text_content: "Düz Metin İçeriği",
              actions: "İşlemler",
              note: "Skymail değişkenlerini (örn: {{.FullName}}) JSX içinde kullanırken React hatalarını önlemek için süslü parantez ve tırnak içinde {\"{{.FullName}}\"} şeklinde kullanmalısınız. Değişkenlere tıklayarak bu formatta otomatik ekleme yapabilirsiniz. Değişkenleri başlıkta kullanırken ise doğrudan {{.FullName}} formatını kullanabilirsiniz. React Email component argument'ları (props) desteklenmemektedir.",
            },
          },
          mailing_lists: {
            mailing_lists: "Mail Listeleri",
            titles: {
              create: "Liste Oluştur",
              edit: "Listeyi Düzenle",
              list: "Mail Listeleri",
              show: "Listeyi Görüntüle",
            },
            fields: {
              name: "Liste Adı",
              name_required: "Lütfen liste adını giriniz",
              name_placeholder: "Örn: Beta Kullanıcıları",
              id: "ID",
              created_at: "Oluşturulma Tarihi",
              recipients: "Alıcılar",
              add_recipient: "Alıcı Ekle",
              email: "E-posta",
              full_name: "Ad Soyad",
              actions: "İşlemler",
            },
          },
          applications: {
            applications: "Uygulamalar",
            titles: {
              create: "Uygulama Oluştur",
              edit: "Uygulamayı Düzenle",
              list: "Uygulamalar",
              show: "Uygulama Detayı",
            },
            fields: {
              id: "ID",
              name: "İsim",
              name_required: "Lütfen uygulama adını giriniz",
              name_placeholder: "Örn: Skyforms",
              token_version: "Token Versiyonu",
              created_at: "Oluşturulma",
              updated_at: "Güncellenme",
            },
            buttons: {
              reroll: "Token Yenile",
            },
            reroll: {
              title: "Token Yenile",
              content: "Eski token geçersiz olacak. Yeni bir token oluşturmak istediğinize emin misiniz?",
              success: "Token başarıyla yenilendi.",
              error: "Token yenilenirken hata oluştu.",
              warning: "Lütfen bu token'ı güvenli bir yere kaydedin. Bir daha göremeyeceksiniz.",
              newToken: "Yeni Token",
            }
          },
          mail_tasks: {
            mail_tasks: "Mail Gönderimleri",
            titles: {
              create: "Yeni Gönderim",
              list: "Mail Gönderimleri",
              show: "Gönderim Detayı",
            },
            fields: {
              id: "ID",
              template: "Şablon",
              mailing_list: "Mail Listesi",
              created_at: "Gönderim Tarihi",
              status: "Durum",
              recipient: "Alıcı",
              subject: "Konu",
              error: "Hata",
            },
            statuses: {
              pending: "Bekliyor",
              processing: "İşleniyor",
              sent: "Gönderildi",
              failed: "Hata",
            }
          },
          // Refine Core Translations
          actions: {
            add: "Ekle",
            back: "Geri",
            cancel: "Iptal",
            clone: "Klonla",
            create: "Oluştur",
            delete: "Sil",
            edit: "Düzenle",
            export: "Dışa Aktar",
            import: "İçe Aktar",
            list: "Liste",
            save: "Kaydet",
            show: "Göster",
            filter: "Filtrele",
            clear: "Temizle",
            search: "Ara",
          },
          buttons: {
            save: "Kaydet",
            cancel: "İptal",
            delete: "Sil",
            edit: "Düzenle",
            create: "Oluştur",
            import: "İçe Aktar",
            export: "Dışa Aktar",
            refresh: "Yenile",
            show: "Göster",
            logout: "Çıkış Yap",
            login: "Giriş Yap",
          },
          notifications: {
            success: "Başarılı",
            error: "Hata",
            createSuccess: "Başarıyla oluşturuldu",
            updateSuccess: "Başarıyla güncellendi",
            editSuccess: "Başarıyla düzenlendi",
            deleteSuccess: "Başarıyla silindi",
            createError: "Oluşturulurken hata oluştu",
            updateError: "Güncellenirken hata oluştu",
            editError: "Düzenlenirken hata oluştu",
            deleteError: "Silinirken hata oluştu",
          },
          table: {
            actions: "İşlemler",
            filteredBy: "Filtrelendi",
          },
          errors: {
            404: "Sayfa bulunamadı",
          },
          warnWhenUnsavedChanges: "Kaydedilmemiş değişiklikleriniz var. Ayrılmak istediğinizden emin misiniz?",
        },
      },
    },
    lng: "tr",
    fallbackLng: "tr",
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
