import { Edit, useForm } from "@refinedev/antd";
import { useNavigation } from "@refinedev/core";
import { Form, Input } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export const MailingListEdit = () => {
    const { t } = useTranslation();
    const { list } = useNavigation();
    const { formProps, saveButtonProps, query } = useForm({
        resource: "mailing_lists"
    });

    const record = query?.data?.data;

    useEffect(() => {
        if (record && record.source !== "internal") {
            list("mailing_lists");
        }
    }, [record]);

    return (
        <Edit 
            saveButtonProps={{ ...saveButtonProps, children: t("buttons.save") }} 
            title={
                <span style={{ letterSpacing: "-0.02em", fontWeight: 700 }}>
                    {t("mailing_lists.titles.edit")}
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
        </Edit>
    );
};
