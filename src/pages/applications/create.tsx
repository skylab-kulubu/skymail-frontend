import { Create, useForm } from "@refinedev/antd";
import { Form, Input, Typography, Modal as AntdModal, Button, theme } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@refinedev/core";
import { useState } from "react";

const { Paragraph } = Typography;

export const ApplicationCreate = () => {
    const { t } = useTranslation();
    const { show } = useNavigation();
    const [newToken, setNewToken] = useState<string | null>(null);
    const [createdId, setCreatedId] = useState<string | null>(null);
    const { token: themeToken } = theme.useToken();

    const { formProps, saveButtonProps } = useForm({
        redirect: false,
        mutationMode: "pessimistic",
        onMutationSuccess: (data: any) => {
            const token = data?.data?.token;
            const id = data?.data?.id;
            if (token && id) {
                setNewToken(token);
                setCreatedId(id);
            } else if (id) {
                show("applications", id);
            }
        },
    });

    const handleCloseModal = () => {
        setNewToken(null);
        if (createdId) {
            show("applications", createdId);
        }
    };

    return (
        <>
            <Create saveButtonProps={saveButtonProps} title={t("applications.titles.create", "Uygulama Oluştur")}>
                <Form {...formProps} layout="vertical">
                    <Form.Item
                        label={t("applications.fields.name", "İsim")}
                        name="name"
                        rules={[
                            {
                                required: true,
                            },
                        ]}
                    >
                        <Input />
                    </Form.Item>
                </Form>
            </Create>
            <AntdModal
                title={t("applications.reroll.newToken", "Yeni Token")}
                open={!!newToken}
                onOk={handleCloseModal}
                onCancel={handleCloseModal}
                closable={false}
                maskClosable={false}
                footer={[
                    <Button key="ok" type="primary" onClick={handleCloseModal}>
                        Tamam
                    </Button>
                ]}
            >
                <Paragraph>
                    {t("applications.reroll.warning", "Lütfen bu token'ı güvenli bir yere kaydedin. Bir daha göremeyeceksiniz.")}
                </Paragraph>
                <Paragraph copyable style={{ padding: "12px", background: themeToken.colorFillAlter, borderRadius: "6px", wordBreak: "break-all" }}>
                    {newToken}
                </Paragraph>
            </AntdModal>
        </>
    );
};
