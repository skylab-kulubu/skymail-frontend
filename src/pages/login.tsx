import { useLogin, useLogout } from "@refinedev/core";
import { Button, Layout, Space, Typography, Result } from "antd";
import { useTranslation } from "react-i18next";
import { useKeycloak } from "@react-keycloak/web";

export const Login: React.FC = () => {
  const { mutate: login } = useLogin();
  const { mutate: logout } = useLogout();
  const { t } = useTranslation();
  const { keycloak } = useKeycloak();

  if (keycloak?.authenticated) {
    return (
      <Layout
        style={{
          height: "100vh",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Result
          status="403"
          title="Erişim Reddedildi"
          subTitle="Skymail'e erişim yetkiniz bulunmuyor. Lütfen yetkili bir hesapla tekrar deneyin."
          extra={
            <Button type="primary" onClick={() => logout()}>
              Çıkış Yap
            </Button>
          }
        />
      </Layout>
    );
  }

  return (
    <Layout
      style={{
        height: "100vh",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Space direction="vertical" align="center" size="large">
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "36px" }}>
          <img
            src="/skylab.svg"
            width="48"
            height="48"
            alt="SKY LAB"
          />
          <Typography.Title level={2} style={{ margin: 0, fontSize: "48px", color: "inherit", letterSpacing: "-0.04em" }}>
            Skymail
          </Typography.Title>
        </div>
        <Button
          style={{ width: "240px", height: "44px" }}
          type="primary"
          size="middle"
          onClick={() => login({})}
        >
          {t("buttons.login", "Giriş Yap")}
        </Button>
        <Typography.Link type="secondary" style={{ marginTop: "16px" }} href="https://enesgenc.dev" target="_blank">
          🛠️ Enes Genç
        </Typography.Link>
      </Space>
    </Layout>
  );
};
