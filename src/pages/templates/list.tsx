import {
    DateField,
    DeleteButton,
    EditButton,
    List,
    ShowButton,
    useTable,
} from "@refinedev/antd";
import { Space, Table, Tag, Tooltip, Typography } from "antd";
import { useTranslation } from "react-i18next";

export const TemplateList = () => {
    const { t } = useTranslation();
    const { tableProps } = useTable({
        syncWithLocation: true,
    });

    return (
        <List title={
            <span style={{ letterSpacing: "-0.02em", fontWeight: 700 }}>
                {t("templates.titles.list")}
            </span>
        }>
            <Table {...tableProps} rowKey="id">
                <Table.Column dataIndex="id" title={t("templates.fields.id")} />
                <Table.Column
                    dataIndex="name"
                    title={t("templates.fields.name")}
                    render={(value: string, record: any) => (
                        <Space size={6}>
                            <span>{value}</span>
                            {record.system && (
                                <Tooltip title={t("templates.fields.system_locked")}>
                                    <Tag color="purple">{t("templates.fields.system_badge")}</Tag>
                                </Tooltip>
                            )}
                        </Space>
                    )}
                />
                <Table.Column
                    dataIndex="key"
                    title={t("templates.fields.key")}
                    render={(value: string | null) =>
                        value ? <Typography.Text code>{value}</Typography.Text> : <Typography.Text type="secondary">—</Typography.Text>
                    }
                />
                <Table.Column dataIndex="subject" title={t("templates.fields.subject")} />
                <Table.Column
                    dataIndex="created_at"
                    title={t("templates.fields.created_at")}
                    render={(value: string) => <DateField value={value} format="LLL" />}
                />
                <Table.Column
                    title={t("templates.fields.actions")}
                    dataIndex="actions"
                    render={(_, record: any) => (
                        <Space>
                            <EditButton hideText size="small" recordItemId={record.id} />
                            <ShowButton hideText size="small" recordItemId={record.id} />
                            {/* A system template is addressed by key by another
                                service, so archiving it would silently break that
                                service's mail. The API refuses it too. */}
                            {record.system ? (
                                <Tooltip title={t("templates.fields.system_locked")}>
                                    <DeleteButton hideText size="small" recordItemId={record.id} disabled />
                                </Tooltip>
                            ) : (
                                <DeleteButton hideText size="small" recordItemId={record.id} />
                            )}
                        </Space>
                    )}
                />
            </Table>
        </List>
    );
};
