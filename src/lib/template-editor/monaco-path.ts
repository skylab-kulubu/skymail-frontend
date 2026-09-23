/**
 * Where the code editor loads Monaco from: the panel's own copy of the
 * monaco-editor package's AMD build (scripts/build-editor-assets.ts), under a
 * path named by its version, so the files can be cached for good and a new
 * version is a new address.
 */
import monacoPackage from "monaco-editor/package.json";

export const MONACO_VS_PATH = `/monaco/${monacoPackage.version}/vs`;
