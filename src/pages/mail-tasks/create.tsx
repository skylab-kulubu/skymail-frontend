import { Create, useSelect } from "@refinedev/antd";
import { useNavigation, useNotification, useOne } from "@refinedev/core";
import { Alert, Card, Col, Form, Input, Radio, Row, Select, Space, Tag, Typography } from "antd";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { API_URL } from "../../providers/constants";
import { RICH_TEXT_VARIABLE, extractVariables, toEmailHtml } from "../../lib/rich-text";

const { Text } = Typography;

type Template = {
    id: string;
    name: string;
    subject: string;
    html_content: string;
    key?: string | null;
};

type Audience = "list" | "people";

type Option = { label: string; value: string };

/** One address per line, or separated by commas / semicolons. */
function parseRecipients(raw: string): { email: string; name: string }[] {
    return raw
        .split(/[\n,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            // "Ad Soyad <adres@ornek.com>" ya da düz adres.
            const named = /^(.*?)\s*<([^>]+)>$/.exec(entry);
            if (named) {
                return { name: named[1].trim(), email: named[2].trim() };
            }
            return { name: "", email: entry };
        });
}

export const MailTaskCreate = () => {
    const { t } = useTranslation();
    const [params] = useSearchParams();
    const { list } = useNavigation();
    const { open } = useNotification();

    const presetListId = params.get("mail_list_id") ?? undefined;
    const [audience, setAudience] = useState<Audience>(presetListId ? "list" : "list");
    const [templateId, setTemplateId] = useState<string | undefined>();
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [mailListId, setMailListId] = useState<string | undefined>(presetListId);
    const [people, setPeople] = useState("");
    const [sending, setSending] = useState(false);

    // Only the options are taken from useSelect: its selectProps are typed for
    // an option-object value, and both selects here are controlled by id.
    const { selectProps: templateSelectProps } = useSelect({
        resource: "templates",
        optionLabel: "name",
    });
    const { selectProps: mailingListSelectProps } = useSelect({
        resource: "mailing_lists",
        optionLabel: "name",
    });

    const templateOptions = (templateSelectProps.options ?? []) as Option[];
    const mailingListOptions = (mailingListSelectProps.options ?? []) as Option[];

    // The template itself, not just its label: its body is where the variable
    // list comes from, because SkyMail does not store one.
    const { result: template } = useOne<Template>({
        resource: "templates",
        id: templateId ?? "",
        queryOptions: { enabled: Boolean(templateId) },
    });

    const templateRecord = template as Template | undefined;

    const required = useMemo(
        () => extractVariables(templateRecord?.html_content, templateRecord?.subject),
        [templateRecord?.html_content, templateRecord?.subject],
    );

    useEffect(() => {
        // Keep whatever the sender already typed for a variable the new template
        // also uses; drop the rest so a stale value cannot ride along.
        setVariables((previous) => {
            const kept: Record<string, string> = {};
            for (const name of required) {
                kept[name] = previous[name] ?? "";
            }
            return kept;
        });
    }, [required]);

    const recipients = useMemo(() => parseRecipients(people), [people]);
    const bodyPreview = useMemo(
        () => (variables[RICH_TEXT_VARIABLE] ? toEmailHtml(variables[RICH_TEXT_VARIABLE]) : ""),
        [variables],
    );

    const missing = required.filter((name) => !variables[name]?.trim());

    const canSend =
        Boolean(templateId) &&
        !sending &&
        (audience === "list" ? Boolean(mailListId) : recipients.length > 0);

    const send = async () => {
        if (!templateId) {
            return;
        }

        setSending(true);
        try {
            // The rich text variable travels as HTML; everything else is plain
            // text the template escapes.
            const bodyVariables: Record<string, string> = {};
            for (const [name, value] of Object.entries(variables)) {
                bodyVariables[name] = name === RICH_TEXT_VARIABLE ? toEmailHtml(value) : value;
            }

            if (audience === "list") {
                await axios.post(`${API_URL}/mail_tasks`, {
                    template_id: templateId,
                    mail_list_id: mailListId,
                    body_variables: bodyVariables,
                });
            } else {
                // There is no bulk endpoint for an ad-hoc set of people, so each
                // one is its own single send. They are independent: if the tenth
                // fails, the first nine have already gone.
                for (const recipient of recipients) {
                    await axios.post(`${API_URL}/mail_tasks/single`, {
                        template_id: templateId,
                        recipient_email: recipient.email,
                        recipient_full_name: recipient.name,
                        body_variables: bodyVariables,
                    });
                }
            }

            open?.({
                type: "success",
                message: t("mail_tasks.compose.sent"),
                description:
                    audience === "list"
                        ? t("mail_tasks.compose.sent_list")
                        : t("mail_tasks.compose.sent_people", { count: recipients.length }),
            });
            list("mail_tasks");
        } catch (error) {
            open?.({
                type: "error",
                message: t("mail_tasks.compose.failed"),
                description: axios.isAxiosError(error)
                    ? `${error.response?.status ?? ""} ${JSON.stringify(error.response?.data ?? {})}`
                    : String(error),
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <Create
            title={t("mail_tasks.titles.create")}
            saveButtonProps={{
                onClick: send,
                loading: sending,
                disabled: !canSend,
                children: t("mail_tasks.compose.send"),
            }}
        >
            <Form layout="vertical">
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label={t("mail_tasks.fields.template")} required>
                            <Select
                                showSearch
                                optionFilterProp="label"
                                options={templateOptions}
                                value={templateId}
                                onChange={setTemplateId}
                                placeholder={t("mail_tasks.fields.template")}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label={t("mail_tasks.compose.audience")}>
                            <Radio.Group
                                value={audience}
                                onChange={(event) => setAudience(event.target.value as Audience)}
                                optionType="button"
                                buttonStyle="solid"
                                options={[
                                    { label: t("mail_tasks.compose.audience_list"), value: "list" },
                                    { label: t("mail_tasks.compose.audience_people"), value: "people" },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                {audience === "list" ? (
                    <Form.Item label={t("mail_tasks.fields.mailing_list")} required>
                        <Select
                            showSearch
                            optionFilterProp="label"
                            options={mailingListOptions}
                            value={mailListId}
                            onChange={setMailListId}
                            placeholder={t("mail_tasks.fields.mailing_list")}
                        />
                    </Form.Item>
                ) : (
                    <Form.Item
                        label={t("mail_tasks.compose.people")}
                        extra={t("mail_tasks.compose.people_help")}
                        required
                    >
                        <Input.TextArea
                            rows={4}
                            value={people}
                            onChange={(event) => setPeople(event.target.value)}
                            placeholder={"ad.soyad@yildizskylab.com\nAyşe Yılmaz <ayse@ornek.com>"}
                        />
                        {recipients.length > 0 && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {t("mail_tasks.compose.people_count", { count: recipients.length })}
                            </Text>
                        )}
                    </Form.Item>
                )}

                {templateId && required.length === 0 && (
                    <Alert type="info" showIcon message={t("mail_tasks.compose.no_variables")} />
                )}

                {required.length > 0 && (
                    <Card
                        size="small"
                        title={
                            <Space>
                                {t("mail_tasks.compose.variables")}
                                {missing.length > 0 && <Tag color="warning">{t("mail_tasks.compose.missing", { count: missing.length })}</Tag>}
                            </Space>
                        }
                        style={{ marginTop: 8 }}
                    >
                        <Alert
                            type="warning"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message={t("mail_tasks.compose.missing_warning")}
                        />

                        {required.map((name) =>
                            name === RICH_TEXT_VARIABLE ? (
                                <Form.Item key={name} label={t("mail_tasks.compose.body")} extra={t("mail_tasks.compose.body_help")}>
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Input.TextArea
                                                rows={12}
                                                value={variables[name] ?? ""}
                                                onChange={(event) =>
                                                    setVariables((previous) => ({ ...previous, [name]: event.target.value }))
                                                }
                                                placeholder={"## Başlık\n\nMerhaba, **GECEKODU** başvuruları açıldı.\n\n- 12–13 Nisan\n- Davutpaşa Kampüsü\n\n[Başvuruya git](https://skyl.app/gecekodu)"}
                                            />
                                        </Col>
                                        <Col span={12}>
                                            <Card size="small" title={t("mail_tasks.compose.body_preview")} styles={{ body: { minHeight: 260 } }}>
                                                {/* Safe by construction: this markup was produced by
                                                    toEmailHtml, which escapes the sender's input and
                                                    only ever emits tags from its own allowlist. */}
                                                <div dangerouslySetInnerHTML={{ __html: bodyPreview }} />
                                            </Card>
                                        </Col>
                                    </Row>
                                </Form.Item>
                            ) : (
                                <Form.Item key={name} label={<code>{`{{.${name}}}`}</code>}>
                                    <Input
                                        value={variables[name] ?? ""}
                                        onChange={(event) =>
                                            setVariables((previous) => ({ ...previous, [name]: event.target.value }))
                                        }
                                    />
                                </Form.Item>
                            ),
                        )}
                    </Card>
                )}
            </Form>
        </Create>
    );
};
