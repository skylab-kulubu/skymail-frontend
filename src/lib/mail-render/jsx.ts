/**
 * Compiles the text of a JSX Authoring mode source into the component it
 * default-exports.
 *
 * Babel runs in the browser on purpose (ADR-0046). What it compiles to is a
 * CommonJS module, and its `require` resolves against the modules below: the
 * ones the templates in `emails/` import, under the specifiers they import them
 * by. That is what lets a repo template open in the panel exactly as it is; the
 * editor used to strip every import and offer React Email alone, and no repo
 * template compiled there.
 *
 * This file is loaded only when a JSX source is rendered, because Babel is
 * most of the weight the editor adds to a page. What it compiles, it runs: in
 * the browser, only inside the isolated context index.ts describes.
 */
import { transform } from "@babel/standalone";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as ReactEmail from "@react-email/components";
import * as actionMail from "../../../emails/action-mail";
import * as codeMail from "../../../emails/code-mail";
import * as go from "../../../emails/go";
import * as theme from "../../../emails/theme";
import * as types from "../../../emails/types";

// A new shared module in emails/ belongs here too: until it is, every template
// that imports it fails jsx.test.ts's comparison with the seed's render.
const MODULES: Record<string, unknown> = {
  react: React,
  "react/jsx-runtime": jsxRuntime,
  "@react-email/components": ReactEmail,
  "./theme": theme,
  "./go": go,
  "./action-mail": actionMail,
  "./code-mail": codeMail,
  "./types": types,
};

/**
 * The editor before this module stripped every import and offered React and
 * every React Email component in their place, and bodies written there lean on
 * that. A source with no import at all still gets them. One that imports gets
 * what it imports and nothing besides: offering React Email's Heading to a
 * source that forgot the theme's would render a different component, one
 * whose <h1> upper-cases the Go actions in the plain text.
 */
const LEGACY_SCOPE: Record<string, unknown> = { React, ...ReactEmail };

/** Which of the importable modules export a name, for the error that says where to import it from. */
function providersOf(name: string): string[] {
  return Object.entries(MODULES)
    .filter(([specifier, exports]) => Object.hasOwn(exports as object, name) || (specifier === "react" && name === "React"))
    .map(([specifier]) => specifier)
    .filter((specifier) => specifier !== "react/jsx-runtime")
    // The club's own module first: its Heading is the one a template means.
    .sort((a, b) => Number(b.startsWith("./")) - Number(a.startsWith("./")));
}

export class CompileError extends Error {}

export class NoComponentError extends Error {}

/** The bits of Babel's Program path read here. */
interface ProgramPath {
  node: { body: { type: string; source?: unknown }[] };
  scope: { globals: Record<string, { type: string }> };
}

interface Compiled {
  code: string;
  /** Whether the source imports anything; one that does not gets LEGACY_SCOPE. */
  imports: boolean;
}

/**
 * Babel's own scope analysis says which names a source uses without declaring
 * them. Among those, one a module here exports, or a component used in JSX, is
 * an import that was forgotten; anything else (Math, a typo) is left to fail
 * when it runs.
 */
function missingImports(program: ProgramPath): string[] {
  return Object.entries(program.scope.globals)
    .filter(([name, node]) => node.type === "JSXIdentifier" || providersOf(name).length > 0)
    .map(([name]) => {
      const providers = providersOf(name);
      return providers.length > 0
        ? `"${name}" import edilmemiş; ${providers.map((specifier) => `"${specifier}"`).join(" ya da ")} içinden import et.`
        : `"${name}" tanımlı değil.`;
    });
}

function toCommonJs(source: string): Compiled {
  let imports = false;
  let missing: string[] = [];
  const readImports = () => ({
    visitor: {
      Program(path: ProgramPath) {
        imports = path.node.body.some(
          (statement) => statement.type === "ImportDeclaration" || (statement.type.startsWith("Export") && statement.source),
        );
        missing = imports ? missingImports(path) : [];
      },
    },
  });

  let code: string;
  try {
    const output = transform(source, {
      filename: "template.tsx",
      sourceType: "module",
      presets: [
        ["typescript", { isTSX: true, allExtensions: true }],
        // The runtime tsconfig.json compiles the repo's templates with.
        ["react", { runtime: "automatic" }],
      ],
      plugins: [readImports, "transform-modules-commonjs"],
    });
    code = output.code ?? "";
  } catch (error) {
    throw new CompileError(error instanceof Error ? error.message : String(error));
  }

  if (missing.length > 0) {
    throw new CompileError(missing.join(" "));
  }
  return { code, imports };
}

function requireModule(specifier: string): unknown {
  if (Object.hasOwn(MODULES, specifier)) {
    return MODULES[specifier];
  }
  throw new CompileError(
    `"${specifier}" içe aktarılamaz. Kullanılabilenler: ${Object.keys(MODULES)
      .filter((name) => name !== "react/jsx-runtime")
      .join(", ")}`,
  );
}

/**
 * Runs the compiled module and returns its default export.
 *
 * Throws CompileError when the text is not a module Babel can compile or it
 * imports something that is not in scope, NoComponentError when it compiles
 * but exports no component, and whatever the module itself throws while it
 * runs.
 */
export function compileComponent(source: string): React.ComponentType {
  const { code, imports } = toCommonJs(source);

  const compiled = { exports: {} as Record<string, unknown> };
  const scope = imports ? {} : LEGACY_SCOPE;
  const scopeNames = Object.keys(scope);
  // The module runs in a function of its own inside the one that receives the
  // legacy scope, so a top-level `const Heading` in the source shadows the
  // offered Heading instead of colliding with it.
  const run = new Function("require", "module", "exports", ...scopeNames, `(function () {\n${code}\n})();`);
  run(requireModule, compiled, compiled.exports, ...scopeNames.map((name) => scope[name]));

  const component = compiled.exports.default;
  if (!isComponent(component)) {
    throw new NoComponentError("Kod varsayılan olarak (export default) bir bileşen dışa aktarmıyor.");
  }
  return component;
}

/** Wrappers React renders as a component; an element (`export default <Text/>`) is not one. */
const COMPONENT_WRAPPERS = [Symbol.for("react.memo"), Symbol.for("react.forward_ref")];

function isComponent(value: unknown): value is React.ComponentType {
  if (typeof value === "function") {
    return true;
  }
  return (
    typeof value === "object" &&
    value !== null &&
    COMPONENT_WRAPPERS.includes((value as { $$typeof?: symbol }).$$typeof as symbol)
  );
}
