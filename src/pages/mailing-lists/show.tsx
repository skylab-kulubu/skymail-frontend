import { DateField, Show, useModalForm, useTable } from "@refinedev/antd";
import { useShow, useDelete } from "@refinedev/core";
import { Typography, Card, Row, Col, Table, Button, Space, Modal, Form, Input } from "antd";
import { useTranslation } from "react-i18next";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export const MailingListShow = () => {
  const { t } = useTranslation();
  const { query } = useShow({
    resource: "mailing_lists"
  });
  const { data, isLoading } = query;
  const record = data?.data;

  const { tableProps: recipientTableProps, tableQuery: { refetch } } = useTable({
    resource: `mailing_lists/${record?.id}/recipients`,
    queryOptions: {
      enabled: !!record?.id
    },
    syncWithLocation: false,
  });

  const { mutate: deleteRecipient } = useDelete();

  const { modalProps, formProps, show } = useModalForm({
    resource: record?.id ? `mailing_lists/${record.id}/recipients` : "mailing_lists",
    action: "create",
    onMutationSuccess: () => {
      refetch();
    },
    syncWithLocation: false,
  });

  const handleDelete = (recipientId: string) => {
    deleteRecipient({
      resource: `mailing_lists/${record?.id}/recipients`,
      id: recipientId,
      successNotification: () => ({
        message: t("notifications.deleteSuccess"),
        type: "success"
      })
    }, {
      onSuccess: () => refetch()
    });
  };

  return (
    <Show
      isLoading={isLoading}
      title={
        <span style={{ letterSpacing: "-0.02em", fontWeight: 700 }}>
                    {t("mailing_lists.titles.show")}
                </span>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card size="small">
            <Row>
              <Col span={6}>
                <Title level={5} style={{ margin: 0 }}>{t("mailing_lists.fields.id")}</Title>
                <Text>{record?.id}</Text>
              </Col>
              <Col span={12}>
                <Title level={5} style={{ margin: 0 }}>{t("mailing_lists.fields.name")}</Title>
                <Text>{record?.name}</Text>
              </Col>
              <Col span={6}>
                <Title level={5} style={{ margin: 0 }}>{t("mailing_lists.fields.created_at")}</Title>
                <DateField value={record?.created_at} format="LLL"/>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={24}>
          <Card
            title={
              <span style={{ letterSpacing: "-0.01em", fontWeight: 600 }}>
                                {t("mailing_lists.fields.recipients")}
                            </span>
            }
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined/>}
                onClick={() => show()}
              >
                {t("mailing_lists.fields.add_recipient")}
              </Button>
            }
          >
            <Table
              {...recipientTableProps}
              rowKey="id"
              pagination={false}
            >
              <Table.Column dataIndex="full_name" title={t("mailing_lists.fields.full_name")}/>
              <Table.Column dataIndex="email" title={t("mailing_lists.fields.email")}/>
              <Table.Column
                title={t("mailing_lists.fields.actions")}
                dataIndex="actions"
                render={(_, record: any) => (
                  <Space>
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined/>}
                      onClick={() => handleDelete(record.id)}
                    />
                  </Space>
                )}
              />
            </Table>
          </Card>
        </Col>
      </Row>

      <Modal
        {...modalProps}
        title={t("mailing_lists.fields.add_recipient")}
        okText={t("buttons.save")}
        cancelText={t("buttons.cancel")}
        destroyOnClose
      >
        <Form {...formProps} layout="vertical">
          <Form.Item
            label={t("mailing_lists.fields.full_name")}
            name="full_name"
            rules={[{ required: true }]}
          >
            <Input/>
          </Form.Item>
          <Form.Item
            label={t("mailing_lists.fields.email")}
            name="email"
            rules={[{ required: true, type: "email" }]}
          >
            <Input/>
          </Form.Item>
        </Form>
      </Modal>
    </Show>
  );
};
