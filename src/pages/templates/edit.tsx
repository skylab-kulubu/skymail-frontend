import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, Row, Col, Card, Typography, Alert, theme, App as AntdApp } from "antd";
import Editor from "@monaco-editor/react";
import { useState, useEffect, useRef } from "react";
import { render } from "@react-email/render";
import * as ReactEmail from "@react-email/components";
import * as Babel from "@babel/standalone";
import React from "react";
import { useTranslation } from "react-i18next";
import { decideSave } from "../../lib/template-render";

const { Text } = Typography;
const { useToken } = theme;

export const TemplateEdit = () => {
    const { t } = useTranslation();
    const { message } = AntdApp.useApp();
    const { token: themeToken } = useToken();
    const { formProps, saveButtonProps, query, onFinish } = useForm();

    // A system template's wording is editable; its key is the contract another
    // service calls it by, and the API refuses to change it.
    const isSystem = Boolean((query?.data?.data as { system?: boolean } | undefined)?.system);
    const [code, setCode] = useState("");
    const [previewHtml, setPreviewHtml] = useState("");
    const [previewPlainText, setPreviewPlainText] = useState("");
    const [error, setError] = useState<string | null>(null);
    // The code the current preview came from; see lib/template-render.
    const [renderedCode, setRenderedCode] = useState<string | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const editorRef = useRef<any>(null);

    const handleEditorDidMount = (editor: any) => {
        editorRef.current = editor;
    };

    const handleInsertVariable = (variable: string) => {
        if (editorRef.current) {
            const selection = editorRef.current.getSelection();
            const id = { major: 1, minor: 1 };
            // JSX uyumlu olması için {" "} içine alıyoruz
            const text = `{"${variable}"}`;
            const op = { identifier: id, range: selection, text: text, forceMoveMarkers: true };
            editorRef.current.executeEdits("my-source", [op]);
            editorRef.current.focus();
        }
    };

    // Set initial code when data is loaded
    useEffect(() => {
        const initialCode = query?.data?.data?.react_email_content;
        if (initialCode && !code) {
            setCode(initialCode);
        }
    }, [query?.data?.data]);

    const transpileAndRender = async (currentCode: string) => {
        if (!currentCode) return;
        try {
            // 1. Remove imports
            let processedCode = currentCode.replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, "");
            
            // 2. Replace export default with a constant assignment
            processedCode = processedCode.replace(/export\s+default\s+/, "const __Email = ");

            // 3. Transpile JSX/TSX to JS
            const transpiled = Babel.transform(processedCode, {
                presets: ["react", "typescript"],
                filename: "template.tsx",
            }).code;

            if (!transpiled) throw new Error("Transpilation failed");

            // 4. Create a function to execute the code and return the component
            const executionFunction = new Function("React", ...Object.keys(ReactEmail), `
                ${transpiled}
                return __Email;
            `);
            
            const EmailComponent = executionFunction(React, ...Object.values(ReactEmail));

            if (!EmailComponent) throw new Error("No default export found");

            // 5. Render to HTML and Plain Text
            const html = await render(<EmailComponent />, { pretty: true });
            const plainText = await render(<EmailComponent />, { plainText: true });

            setPreviewHtml(html);
            setPreviewPlainText(plainText);
            setRenderedCode(currentCode);
            setError(null);
        } catch (err: any) {
            console.error("Render error:", err);
            setRenderedCode(null);
            setError(err.message);
        }
    };

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        
        timerRef.current = setTimeout(() => {
            transpileAndRender(code);
        }, 500);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [code]);

    const stored = query?.data?.data as
        | { html_content?: string; plain_text_content?: string; react_email_content?: string }
        | undefined;
    const storedCode = stored?.react_email_content ?? null;
    const decision = decideSave({ code, renderedCode, previewHtml, error }, storedCode);
    const savable = decision !== "blocked";

    const handleFormFinish = async (values: any) => {
        // A submit can also come from Enter inside a field, so the disabled
        // save button is not the only way in.
        if (decision === "blocked") {
            message.error(t("templates.fields.render_required"));
            return;
        }
        // "keep": the code was never touched, so the row's own body goes back
        // untouched and only the wording around it changes.
        const body = decision === "render"
            ? { html_content: previewHtml, plain_text_content: previewPlainText, react_email_content: code }
            : {
                html_content: stored?.html_content ?? "",
                plain_text_content: stored?.plain_text_content ?? "",
                react_email_content: stored?.react_email_content ?? "",
            };
        return onFinish({ ...values, ...body });
    };

    return (
        <Edit saveButtonProps={{ ...saveButtonProps, disabled: !savable, onClick: () => formProps.form?.submit(), children: t("buttons.save") }} title={t("templates.titles.edit")}>
            <Form {...formProps} layout="vertical" onFinish={handleFormFinish}>
                {isSystem && (
                    <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message={t("templates.fields.system_locked")}
                    />
                )}

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={t("templates.fields.name")}
                            name="name"
                            rules={[{ required: true, message: t("templates.fields.name_required") }]}
                        >
                            <Input placeholder={t("templates.fields.name_placeholder")} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label={t("templates.fields.subject")}
                            name="subject"
                            rules={[{ required: true, message: t("templates.fields.subject_required") }]}
                        >
                            <Input placeholder={t("templates.fields.subject_placeholder")} />
                        </Form.Item>
                    </Col>
                </Row>
                
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={t("templates.fields.key")}
                            name="key"
                            extra={t("templates.fields.key_help")}
                            rules={[
                                {
                                    pattern: /^[a-z0-9][a-z0-9.-]{1,62}[a-z0-9]$/,
                                    message: t("templates.fields.key_help"),
                                },
                            ]}
                        >
                            <Input placeholder={t("templates.fields.key_placeholder")} disabled={isSystem} />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item name="html_content" hidden><Input /></Form.Item>
                <Form.Item name="plain_text_content" hidden><Input /></Form.Item>
                <Form.Item name="react_email_content" hidden><Input /></Form.Item>

                <div style={{ minHeight: decision === "render" ? "0" : "auto", marginBottom: decision === "render" ? 0 : 16 }}>
                    {decision === "keep" && error ? (
                        // Saving works, but not from this pane: the row's body
                        // goes back untouched and only the wording changes.
                        <Alert
                            message={t("templates.fields.source_in_repo")}
                            type="info"
                            showIcon
                        />
                    ) : decision === "blocked" && error ? (
                        <Alert
                            message={t("templates.fields.render_error")}
                            description={error}
                            type="error"
                            showIcon
                        />
                    ) : decision === "blocked" ? (
                        // Blocked with no error to show: the preview has not
                        // caught up. Say so, or the disabled button has no reason.
                        <Alert
                            message={t("templates.fields.render_pending")}
                            type="warning"
                            showIcon
                        />
                    ) : null}
                </div>

                <Row gutter={16}>
                    <Col span={12}>
                        <Card title={t("templates.fields.react_email_editor")} bodyStyle={{ padding: 0 }}>
                            <Editor
                                key={query?.data?.data?.id}
                                height="calc(100vh - 300px)"
                                defaultLanguage="javascript"
                                theme="vs-dark"
                                defaultValue={query?.data?.data?.react_email_content || ""}
                                onChange={(value) => setCode(value || "")}
                                onMount={handleEditorDidMount}
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    wordWrap: "on",
                                    scrollBeyondLastLine: false,
                                    unicodeHighlight: {
                                        ambiguousCharacters: false,
                                        invisibleCharacters: false,
                                        nonBasicASCII: false,
                                        includeCanAmbiguousCharacters: false,
                                        includeStrings: false,
                                    },
                                    renderControlCharacters: false,
                                }}
                            />
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card title={t("templates.fields.live_preview")} bodyStyle={{ padding: 0 }}>
                            <iframe
                                title={t("templates.fields.live_preview")}
                                srcDoc={previewHtml}
                                style={{
                                    width: "100%",
                                    height: "calc(100vh - 300px)",
                                    border: "none",
                                    backgroundColor: "#f0f2f5",
                                    display: "block",
                                    borderRadius: "0 0 8px 8px",
                                }}
                            />
                        </Card>
                    </Col>
                </Row>

                <Card size="small" style={{ marginTop: 16, backgroundColor: themeToken.colorFillAlter }}>
                    <Text strong>{t("templates.fields.available_variables")}:</Text>
                    <div style={{ marginTop: 8 }}>
                        {["{{.FullName}}"].map((variable) => (
                            <code 
                                key={variable}
                                onClick={() => handleInsertVariable(variable)}
                                style={{ 
                                    marginRight: 12, 
                                    padding: "4px 8px", 
                                    backgroundColor: themeToken.colorInfoBg, 
                                    border: `1px solid ${themeToken.colorInfoBorder}`, 
                                    borderRadius: 4,
                                    color: themeToken.colorInfoText,
                                    cursor: "pointer",
                                    userSelect: "none",
                                    display: "inline-block",
                                    marginBottom: 8,
                                    transition: "all 0.2s"
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = themeToken.colorInfoBgHover;
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = themeToken.colorInfoBg;
                                }}
                            >
                                {variable}
                            </code>
                        ))}
                    </div>
                    <Alert
                        style={{ marginTop: 12 }}
                        message={t("templates.fields.note")}
                        type="info"
                        showIcon
                    />
                </Card>
            </Form>
        </Edit>
    );
};
