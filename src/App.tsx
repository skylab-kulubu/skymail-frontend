import { Authenticated, AuthProvider, Refine } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import {
  ErrorComponent,
  ThemedLayout,
  ThemedSider,
  useNotificationProvider,
  ThemedTitle,
} from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";

import { useKeycloak } from "@react-keycloak/web";
import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { App as AntdApp } from "antd";
import axios from "axios";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";
import { Header } from "./components";
import { ColorModeContextProvider } from "./contexts/color-mode";
import {
  TemplateCreate,
  TemplateEdit,
  TemplateList,
  TemplateShow,
} from "./pages/templates";
import {
  MailingListCreate,
  MailingListEdit,
  MailingListList,
  MailingListShow,
} from "./pages/mailing-lists";
import {
  MailTaskCreate,
  MailTaskList,
  MailTaskShow,
} from "./pages/mail-tasks";
import { Login } from "./pages/login";
import { dataProvider } from "./providers/data";
import { useTranslation } from "react-i18next";
import { UnorderedListOutlined, FileTextOutlined, SendOutlined } from "@ant-design/icons";

function App() {
  const { keycloak, initialized } = useKeycloak();
  const { t, i18n } = useTranslation();

  if (!initialized) {
    return <div>Loading...</div>;
  }

  const i18nProvider = {
    translate: (key: string, options?: any) => t(key, options) as string,
    changeLocale: async (lang: string) => {
      await i18n.changeLanguage(lang);
    },
    getLocale: () => i18n.language,
  };

  const authProvider: AuthProvider = {
    login: async () => {
      const urlSearchParams = new URLSearchParams(window.location.search);
      const { to } = Object.fromEntries(urlSearchParams.entries());
      await keycloak.login({
        redirectUri: to ? `${window.location.origin}${to}` : undefined,
      });
      return {
        success: true,
      };
    },
    logout: async () => {
      try {
        await keycloak.logout({
          redirectUri: window.location.origin,
        });
        return {
          success: true,
          redirectTo: "/login",
        };
      } catch (error) {
        return {
          success: false,
          error: new Error("Logout failed"),
        };
      }
    },
    onError: async (error) => {
      console.error(error);
      return { error };
    },
    check: async () => {
      try {
        if (keycloak.authenticated) {
          await keycloak.updateToken(5);
          const { token } = keycloak;
          if (token) {
            axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
            return {
              authenticated: true,
            };
          }
        }

        console.log("Not authenticated or no token found");
        return {
          authenticated: false,
          logout: true,
          redirectTo: "/login",
          error: {
            message: "Check failed",
            name: "Not authenticated",
          },
        };
      } catch (error) {
        console.error("Keycloak token update error:", error);
        return {
          authenticated: false,
          logout: true,
          redirectTo: "/login",
          error: {
            message: "Check failed",
            name: "Token update failed",
          },
        };
      }
    },
    getPermissions: async () => {
      if (keycloak.authenticated) {
        return keycloak.resourceAccess?.[keycloak.clientId || ""]?.roles || [];
      }
      return [];
    },
    getIdentity: async () => {
      if (keycloak?.tokenParsed) {
        console.log("Keycloak User Data:", keycloak.tokenParsed);
        return {
          name: keycloak.tokenParsed.name,
        };
      }
      return null;
    },
  };

  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ColorModeContextProvider>
          <AntdApp>
            <DevtoolsProvider>
              <Refine
                dataProvider={dataProvider}
                notificationProvider={useNotificationProvider}
                routerProvider={routerProvider}
                authProvider={authProvider}
                i18nProvider={i18nProvider}
                resources={[
                  {
                    name: "templates",
                    list: "/templates",
                    create: "/templates/create",
                    edit: "/templates/edit/:id",
                    show: "/templates/show/:id",
                    meta: {
                      canDelete: true,
                      label: t("templates.templates"),
                      icon: <FileTextOutlined/>,
                    },
                  },
                  {
                    name: "mailing_lists",
                    list: "/mailing-lists",
                    create: "/mailing-lists/create",
                    edit: "/mailing-lists/edit/:id",
                    show: "/mailing-lists/show/:id",
                    meta: {
                      canDelete: true,
                      label: t("mailing_lists.mailing_lists"),
                      icon: <UnorderedListOutlined/>,
                    },
                  },
                  {
                    name: "mail_tasks",
                    list: "/mail-tasks",
                    create: "/mail-tasks/create",
                    show: "/mail-tasks/show/:id",
                    meta: {
                      label: t("mail_tasks.mail_tasks"),
                      icon: <SendOutlined/>,
                    },
                  },
                ]}
                options={{
                  syncWithLocation: true,
                  warnWhenUnsavedChanges: true,
                  projectId: "J7S1JU-Q2jzuW-nMkn1D",
                  title: {
                    text: "Skymail",
                    icon: (
                      <img
                        src="/skylab.svg"
                        width="32"
                        height="32"
                        alt="Skymail"
                      />
                    ),
                  },
                }}
              >
                <Routes>
                  <Route
                    element={
                      <Authenticated
                        key="authenticated-inner"
                        fallback={<CatchAllNavigate to="/login"/>}
                      >
                        <ThemedLayout
                          Header={Header}
                          Sider={(props) => <ThemedSider {...props} fixed/>}
                          Title={({ collapsed }) => (
                            <ThemedTitle
                              collapsed={collapsed}
                              text={
                                <span style={{
                                  fontWeight: 800,
                                  letterSpacing: "-0.05em",
                                  fontSize: "18px",
                                  marginLeft: "12px"
                                }}>
                                                            Skymail
                                                          </span>
                              }
                              icon={
                                <img
                                  src="/skylab.svg"
                                  width="32"
                                  height="32"
                                  alt="SKY LAB"
                                />
                              }
                            />
                          )}
                        >
                          <Outlet/>
                        </ThemedLayout>
                      </Authenticated>
                    }
                  >
                    <Route
                      index
                      element={<NavigateToResource resource="templates"/>}
                    />
                    <Route path="/templates">
                      <Route index element={<TemplateList/>}/>
                      <Route path="create" element={<TemplateCreate/>}/>
                      <Route path="edit/:id" element={<TemplateEdit/>}/>
                      <Route path="show/:id" element={<TemplateShow/>}/>
                    </Route>
                    <Route path="/mailing-lists">
                      <Route index element={<MailingListList/>}/>
                      <Route path="create" element={<MailingListCreate/>}/>
                      <Route path="edit/:id" element={<MailingListEdit/>}/>
                      <Route path="show/:id" element={<MailingListShow/>}/>
                    </Route>
                    <Route path="/mail-tasks">
                      <Route index element={<MailTaskList/>}/>
                      <Route path="create" element={<MailTaskCreate/>}/>
                      <Route path="show/:id" element={<MailTaskShow/>}/>
                    </Route>
                    <Route path="*" element={<ErrorComponent/>}/>
                  </Route>
                  <Route
                    element={
                      <Authenticated
                        key="authenticated-outer"
                        fallback={<Outlet/>}
                      >
                        <NavigateToResource/>
                      </Authenticated>
                    }
                  >
                    <Route path="/login" element={<Login/>}/>
                  </Route>
                </Routes>

                <RefineKbar/>
                <UnsavedChangesNotifier/>
                <DocumentTitleHandler handler={({ params, resource }) => {
                  const id = params?.id ? ` #${params.id}` : "";
                  const name = resource?.meta?.label || resource?.name || "";
                  return `${name}${id} | Skymail`;
                }}/>
              </Refine>
              <DevtoolsPanel/>
            </DevtoolsProvider>
          </AntdApp>
        </ColorModeContextProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
