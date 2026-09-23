/**
 * The Visual editor's schema: the blocks, marks and inline nodes of the render
 * module's Visual document (src/lib/mail-render/visual-document.ts) and
 * nothing else, so what an operator can put together is what the document can
 * hold. Built on tiptap as Skyforms' editor is (ADR-0046), with our own nodes.
 *
 * These are the nodes without their views, so the schema can be built where
 * there is no DOM (the Node tests); extensions.tsx gives the editor's blocks
 * their React views.
 *
 * Paste reads only what the schema knows: headings and paragraphs with bold,
 * italic and links, and rules. Anything else pasted from elsewhere comes in
 * as its text. The editor's own blocks copy and paste within it by their data
 * attributes; an image from a web page does not become an image block.
 */
import { Node, mergeAttributes, type Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { linkAddressProblem, type VisualAllowance, type VisualBlockType } from "@/lib/mail-render/visual-document";

/** A text attribute kept in a data-* attribute, so a block copied within the editor keeps it. */
const dataAttribute = (name: string, fallback: string) => ({
  default: fallback,
  parseHTML: (element: HTMLElement) => element.getAttribute(`data-${name}`) ?? fallback,
  renderHTML: (attributes: Record<string, unknown>) => ({ [`data-${name}`]: String(attributes[name] ?? fallback) }),
});

/** The house Heading: one level, text and variables, no marks. */
export const HeadingNode = Node.create({
  name: "heading",
  group: "block",
  content: "inline*",
  marks: "",
  defining: true,
  parseHTML: () => [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}` })),
  renderHTML: ({ HTMLAttributes }) => ["h2", mergeAttributes(HTMLAttributes), 0],
});

/** A variable in running text, `{{.name}}` when rendered. */
export const VariableNode = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ name: dataAttribute("name", "") }),
  parseHTML: () => [{ tag: "span[data-variable]" }],
  renderHTML: ({ node, HTMLAttributes }) => [
    "span",
    mergeAttributes(HTMLAttributes, { "data-variable": "" }),
    `{{.${node.attrs.name as string}}}`,
  ],
  renderText: ({ node }) => `{{.${node.attrs.name as string}}}`,
});

/**
 * A button: its label and where it goes. Both kinds of link are kept while
 * the operator switches between them; the document takes the one chosen.
 */
export const ButtonNode = Node.create({
  name: "button",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes: () => ({
    label: dataAttribute("label", "Devam et"),
    linkKind: dataAttribute("link-kind", "url"),
    url: dataAttribute("url", "https://yildizskylab.com"),
    variable: dataAttribute("variable", ""),
  }),
  parseHTML: () => [{ tag: "div[data-button]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-button": "" })],
});

/** An image: PNG or JPG over https, its description, and a width or the mail's. */
export const ImageNode = Node.create({
  name: "image",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes: () => ({
    src: dataAttribute("src", ""),
    alt: dataAttribute("alt", ""),
    width: {
      default: null,
      parseHTML: (element: HTMLElement) => {
        const width = Number(element.getAttribute("data-width"));
        return Number.isFinite(width) && width > 0 ? width : null;
      },
      renderHTML: (attributes: Record<string, unknown>) =>
        attributes.width === null ? {} : { "data-width": String(attributes.width) },
    },
  }),
  parseHTML: () => [{ tag: "div[data-image]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-image": "" })],
});

export const DividerNode = Node.create({
  name: "divider",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: "hr" }],
  renderHTML: () => ["hr"],
});

/** Blocks that show only when a variable is set, or only when it is not. */
export const ConditionalNode = Node.create({
  name: "conditional",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes: () => ({
    variable: dataAttribute("variable", ""),
    when: dataAttribute("when", "set"),
  }),
  parseHTML: () => [{ tag: "div[data-conditional]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-conditional": "" }), 0],
});

/** Document, paragraph, text, the marks allowed and the editing aids, from Skyforms' StarterKit; nothing else of it. */
function basics({ marks }: VisualAllowance) {
  return StarterKit.configure({
    blockquote: false,
    bulletList: false,
    code: false,
    codeBlock: false,
    hardBreak: false,
    heading: false,
    horizontalRule: false,
    listItem: false,
    listKeymap: false,
    orderedList: false,
    strike: false,
    underline: false,
    bold: marks.includes("bold") ? {} : false,
    italic: marks.includes("italic") ? {} : false,
    link: marks.includes("link")
      ? {
          openOnClick: false,
          autolink: false,
          linkOnPaste: false,
          defaultProtocol: "https",
          isAllowedUri: (url) => linkAddressProblem(url) === null,
        }
      : false,
  });
}

/** The blocks of our own, by the model's name; the paragraph is the StarterKit's and always there. */
export const BLOCK_NODES: Readonly<Record<Exclude<VisualBlockType, "paragraph">, Node>> = {
  heading: HeadingNode,
  button: ButtonNode,
  image: ImageNode,
  divider: DividerNode,
  conditional: ConditionalNode,
};

/**
 * The schema for what `allowance` lets a document use (EVERY_VISUAL_FEATURE
 * for a Mail template's body): a block, mark or variable it leaves out is not
 * in the schema at all, so it can be neither typed nor pasted in.
 */
export function visualSchemaExtensions(allowance: VisualAllowance): Extensions {
  const blocks = (Object.keys(BLOCK_NODES) as (keyof typeof BLOCK_NODES)[])
    .filter((type) => allowance.blocks.includes(type) && (type !== "conditional" || allowance.variables))
    .map((type) => BLOCK_NODES[type]);
  return [basics(allowance), ...(allowance.variables ? [VariableNode] : []), ...blocks];
}
