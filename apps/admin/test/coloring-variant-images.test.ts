import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

import type { ColoringVariants } from "../src/entities/coloring-variants/model/types.ts";

type Node = {
  type: string;
  props: Record<string, unknown> & { children?: unknown };
};

async function loadComponent(path: string, mocks: Record<string, unknown>) {
  const source = await readFile(
    new URL(`../src/${path}`, import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const jsx = (type: string, props: Node["props"]): Node => ({ type, props });
  const dependencies = { "react/jsx-runtime": { jsx, jsxs: jsx }, ...mocks };
  const testModule = {
    exports: {} as Record<string, (props: Record<string, unknown>) => Node>,
  };
  new Function("require", "module", "exports", outputText)(
    (name: string) => {
      assert.ok(Object.hasOwn(dependencies, name), name);
      return dependencies[name as keyof typeof dependencies];
    },
    testModule,
    testModule.exports,
  );
  return testModule.exports;
}

function findAll(value: unknown, type: string): Node[] {
  if (Array.isArray(value))
    return value.flatMap((child) => findAll(child, type));
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  const children = Array.isArray(node.props.children)
    ? node.props.children
    : [node.props.children];
  return [
    ...(node.type === type ? [node] : []),
    ...children.flatMap((child) => findAll(child, type)),
  ];
}

const state: ColoringVariants = {
  coloringId: "coloring-1",
  token: "publication-1",
  width: 100,
  height: 200,
  original: {
    status: "published",
    updatedAt: "2026-10-13T00:00:00.000Z",
    imageUrl: "/original-color",
    outlineUrl: "/original-outline",
    cardUrl: "/original-card",
    palette: [{ symbolPosition: 1, hex: "#123456" }],
  },
  variants: [
    {
      materialSetId: "artmate",
      title: "Artmate 168",
      status: "draft",
      updatedAt: "2026-10-13T00:00:00.000Z",
      imageUrl: "/artmate-color",
      outlineUrl: "/artmate-outline",
      cardUrl: "/artmate-card",
      palette: [
        {
          symbolPosition: 1,
          hex: "#654321",
          code: "001",
          materialColorId: "color-1",
        },
      ],
    },
  ],
};

test("saved previews and publication controls receive the same target's image pair", async () => {
  const { SavedImages } = await loadComponent(
    "features/coloring-variants-management/ui/saved-images.tsx",
    {
      "@/shared/ui": { Badge: "Badge" },
      "../lib/form-values": { symbols: ["1"] },
      "../lib/publication-values": {
        variantStatusLabels: { draft: "Черновик", published: "Опубликовано" },
      },
      "./protected-image": { ProtectedImage: "ProtectedImage" },
      "./publish-button": { PublishButton: "PublishButton" },
    },
  );
  const articles = findAll(SavedImages!({ state }), "article");
  assert.equal(articles.length, 2);
  for (const [index, source] of [
    state.original!,
    state.variants[0]!,
  ].entries()) {
    const article = articles[index]!;
    assert.deepEqual(
      findAll(article, "ProtectedImage").map(({ props }) => props.url),
      [source.outlineUrl, source.imageUrl, source.cardUrl],
    );
    const control = findAll(article, "PublishButton")[0]!;
    assert.equal(control.props.outlineUrl, source.outlineUrl);
    assert.equal(control.props.imageUrl, source.imageUrl);
  }
});

test("publication confirmation renders its selected contour and colored sample", async () => {
  const names = [
    "AlertDialog",
    "AlertDialogAction",
    "AlertDialogCancel",
    "AlertDialogContent",
    "AlertDialogDescription",
    "AlertDialogFooter",
    "AlertDialogHeader",
    "AlertDialogTitle",
    "AlertDialogTrigger",
    "Button",
  ];
  const { PublishButton } = await loadComponent(
    "features/coloring-variants-management/ui/publish-button.tsx",
    {
      "@/shared/ui": Object.fromEntries(names.map((name) => [name, name])),
      "../lib/publication-state": {
        usePublicationState: () => ({
          open: true,
          isPending: false,
          disabled: false,
        }),
      },
      "./protected-image": { ProtectedImage: "ProtectedImage" },
    },
  );
  for (const source of [state.original!, state.variants[0]!]) {
    const tree = PublishButton!({
      state,
      target: "materialSetId" in source ? source.materialSetId : "original",
      title: "Preview",
      outlineUrl: source.outlineUrl,
      imageUrl: source.imageUrl,
      disabled: false,
    });
    assert.deepEqual(
      findAll(tree, "ProtectedImage").map(({ props }) => props.url),
      [source.outlineUrl, source.imageUrl],
    );
  }
});
