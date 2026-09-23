/**
 * Visual mode: a document of blocks (visual-document.ts) as the mail it
 * stands for, built from the club's own mail components and nothing else —
 * no markup, colour or style of the renderer's own, so a Visual mail has the
 * house look by construction: the dark theme's role classes and the opaque
 * surfaces come with the components. index.ts renders it through the same
 * path as a JSX template, so the HTML and plain-text rules are the same.
 *
 * Variables and conditions become the Go template actions the mailer fills
 * per send, the way emails/go.ts writes them. A button whose link is a
 * variable stands inside `{{if .X}}`, so a send without the value gets no
 * button rather than one that goes nowhere.
 *
 * Loaded only when a Visual source is rendered, like jsx.ts: the club's
 * components bring React Email with them. Nothing here runs code from the
 * document.
 */
import * as React from "react";
import type { ComponentType, ReactNode } from "react";
import { end, ifNotSet, ifSet, v } from "../../../emails/go";
import { Cta, Divider, Em, Figure, Heading, Paragraph, Shell, Strong, TextLink } from "../../../emails/theme";
import type { VisualBlock, VisualDocument, VisualInline } from "./visual-document";

/** The action that prints one `{`: a raw string, since React writes `"` as `&quot;` and the mailer cannot parse that. */
const TYPED_BRACE = "{{`{`}}";

/**
 * What an operator typed, as the mailer will print it. Here text is only
 * text, so every `{` in it is written as the action that prints it: a brace
 * left bare could meet another — at the end of one piece of text and the
 * start of the next, which the plain text and the preview line run together
 * — and open an action nobody wrote, or one the mailer cannot parse.
 */
export const asText = (typed: string) => typed.replaceAll("{", TYPED_BRACE);

/** An inline node, its marks around it: a link inside, then italic, then bold. */
function inline(node: VisualInline, key: number): ReactNode {
  let content: ReactNode = node.type === "text" ? asText(node.text) : v(node.name);
  const marks = node.marks ?? [];
  const link = marks.find((mark) => mark.type === "link");
  const wrapped: ((inner: ReactNode) => ReactNode)[] = [];
  if (link) wrapped.push((inner) => <TextLink href={link.href}>{inner}</TextLink>);
  if (marks.some((mark) => mark.type === "italic")) wrapped.push((inner) => <Em>{inner}</Em>);
  if (marks.some((mark) => mark.type === "bold")) wrapped.push((inner) => <Strong>{inner}</Strong>);
  for (const wrap of wrapped) content = wrap(content);
  return typeof content === "string" ? content : <React.Fragment key={key}>{content}</React.Fragment>;
}

const inlines = (content: readonly VisualInline[]) => content.map(inline);

/** How much of a preview line React Email keeps; it drops the rest wherever that falls. */
const PREVIEW_LENGTH = 150;

/**
 * The inline content as the inbox's preview line: as much as fits, cut
 * between characters or actions and never inside one, which would leave the
 * mailer a template it cannot parse.
 */
function previewLine(content: readonly VisualInline[]): string {
  const pieces: string[] = [];
  for (const node of content) {
    if (node.type === "variable") {
      pieces.push(v(node.name));
      continue;
    }
    for (const character of node.text) pieces.push(asText(character));
  }
  let line = "";
  for (const piece of pieces) {
    if (line.length + piece.length > PREVIEW_LENGTH) break;
    line += piece;
  }
  return line;
}

/**
 * The blocks as house components; an empty paragraph, heading or section is
 * none. `above` says whether something is rendered above them, which is what
 * gives a heading its space.
 */
function blocks(list: readonly VisualBlock[], above: boolean): ReactNode[] {
  const nodes: ReactNode[] = [];
  list.forEach((block, key) => {
    switch (block.type) {
      case "heading":
        if (block.content.length === 0) return;
        nodes.push(
          <Heading key={key} spaced={above}>
            {inlines(block.content)}
          </Heading>,
        );
        break;
      case "paragraph":
        if (block.content.length === 0) return;
        nodes.push(<Paragraph key={key}>{inlines(block.content)}</Paragraph>);
        break;
      case "button": {
        const label = asText(block.label);
        if ("url" in block.link) {
          nodes.push(
            <Cta key={key} href={block.link.url}>
              {label}
            </Cta>,
          );
        } else {
          const name = block.link.variable;
          nodes.push(
            <React.Fragment key={key}>
              {ifSet(name)}
              <Cta href={v(name)}>{label}</Cta>
              {end}
            </React.Fragment>,
          );
        }
        break;
      }
      case "image":
        nodes.push(<Figure key={key} src={block.src} alt={asText(block.alt)} width={block.width} />);
        break;
      case "divider":
        nodes.push(<Divider key={key} />);
        break;
      case "conditional": {
        const inside = blocks(block.blocks, above);
        if (inside.length === 0) return;
        nodes.push(
          <React.Fragment key={key}>
            {block.when === "set" ? ifSet(block.variable) : ifNotSet(block.variable)}
            {inside}
            {end}
          </React.Fragment>,
        );
        break;
      }
    }
    above = true;
  });
  return nodes;
}

/**
 * The document as a mail component, or null when none of its blocks shows
 * anything: an empty paragraph is not a body.
 */
export function visualMail(document: VisualDocument): ComponentType | null {
  const nodes = blocks(document.blocks, false);
  if (nodes.length === 0) return null;
  const opening = document.blocks.find(
    (block): block is Extract<VisualBlock, { type: "heading" | "paragraph" }> =>
      (block.type === "heading" || block.type === "paragraph") && block.content.length > 0,
  );
  const preview = opening ? previewLine(opening.content) : "";
  return function VisualMail() {
    return <Shell preview={preview}>{nodes}</Shell>;
  };
}
