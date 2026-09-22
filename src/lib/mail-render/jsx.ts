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
 * most of the weight the editor adds to a page.
 */
import { transform } from "@babel/standalone";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as ReactEmail from "@react-email/components";
import * as actionMail from "../../../emails/action-mail";
import * as go from "../../../emails/go";
import * as theme from "../../../emails/theme";
import * as types from "../../../emails/types";

const MODULES: Record<string, unknown> = {
  react: React,
  "react/jsx-runtime": jsxRuntime,
  "@react-email/components": ReactEmail,
  "./theme": theme,
  "./go": go,
  "./action-mail": actionMail,
  "./types": types,
};

/**
 * The editor before this module offered React and every React Email component
 * without an import, so a body written there may lean on that. They stay in
 * scope; an import of the same name shadows them.
 */
const AMBIENT: Record<string, unknown> = { React, ...ReactEmail };

export class CompileError extends Error {}

export class NoComponentError extends Error {}

function toCommonJs(source: string): string {
  try {
    const output = transform(source, {
      filename: "template.tsx",
      sourceType: "module",
      presets: [
        ["typescript", { isTSX: true, allExtensions: true }],
        // The runtime tsconfig.json compiles the repo's templates with.
        ["react", { runtime: "automatic" }],
      ],
      plugins: ["transform-modules-commonjs"],
    });
    return output.code ?? "";
  } catch (error) {
    throw new CompileError(error instanceof Error ? error.message : String(error));
  }
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
  const code = toCommonJs(source);

  const compiled = { exports: {} as Record<string, unknown> };
  const ambientNames = Object.keys(AMBIENT);
  // The module runs in a function of its own inside the one that receives the
  // ambient names, so a top-level `const Heading` in the source shadows the
  // ambient Heading instead of colliding with it.
  const run = new Function(
    "require",
    "module",
    "exports",
    ...ambientNames,
    `(function () {\n${code}\n})();`,
  );
  run(requireModule, compiled, compiled.exports, ...ambientNames.map((name) => AMBIENT[name]));

  const component = compiled.exports.default;
  if (typeof component !== "function") {
    throw new NoComponentError("Kod varsayılan olarak (export default) bir bileşen dışa aktarmıyor.");
  }
  return component as React.ComponentType;
}
