import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Select } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

export const MailTaskCreate = () => {
    const { t } = useTranslation();
    const [params] = useSearchParams();
    const mailListId = params.get("mail_list_id") ?? undefined;
    const { formProps, saveButtonProps } = useForm({
        resource: "mail_tasks",
        redirect: "list",
    });

    useEffect(() => {
        if (mailListId) {
            formProps.form?.setFieldsValue({ mail_list_id: mailListId });
        }
    }, [mailListId, formProps.form]);

    const { selectProps: templateSelectProps } = useSelect({
        resource: "templates",
        optionLabel: "name",
    });

    const { selectProps: mailingListSelectProps } = useSelect({
        resource: "mailing_lists",
        optionLabel: "name",
    });

    return (
        <Create 
            saveButtonProps={saveButtonProps} 
            title={t("mail_tasks.titles.create")}
        >
            <Form {...formProps} layout="vertical">
                <Form.Item
                    label={t("mail_tasks.fields.template")}
                    name="template_id"
                    rules={[{ required: true }]}
                >
                    <Select {...templateSelectProps} />
                </Form.Item>
                <Form.Item
                    label={t("mail_tasks.fields.mailing_list")}
                    name="mail_list_id"
                    rules={[{ required: true }]}
                >
                    <Select {...mailingListSelectProps} />
                </Form.Item>
            </Form>
        </Create>
    );
};
