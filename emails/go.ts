/**
 * Go template actions, written as strings so JSX does not swallow the braces.
 *
 * `{{.Name}}` in a .tsx file has to be `{v("Name")}`, otherwise JSX reads the
 * outer braces as an expression. Keeping the actions behind these helpers also
 * means a typo shows up in one place rather than in twenty templates.
 */
export const v = (name: string) => `{{.${name}}}`;

export const ifSet = (name: string) => `{{if .${name}}}`;

export const ifEq = (name: string, value: string) => `{{if eq .${name} \`${value}\`}}`;

export const elseBranch = "{{else}}";

/** `{{else if eq .Name `value`}}` — the chain Go templates use in place of a switch. */
export const elseIfEq = (name: string, value: string) => `{{else if eq .${name} \`${value}\`}}`;

export const end = "{{end}}";

/** `{{if .X}}a{{else}}b{{end}}` as one string, for attributes and subjects. */
export const cond = (name: string, whenSet: string, otherwise = "") =>
  `${ifSet(name)}${whenSet}${elseBranch}${otherwise}${end}`;
