import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Select } from "antd";
import { useTranslation } from "react-i18next";

export const MailTaskCreate = () => {
    const { t } = useTranslation();
    const { formProps, saveButtonProps } = useForm({
        resource: "mail_tasks",
        redirect: "list",
    });

    const { selectProps: templateSelectProps } = useSelect({
        resource: "templates",
    });

    const { selectProps: mailingListSelectProps } = useSelect({
        resource: "mailing_lists",
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
