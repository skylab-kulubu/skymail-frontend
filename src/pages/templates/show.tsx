import { DateField, Show } from "@refinedev/antd";
import { useShow } from "@refinedev/core";
import { Typography, Card, Row, Col, theme } from "antd";
import { useTranslation } from "react-i18next";

const { Title, Text } = Typography;
const { useToken } = theme;

export const TemplateShow = () => {
    const { t } = useTranslation();
    const { token: themeToken } = useToken();
    const { query } = useShow();
    const { data, isLoading } = query;

    const record = data?.data;

    return (
        <Show isLoading={isLoading} title={t("templates.titles.show")}>
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <Card size="small">
                        <Row>
                            <Col span={6}>
                                <Title level={5} style={{ margin: 0 }}>{t("templates.fields.id")}</Title>
                                <Text>{record?.id}</Text>
                            </Col>
                            <Col span={9}>
                                <Title level={5} style={{ margin: 0 }}>{t("templates.fields.name")}</Title>
                                <Text>{record?.name}</Text>
                            </Col>
                            <Col span={9}>
                                <Title level={5} style={{ margin: 0 }}>{t("templates.fields.subject")}</Title>
                                <Text>{record?.subject}</Text>
                            </Col>
                        </Row>
                        <Row style={{ marginTop: 16 }}>
                            <Col span={24}>
                                <Title level={5} style={{ margin: 0 }}>{t("templates.fields.created_at")}</Title>
                                <DateField value={record?.created_at} format="LLL" />
                            </Col>
                        </Row>
                    </Card>
                </Col>
                <Col span={24}>
                    <Card title={t("templates.fields.live_preview")} bodyStyle={{ padding: 0 }}>
                        <iframe
                            title="Email Preview"
                            srcDoc={record?.html_content}
                            style={{
                                width: "100%",
                                height: "600px",
                                border: "none",
                                backgroundColor: "#f0f2f5",
                                display: "block",
                                borderRadius: "0 0 8px 8px",
                            }}
                        />
                    </Card>
                </Col>
                <Col span={24}>
                    <Card title={t("templates.fields.plain_text_content")}>
                        <div style={{ 
                            whiteSpace: "pre-wrap", 
                            backgroundColor: themeToken.colorFillAlter, 
                            padding: "16px", 
                            borderRadius: "4px",
                            fontFamily: "monospace",
                            border: `1px solid ${themeToken.colorBorderSecondary}`,
                            color: themeToken.colorText
                        }}>
                            {record?.plain_text_content}
                        </div>
                    </Card>
                </Col>
            </Row>
        </Show>
    );
};
