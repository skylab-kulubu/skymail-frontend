import {
    DateField,
    Show,
    useTable,
} from "@refinedev/antd";
import { useShow, useNavigation } from "@refinedev/core";
import { Typography, Card, Row, Col, Table, Tag } from "antd";
import { useTranslation } from "react-i18next";

const { Title, Text } = Typography;

export const MailTaskShow = () => {
    const { t } = useTranslation();
    const { show } = useNavigation();
    const { query } = useShow({
        resource: "mail_tasks",
    });
    const { data, isLoading } = query;
    const record = data?.data;

    const { tableProps } = useTable({
        resource: `mail_tasks/${record?.id}/queue`,
        syncWithLocation: false,
        filters: {
          permanent: [
            {
              field: "mailTaskId",
              operator: "eq",
              value: record?.id,
            },
          ],
        },
        queryOptions: {
            enabled: !!record?.id,
        },
    });

    const getStatusTag = (status: any) => {
        const s = status?.mail_queue_status;
        switch (s) {
            case "sent":
                return <Tag color="success">{t("mail_tasks.statuses.sent")}</Tag>;
            case "processing":
                return <Tag color="processing">{t("mail_tasks.statuses.processing")}</Tag>;
            case "failed":
                return <Tag color="error">{t("mail_tasks.statuses.failed")}</Tag>;
            case "pending":
            default:
                return <Tag color="default">{t("mail_tasks.statuses.pending")}</Tag>;
        }
    };

    return (
        <Show
            isLoading={isLoading}
            title={
                <span style={{ letterSpacing: "-0.02em", fontWeight: 700 }}>
                    {t("mail_tasks.titles.show")}
                </span>
            }
        >
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <Card size="small">
                        <Row gutter={16}>
                            <Col span={6}>
                                <Title level={5} style={{ margin: 0 }}>{t("mail_tasks.fields.id")}</Title>
                                <Text>{record?.id}</Text>
                            </Col>
                            <Col span={6}>
                                <Title level={5} style={{ margin: 0 }}>{t("mail_tasks.fields.template")}</Title>
                                <Text 
                                    style={{ color: "#1890ff", cursor: "pointer", fontWeight: 500 }}
                                    onClick={() => show("templates", record?.template_id)}
                                >
                                    {record?.template_name}
                                </Text>
                            </Col>
                            <Col span={6}>
                                <Title level={5} style={{ margin: 0 }}>{t("mail_tasks.fields.mailing_list")}</Title>
                                <Text 
                                    style={{ color: "#fa8c16", cursor: "pointer", fontWeight: 500 }}
                                    onClick={() => show("mailing_lists", record?.mail_list_id)}
                                >
                                    {record?.mail_list_name}
                                </Text>
                            </Col>
                            <Col span={6}>
                                <Title level={5} style={{ margin: 0 }}>{t("mail_tasks.fields.created_at")}</Title>
                                <DateField value={record?.created_at} format="LLL" />
                            </Col>
                        </Row>
                    </Card>
                </Col>
                <Col span={24}>
                    <Card title={t("mailing_lists.fields.recipients")}>
                        <Table {...tableProps} rowKey="id">
                            <Table.Column 
                                dataIndex="recipient_full_name" 
                                title={t("mailing_lists.fields.full_name")} 
                            />
                            <Table.Column 
                                dataIndex="recipient_email" 
                                title={t("mailing_lists.fields.email")} 
                            />
                            <Table.Column 
                                dataIndex="status" 
                                title={t("mail_tasks.fields.status")} 
                                render={(value) => getStatusTag(value)}
                            />
                            <Table.Column 
                                dataIndex="error" 
                                title={t("mail_tasks.fields.error")} 
                                render={(value) => value ? <Text type="danger">{value}</Text> : "-"}
                            />
                        </Table>
                    </Card>
                </Col>
            </Row>
        </Show>
    );
};
