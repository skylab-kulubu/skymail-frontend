import { Create, useForm } from "@refinedev/antd";
import { Form, Input, Row, Col, Card, Typography, Alert, theme } from "antd";
import Editor from "@monaco-editor/react";
import { useState, useEffect, useRef } from "react";
import { render } from "@react-email/render";
import * as ReactEmail from "@react-email/components";
import * as Babel from "@babel/standalone";
import React from "react";
import { useTranslation } from "react-i18next";

const { Text } = Typography;
const { useToken } = theme;

// Default starter template introducing the editor
const DEFAULT_TEMPLATE = `
import { 
  Button, 
  Html, 
  Head, 
  Body, 
  Container, 
  Section, 
  Text, 
  Heading, 
  Hr, 
  Img, 
  Link, 
  Tailwind,
  Preview,
  Row,
  Column
} from '@react-email/components';

export default function Email() {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>Skymail Editörüne Hoş Geldiniz!</Preview>
        <Body className="bg-slate-50 font-sans py-12">
          <Container className="bg-white mx-auto p-10 rounded-2xl shadow-xl border border-slate-100 max-w-[600px]">
            <Section className="my-5">
              <Img
                src="https://yildizskylab.com/static/media/skylab-logo.073a10615624c3396d17.png"
                width="140"
                alt="YTU SKY LAB"
                className="mx-auto"
              />
            </Section>

            <Section>
              <Heading className="text-slate-900 text-3xl font-extrabold text-center tracking-tight mb-4">
                Skymail & React Email
              </Heading>
              <Text className="text-slate-600 text-lg leading-8 text-center">
                Modern e-posta geliştirme deneyimine hoş geldiniz. Bu editör, 
                <strong> React Email</strong> gücünü kullanarak profesyonel şablonlar oluşturmanıza olanak sağlar.
              </Text>
            </Section>

            <Hr className="border-slate-100 my-10" />

            <Section>
              <Heading className="text-slate-800 text-xl font-bold mb-6">
                Neler Yapabilirsiniz?
              </Heading>
              <Row className="mb-4">
                <Column className="w-[32px] text-indigo-600 font-bold text-xl">✓</Column>
                <Column>
                  <Text className="text-slate-600 m-0 text-base"><strong>Tailwind CSS:</strong> Tüm sınıfları doğrudan kullanabilirsiniz.</Text>
                </Column>
              </Row>
              <Row className="mb-4">
                <Column className="w-[32px] text-indigo-600 font-bold text-xl">✓</Column>
                <Column>
                  <Text className="text-slate-600 m-0 text-base"><strong>Live Preview:</strong> Kodunuzu yazarken sağ tarafta anlık çıktıyı görün.</Text>
                </Column>
              </Row>
              <Row>
                <Column className="w-[32px] text-indigo-600 font-bold text-xl">✓</Column>
                <Column>
                  <Text className="text-slate-600 m-0 text-base"><strong>TypeScript:</strong> Interface ve tip desteğiyle hatasız geliştirme yapın.</Text>
                </Column>
              </Row>
            </Section>

            <Section className="mt-12 text-center">
              <Button
                className="bg-indigo-600 rounded-xl text-white text-base font-bold no-underline text-center px-10 py-5 inline-block shadow-lg hover:bg-indigo-700 transition-all"
                href="https://react.email/docs"
              >
                React Email Dökümantasyonu
              </Button>
              <Text className="text-slate-400 text-sm mt-4">
                Bileşenleri keşfetmek için yukarıdaki butona tıklayın.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
`.trim();

export const TemplateCreate = () => {
    const { t } = useTranslation();
    const { token: themeToken } = useToken();
    const { formProps, saveButtonProps, onFinish } = useForm();
    const [code, setCode] = useState(DEFAULT_TEMPLATE);
    const [previewHtml, setPreviewHtml] = useState("");
    const [previewPlainText, setPreviewPlainText] = useState("");
    const [error, setError] = useState<string | null>(null);
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

    const transpileAndRender = async (currentCode: string) => {
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
            setError(null);
        } catch (err: any) {
            console.error("Render error:", err);
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

    const handleFormFinish = async (values: any) => {
        const finalValues = {
            ...values,
            html_content: previewHtml,
            plain_text_content: previewPlainText,
            react_email_content: code,
        };
        return onFinish(finalValues);
    };

    return (
        <Create saveButtonProps={{ ...saveButtonProps, onClick: () => formProps.form?.submit(), children: t("buttons.save") }} title={t("templates.titles.create")}>
            <Form {...formProps} layout="vertical" onFinish={handleFormFinish}>
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
                
                <Form.Item name="html_content" hidden><Input /></Form.Item>
                <Form.Item name="plain_text_content" hidden><Input /></Form.Item>
                <Form.Item name="react_email_content" hidden><Input /></Form.Item>

                <div style={{ minHeight: error ? "auto" : "0", marginBottom: error ? 16 : 0 }}>
                    {error && (
                        <Alert
                            message={t("templates.fields.render_error")}
                            description={error}
                            type="error"
                            showIcon
                        />
                    )}
                </div>

                <Row gutter={16}>
                    <Col span={12}>
                        <Card title={t("templates.fields.react_email_editor")} bodyStyle={{ padding: 0 }}>
                            <Editor
                                height="calc(100vh - 300px)"
                                defaultLanguage="javascript"
                                theme="vs-dark"
                                defaultValue={code}
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
        </Create>
    );
};
