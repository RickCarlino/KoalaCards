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

async function isFile(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function resolveTypeScriptFile(filePath) {
  const candidates = [
    filePath,
    `${filePath}.ts`,
    `${filePath}.tsx`,
    path.join(filePath, "index.ts"),
    path.join(filePath, "index.tsx"),
  ];

  for (const candidate of candidates) {
    if (await isFile(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const resolved = await resolveTypeScriptFile(
      path.join(projectRoot, specifier.slice(2)),
    );
    if (resolved) {
      return {
        shortCircuit: true,
        url: resolved,
      };
    }

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

  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const resolved = await resolveTypeScriptFile(
      fileURLToPath(new URL(specifier, context.parentURL)),
    );
    if (resolved) {
      return {
        shortCircuit: true,
        url: resolved,
      };
    }
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
