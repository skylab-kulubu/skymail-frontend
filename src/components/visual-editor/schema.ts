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
 * italic and links, rules, and — where the body has them — lists, quotes,
 * sub-headings and line breaks. Anything else pasted from elsewhere comes in
 * as its text. The editor's own blocks copy and paste within it by their data
 * attributes; an image from a web page does not become an image block.
 */
import { Node, mergeAttributes, type Extensions } from "@tiptap/core";
import { ListItem } from "@tiptap/extension-list";
import StarterKit from "@tiptap/starter-kit";
import { linkAddressProblem, type VisualAllowance, type VisualBlockType } from "@/lib/mail-render/visual-document";

/** A text attribute kept in a data-* attribute, so a block copied within the editor keeps it. */
const dataAttribute = (name: string, fallback: string) => ({
  default: fallback,
  parseHTML: (element: HTMLElement) => element.getAttribute(`data-${name}`) ?? fallback,
  renderHTML: (attributes: Record<string, unknown>) => ({ [`data-${name}`]: String(attributes[name] ?? fallback) }),
});

/** The house Heading: one level, one line of text and variables, no marks. */
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

/** A list item is one line of text: a paragraph and nothing else, so no list nests in another. */
export const ListItemNode = ListItem.extend({ content: "paragraph" });

/**
 * A heading with a level, where the body has sub-headings: 2 the main one,
 * 3 a sub-heading. What is pasted as h3 or deeper is a sub-heading.
 */
const LeveledHeading = HeadingNode.extend({
  addAttributes: () => ({ level: { default: 2, rendered: false } }),
  parseHTML: () => [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, attrs: { level: level >= 3 ? 3 : 2 } })),
  renderHTML: ({ node, HTMLAttributes }) => [`h${node.attrs.level === 3 ? 3 : 2}`, mergeAttributes(HTMLAttributes), 0],
});

/**
 * A quoted passage: one paragraph, set apart. Enter leaves it for a new
 * paragraph after it; Shift+Enter breaks a line inside it.
 */
export const QuoteNode = Node.create({
  name: "blockquote",
  group: "block",
  content: "paragraph",
  defining: true,
  parseHTML: () => [{ tag: "blockquote" }],
  renderHTML: ({ HTMLAttributes }) => ["blockquote", mergeAttributes(HTMLAttributes), 0],
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || !editor.isActive(this.name)) return false;
        const after = $from.after($from.depth - 1);
        return editor.chain().insertContentAt(after, { type: "paragraph" }).setTextSelection(after + 1).run();
      },
    };
  },
});

/**
 * Document, paragraph, text, the marks allowed and the editing aids, from
 * Skyforms' StarterKit; and where the body has them, its lists and line
 * breaks (Shift+Enter). Nothing else of it.
 */
function basics({ marks, blocks, lineBreaks }: VisualAllowance) {
  const lists = blocks.includes("list");
  return StarterKit.configure({
    blockquote: false,
    bulletList: lists ? {} : false,
    code: false,
    codeBlock: false,
    hardBreak: lineBreaks ? {} : false,
    heading: false,
    horizontalRule: false,
    // Ours (ListItemNode), one line each.
    listItem: false,
    listKeymap: lists ? {} : false,
    orderedList: lists ? {} : false,
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

/** The blocks of our own, by the model's name; the paragraph and the lists are the StarterKit's. */
export const BLOCK_NODES: Readonly<Record<Exclude<VisualBlockType, "paragraph" | "list">, Node>> = {
  heading: HeadingNode,
  quote: QuoteNode,
  button: ButtonNode,
  image: ImageNode,
  divider: DividerNode,
  conditional: ConditionalNode,
};

/**
 * The schema for what `allowance` lets a document use (TEMPLATE_BODY_ALLOWANCE
 * for a Mail template's body): a block, mark, variable or line break it
 * leaves out is not in the schema at all, so it can be neither typed nor
 * pasted in. A heading stays one line.
 */
export function visualSchemaExtensions(allowance: VisualAllowance): Extensions {
  const blocks = (Object.keys(BLOCK_NODES) as (keyof typeof BLOCK_NODES)[])
    .filter((type) => allowance.blocks.includes(type) && (type !== "conditional" || allowance.variables))
    .map((type) =>
      type === "heading"
        ? (allowance.subheadings ? LeveledHeading : HeadingNode).extend({ content: allowance.variables ? "(text | variable)*" : "text*" })
        : BLOCK_NODES[type],
    );
  return [
    basics(allowance),
    ...(allowance.blocks.includes("list") ? [ListItemNode] : []),
    ...(allowance.variables ? [VariableNode] : []),
    ...blocks,
  ];
}
