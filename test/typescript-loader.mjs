import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function isTypeScriptUrl(url) {
  return url.endsWith(".ts") || url.endsWith(".tsx");
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return {
      shortCircuit: true,
      url: pathToFileURL(path.join(projectRoot, specifier.slice(2))).href,
    };
  }

  if (
    isTypeScriptUrl(specifier) &&
    (specifier.startsWith(".") || specifier.startsWith("/"))
  ) {
    return {
      shortCircuit: true,
      url: new URL(specifier, context.parentURL).href,
    };
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (!isTypeScriptUrl(url)) {
    return nextLoad(url, context);
  }

  const fileName = fileURLToPath(url);
  const source = await fs.readFile(fileName, "utf8");
  const transpiled = ts.transpileModule(source, {
    fileName,
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      resolveJsonModule: true,
      sourceMap: false,
      target: ts.ScriptTarget.ES2020,
    },
  });

  return {
    format: "module",
    shortCircuit: true,
    source: transpiled.outputText,
  };
}
