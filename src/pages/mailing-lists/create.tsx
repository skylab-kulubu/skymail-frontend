import { Create, useForm } from "@refinedev/antd";
import { Form, Input } from "antd";
import { useTranslation } from "react-i18next";

export const MailingListCreate = () => {
    const { t } = useTranslation();
    const { formProps, saveButtonProps } = useForm({
        resource: "mailing_lists"
    });

    return (
        <Create 
            saveButtonProps={{ ...saveButtonProps, children: t("buttons.save") }} 
            title={
                <span style={{ letterSpacing: "-0.02em", fontWeight: 700 }}>
                    {t("mailing_lists.titles.create")}
                </span>
            }
        >
            <Form {...formProps} layout="vertical">
                <Form.Item
                    label={t("mailing_lists.fields.name")}
                    name="name"
                    rules={[{ required: true, message: t("mailing_lists.fields.name_required") }]}
                >
                    <Input placeholder={t("mailing_lists.fields.name_placeholder")} />
                </Form.Item>
            </Form>
        </Create>
    );
};
