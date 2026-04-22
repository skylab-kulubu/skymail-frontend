import { Edit, useForm } from "@refinedev/antd";
import { Form, Input } from "antd";
import { useTranslation } from "react-i18next";

export const ApplicationEdit = () => {
    const { formProps, saveButtonProps, query } = useForm();
    const { t } = useTranslation();

    return (
        <Edit saveButtonProps={saveButtonProps} isLoading={query?.isFetching} title={t("applications.titles.edit", "Uygulamayı Düzenle")}>
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
        </Edit>
    );
};
