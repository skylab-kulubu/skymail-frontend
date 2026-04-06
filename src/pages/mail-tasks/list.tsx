import {
    DateField,
    List,
    ShowButton,
    useTable,
} from "@refinedev/antd";
import { Table, Tag } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@refinedev/core";

export const MailTaskList = () => {
    const { t } = useTranslation();
    const { show } = useNavigation();
    const { tableProps } = useTable({
        syncWithLocation: true,
        resource: "mail_tasks",
    });

    return (
        <List title={
            <span style={{ letterSpacing: "-0.02em", fontWeight: 700 }}>
                {t("mail_tasks.titles.list")}
            </span>
        }>
            <Table {...tableProps} rowKey="id">
                <Table.Column dataIndex="id" title={t("mail_tasks.fields.id")} />
                <Table.Column 
                    dataIndex="template_name" 
                    title={t("mail_tasks.fields.template")} 
                    render={(value, record: any) => (
                        <Tag 
                            color="blue" 
                            style={{ fontWeight: 500, cursor: "pointer" }}
                            onClick={() => show("templates", record.template_id)}
                        >
                            {value}
                        </Tag>
                    )}
                />
                <Table.Column 
                    dataIndex="mail_list_name" 
                    title={t("mail_tasks.fields.mailing_list")} 
                    render={(value, record: any) => (
                        <Tag 
                            color="orange" 
                            style={{ fontWeight: 500, cursor: "pointer" }}
                            onClick={() => show("mailing_lists", record.mail_list_id)}
                        >
                            {value}
                        </Tag>
                    )}
                />
                <Table.Column
                    dataIndex="created_at"
                    title={t("mail_tasks.fields.created_at")}
                    render={(value: string) => <DateField value={value} format="LLL" />}
                />
                <Table.Column
                    title={t("table.actions")}
                    dataIndex="actions"
                    render={(_, record: any) => (
                        <ShowButton hideText size="small" recordItemId={record.id} />
                    )}
                />
            </Table>
        </List>
    );
};
