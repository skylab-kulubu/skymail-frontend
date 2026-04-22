import {
    DateField,
    Show,
} from "@refinedev/antd";
import { useShow, useCustomMutation, useNotification } from "@refinedev/core";
import { Typography, Card, Row, Col, Button, Modal as AntdModal, App } from "antd";
import { useTranslation } from "react-i18next";
import { ReloadOutlined } from "@ant-design/icons";
import { useState } from "react";
import { API_URL } from "../../providers/constants";

const { Title, Text, Paragraph } = Typography;

export const ApplicationShow = () => {
    const { t } = useTranslation();
    const { query } = useShow({
        resource: "applications",
    });
    const { data, isLoading } = query;
    const record = data?.data;
    const { mutate } = useCustomMutation();
    const { open } = useNotification();
    const [isRerolling, setIsRerolling] = useState(false);
    const { modal } = App.useApp();

    const [newToken, setNewToken] = useState<string | null>(null);

    const handleReroll = () => {
        modal.confirm({
            title: t("applications.reroll.title", "Token Yenile"),
            content: t("applications.reroll.content", "Eski token geçersiz olacak. Yeni bir token oluşturmak istediğinize emin misiniz?"),
            onOk: () => {
                setIsRerolling(true);
                mutate({
                    url: `${API_URL}/applications/${record?.id}/reroll`,
                    method: "post",
                    values: {},
                }, {
                    onSuccess: (res: any) => {
                        setNewToken(res?.data?.token || null);
                        open?.({
                            type: "success",
                            message: t("applications.reroll.success", "Token başarıyla yenilendi."),
                        });
                        query.refetch();
                    },
                    onError: (error) => {
                        open?.({
                            type: "error",
                            message: error?.message || t("applications.reroll.error", "Token yenilenirken hata oluştu."),
                        });
                    },
                    onSettled: () => {
                        setIsRerolling(false);
                    }
                });
            }
        });
    };

    return (
        <>
            <Show
                isLoading={isLoading}
                title={<span style={{ letterSpacing: "-0.02em", fontWeight: 700 }}>{t("applications.titles.show", "Uygulama Detayı")}</span>}
                headerButtons={({ defaultButtons }) => (
                    <>
                        {defaultButtons}
                        <Button type="primary" danger icon={<ReloadOutlined />} onClick={handleReroll} loading={isRerolling}>
                            {t("applications.buttons.reroll", "Token Yenile")}
                        </Button>
                    </>
                )}
            >
                <Card size="small">
                    <Row gutter={[16, 16]}>
                        <Col span={8}>
                            <Title level={5} style={{ margin: 0 }}>ID</Title>
                            <Text>{record?.id}</Text>
                        </Col>
                        <Col span={8}>
                            <Title level={5} style={{ margin: 0 }}>{t("applications.fields.name", "İsim")}</Title>
                            <Text>{record?.name}</Text>
                        </Col>
                        <Col span={8}>
                            <Title level={5} style={{ margin: 0 }}>{t("applications.fields.token_version", "Token Versiyonu")}</Title>
                            <Text>{record?.token_version}</Text>
                        </Col>
                        <Col span={8}>
                            <Title level={5} style={{ margin: 0 }}>{t("applications.fields.created_at", "Oluşturulma")}</Title>
                            <DateField value={record?.created_at} format="LLL" />
                        </Col>
                        <Col span={8}>
                            <Title level={5} style={{ margin: 0 }}>{t("applications.fields.updated_at", "Güncellenme")}</Title>
                            <DateField value={record?.updated_at} format="LLL" />
                        </Col>
                    </Row>
                </Card>
            </Show>
            <AntdModal
                title={t("applications.reroll.newToken", "Yeni Token")}
                open={!!newToken}
                onOk={() => setNewToken(null)}
                onCancel={() => setNewToken(null)}
                footer={[
                    <Button key="ok" type="primary" onClick={() => setNewToken(null)}>
                        Tamam
                    </Button>
                ]}
            >
                <Paragraph>
                    {t("applications.reroll.warning", "Lütfen bu token'ı güvenli bir yere kaydedin. Bir daha göremeyeceksiniz.")}
                </Paragraph>
                <Paragraph copyable style={{ padding: "12px", background: "#f5f5f5", borderRadius: "6px", wordBreak: "break-all" }}>
                    {newToken}
                </Paragraph>
            </AntdModal>
        </>
    );
};
