import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateTypeScript(source, imports = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const testModule = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  const dependencies = { "react/jsx-runtime": { jsx, jsxs: jsx }, ...imports };

  new Function("require", "module", "exports", output)(
    (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected test import: ${name}`);
      return dependencies[name];
    },
    testModule,
    testModule.exports,
  );

  return testModule.exports;
}

function getJsxElements(source, name) {
  const sourceFile = ts.createSourceFile(
    "component.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const elements = [];

  function visit(node) {
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : undefined;

    if (opening?.tagName.getText() === name) {
      elements.push(node);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return elements;
}

function getJsxAttribute(element, name) {
  const opening = ts.isJsxElement(element) ? element.openingElement : element;
  const attribute = opening.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.getText() === name,
  );
  const initializer = attribute?.initializer;

  if (!initializer) return undefined;
  return ts.isStringLiteral(initializer) ? initializer.text : initializer.expression?.getText();
}

function getJsxAncestors(element) {
  const ancestors = [];

  for (let parent = element.parent; parent; parent = parent.parent) {
    if (ts.isJsxElement(parent)) ancestors.push(parent);
  }

  return ancestors;
}

async function loadComparisonSlider() {
  const [source, stateSource] = await Promise.all([
    readSource("src/features/coloring-details/ui/comparison-slider.tsx"),
    readSource("src/features/coloring-details/lib/comparison-state.ts"),
  ]);

  return evaluateTypeScript(source, {
    "lucide-react": { ChevronsLeftRight: "ChevronsLeftRight" },
    "@/shared/lib": { cn: (...classes) => classes.filter(Boolean).join(" ") },
    "@/shared/ui": { Slider: "Slider" },
    "../lib/comparison-state": evaluateTypeScript(stateSource),
  }).ComparisonSlider;
}

test("comparison state clamps percentages and describes both image proportions", async () => {
  const state = evaluateTypeScript(
    await readSource("src/features/coloring-details/lib/comparison-state.ts"),
  );

  assert.equal(state.clampOutlinePercent(-1), 0);
  assert.equal(state.clampOutlinePercent(50), 50);
  assert.equal(state.clampOutlinePercent(101), 100);
  assert.deepEqual(state.getComparisonProportions(0), { colored: 100, outline: 0 });
  assert.deepEqual(state.getComparisonProportions(50), { colored: 50, outline: 50 });
  assert.deepEqual(state.getComparisonProportions(100), { colored: 0, outline: 100 });
  assert.equal(state.getComparisonValueText(0), "Цветная версия 100%, контур 0%");
  assert.equal(state.getComparisonValueText(50), "Цветная версия 50%, контур 50%");
  assert.equal(state.getComparisonValueText(100), "Цветная версия 0%, контур 100%");
  assert.equal(state.getComparisonLiveText(50), "Показано: цветная версия 50%, контур 50%");
  assert.equal(state.getComparisonValueText(49.6), "Цветная версия 50%, контур 50%");
  assert.equal(state.getComparisonValueText(49.4), "Цветная версия 51%, контур 49%");
  assert.equal(state.getComparisonKeyboardValue("Home", 50), 0);
  assert.equal(state.getComparisonKeyboardValue("End", 50), 100);
  assert.equal(state.getComparisonKeyboardValue("ArrowLeft", 50), 49);
  assert.equal(state.getComparisonKeyboardValue("ArrowDown", 0), 0);
  assert.equal(state.getComparisonKeyboardValue("ArrowRight", 50), 51);
  assert.equal(state.getComparisonKeyboardValue("ArrowUp", 100), 100);
  assert.equal(state.getComparisonKeyboardValue("PageDown", 50), 40);
  assert.equal(state.getComparisonKeyboardValue("PageUp", 95), 100);
  assert.equal(state.getComparisonKeyboardValue("Escape", 50), undefined);
  assert.equal(state.isComparisonAdjustmentKey("ArrowRight"), true);
  assert.equal(state.isComparisonAdjustmentKey("PageDown"), true);
  assert.equal(state.isComparisonAdjustmentKey("Tab"), false);
  assert.equal(state.isComparisonAdjustmentKey("Shift"), false);
});

test("comparison image readiness requires both resources and retry returns to pending", async () => {
  const state = evaluateTypeScript(
    await readSource("src/features/coloring-details/lib/comparison-state.ts"),
  );

  const initial = state.createComparisonImageState();
  assert.deepEqual(initial, {
    attempt: 0,
    coloredReady: false,
    outlineReady: false,
    hasError: false,
  });
  assert.equal(state.areComparisonImagesReady(initial), false);

  const oneLoaded = state.comparisonImageReducer(initial, {
    type: "loaded",
    kind: "colored",
    attempt: 0,
  });
  assert.equal(state.areComparisonImagesReady(oneLoaded), false);

  const bothLoaded = state.comparisonImageReducer(oneLoaded, {
    type: "loaded",
    kind: "outline",
    attempt: 0,
  });
  assert.equal(state.areComparisonImagesReady(bothLoaded), true);

  const failed = state.comparisonImageReducer(oneLoaded, { type: "failed", attempt: 0 });
  assert.equal(state.areComparisonImagesReady(failed), false);
  assert.equal(failed.hasError, true);

  const repeatedFailure = state.comparisonImageReducer(failed, { type: "failed", attempt: 0 });
  assert.strictEqual(repeatedFailure, failed);

  const retrying = state.comparisonImageReducer(failed, { type: "retry" });
  assert.deepEqual(retrying, {
    attempt: 1,
    coloredReady: false,
    outlineReady: false,
    hasError: false,
  });
  assert.equal(state.areComparisonImagesReady(retrying), false);

  const staleLoad = state.comparisonImageReducer(retrying, {
    type: "loaded",
    kind: "outline",
    attempt: 0,
  });
  assert.deepEqual(staleLoad, retrying);

  const staleFailure = state.comparisonImageReducer(staleLoad, {
    type: "failed",
    attempt: 0,
  });
  assert.deepEqual(staleFailure, retrying);

  const hungRetry = state.comparisonImageReducer(staleFailure, {
    type: "loaded",
    kind: "colored",
    attempt: 1,
  });
  assert.equal(state.areComparisonImagesReady(hungRetry), false);
});

test("route hydrates the final revision key and treats only explicit missing data as not found", async () => {
  const source = await readSource(
    "app/(site)/raskraski/digital/[collectionSlug]/[number]/page.tsx",
  );

  assert.match(source, /\.withColoring\(collectionSlug, number\)/);
  assert.match(source, /if \(coloring === null\) \{\s*notFound\(\);\s*\}/);
  assert.match(source, /dehydrateQueryClient\(queryClient\)/);
  assert.match(source, /<HydrationBoundary/);
  assert.match(source, /collectionSlug=\{collectionSlug\}/);
  assert.match(source, /number=\{number\}/);
  assert.match(source, /publishedRevisionId=\{coloring\.publishedRevisionId\}/);
  assert.doesNotMatch(source, /sitemap/);
});

test("page is composition-only and the feature owns hydrated query states", async () => {
  const [page, feature] = await Promise.all([
    readSource("src/_pages/coloring/index.tsx"),
    readSource("src/features/coloring-details/ui/coloring-details.tsx"),
  ]);

  assert.match(page, /ColoringDetails/);
  assert.doesNotMatch(page, /useColoringData|DataState|useState|useQuery/);
  assert.match(
    feature,
    /useColoringData\(\s*collectionSlug,\s*number,\s*publishedRevisionId,\s*\)/,
  );
  assert.match(feature, /isPending/);
  assert.match(feature, /isError/);
  assert.match(feature, /refetch/);
  assert.match(feature, /Retry|Повторить/);
  assert.match(feature, /<ComparisonViewer\s+key=\{coloring\.publishedRevisionId\}/);
  assert.match(feature, /const coloringTitle =/);
  assert.match(feature, /<PaletteSection palette=\{coloring\.palette\}/);
});

test("viewer keeps exactly two stable image URLs and has no coloring fullscreen flow", async () => {
  const source = await readSource("src/features/coloring-details/ui/comparison-viewer.tsx");
  const images = getJsxElements(source, "Image");

  assert.equal(images.length, 2);
  assert.deepEqual(
    images.map((image) => getJsxAttribute(image, "src")),
    ["colored.url", "outline.url"],
  );
  assert.deepEqual(
    images.map((image) => getJsxAttribute(image, "key")),
    ["`colored-${imageState.attempt}`", "`outline-${imageState.attempt}`"],
  );
  assert.equal((source.match(/preload/g) ?? []).length, 1);
  assert.equal((source.match(/\bunoptimized\b/g) ?? []).length, 2);
  assert.match(source, /src=\{colored\.url\}[\s\S]*?preload[\s\S]*?loading="eager"/);
  assert.match(
    source,
    /const handleMainImageError = useCallback\([\s\S]*?attempt: imageState\.attempt[\s\S]*?\[imageState\.attempt\]/,
  );
  assert.equal((source.match(/onError=\{handleMainImageError\}/g) ?? []).length, 2);
  assert.equal((source.match(/width=\{width\}/g) ?? []).length, 2);
  assert.equal((source.match(/height=\{height\}/g) ?? []).length, 2);
  assert.equal((source.match(/object-contain/g) ?? []).length, 2);
  assert.equal(
    (source.match(/clipPath:\s*`inset\(0 \$\{100 - outlinePercent\}% 0 0\)`/g) ?? []).length,
    1,
  );
  assert.match(source, /aspectRatio:\s*`\$\{width\} \/ \$\{height\}`/);
  assert.doesNotMatch(
    source,
    /ComparisonLightbox|ResponsiveMediaViewer|MediaExpandButton|lightbox|requestFullscreen|cursor-zoom-in/i,
  );
  assert.doesNotMatch(
    source,
    /Открыть (?:изображение )?крупнее|Потяните круг, чтобы сравнить версии/,
  );
  assert.doesNotMatch(
    source,
    /fetch\(|createObjectURL|new URL|URLSearchParams|type="range"|setPointerCapture|getComparisonPointerValue/,
  );
  assert.doesNotMatch(source, /iframe|onContextMenu/i);
});

test("image and below sliders share the same value, readiness and commit state", async () => {
  const source = await readSource("src/features/coloring-details/ui/comparison-viewer.tsx");
  const controls = getJsxElements(source, "ComparisonSlider");

  assert.equal(controls.length, 2);
  assert.deepEqual(
    controls.map((control) => getJsxAttribute(control, "placement")),
    ["image", "below"],
  );
  for (const control of controls) {
    assert.equal(getJsxAttribute(control, "value"), "outlinePercent");
    assert.equal(getJsxAttribute(control, "disabled"), "!isComparisonReady");
    assert.equal(getJsxAttribute(control, "onValueChange"), "setOutlinePercent");
    assert.equal(getJsxAttribute(control, "onValueCommit"), "commit");
  }

  assert.match(source, /const \[outlinePercent, setOutlinePercent\] = useState\(50\)/);
  assert.match(
    source,
    /const commit = \(value: number\) => \{\s*setCommittedText\(getComparisonLiveText\(value\)\)/,
  );
  assert.match(
    source,
    /const selectExtreme = \(value: number\) => \{\s*setOutlinePercent\(value\);\s*commit\(value\)/,
  );
  assert.match(source, /className="relative h-11 overflow-visible" data-comparison-track/);
  assert.match(
    source,
    /placement="below"[\s\S]*?onClick=\{\(\) => selectExtreme\(0\)\}[\s\S]*?>\s*В цвете\s*<\/Button>[\s\S]*?onClick=\{\(\) => selectExtreme\(100\)\}[\s\S]*?>\s*Контур\s*<\/Button>/,
  );
  assert.match(source, /aria-live="polite"/);
  assert.doesNotMatch(source, /<Slider\b|overlayPercent|belowPercent|imagePercent/);
});

test("central handle and divider stay outside the clipped image wrapper at both edges", async () => {
  const source = await readSource("src/features/coloring-details/ui/comparison-viewer.tsx");
  const overlay = getJsxElements(source, "ComparisonSlider").find(
    (control) => getJsxAttribute(control, "placement") === "image",
  );
  assert.ok(overlay);

  const overlayAncestors = getJsxAncestors(overlay);
  assert.equal(getJsxAttribute(overlayAncestors[0], "ref"), "viewerStatusRef");
  for (const ancestor of overlayAncestors) {
    assert.doesNotMatch(getJsxAttribute(ancestor, "className") ?? "", /overflow-(?:hidden|clip)/);
    assert.doesNotMatch(getJsxAttribute(ancestor, "style") ?? "", /clipPath/);
  }

  const images = getJsxElements(source, "Image");
  for (const image of images) {
    assert.ok(
      getJsxAncestors(image).some(
        (ancestor) =>
          getJsxAttribute(ancestor, "className") === "absolute inset-0 overflow-hidden rounded-2xl",
      ),
    );
  }

  const divider = getJsxElements(source, "span").find((element) =>
    (ts.isJsxElement(element) ? element.openingElement : element).attributes
      .getText()
      .includes("data-comparison-divider"),
  );
  assert.ok(divider);
  assert.equal(getJsxAttribute(getJsxAncestors(divider)[0], "ref"), "viewerStatusRef");
  assert.match(getJsxAttribute(divider, "className"), /inset-y-0.*w-px.*-translate-x-1\/2/);
  assert.equal(getJsxAttribute(divider, "style"), "{ left: `${outlinePercent}%` }");
});

test("both shared shadcn slider placements use a 1px thumb with the same 44px touch target", async () => {
  const [ComparisonSlider, primitive] = await Promise.all([
    loadComparisonSlider(),
    readSource("src/shared/ui/slider.tsx"),
  ]);
  const controls = ["image", "below"].map((placement) =>
    ComparisonSlider({
      placement,
      value: 37.5,
      disabled: false,
      onValueChange() {},
      onValueCommit() {},
    }),
  );
  const [overlay, below] = controls.map((control) => control.props);

  for (const control of controls) {
    assert.equal(control.type, "Slider");
    assert.equal(control.props.min, 0);
    assert.equal(control.props.max, 100);
    assert.equal(control.props.step, 0.01);
    assert.deepEqual(control.props.value, [37.5]);
    assert.equal(control.props.disabled, false);
    assert.match(control.props.className, /h-11 overflow-visible/);
    assert.match(control.props.thumbClassName, /\bsize-px\b/);
    assert.doesNotMatch(control.props.thumbClassName, /\bsize-0\b/);
    const inset = control.props.thumbClassName.match(/after:-inset-\[([\d.]+)px\]/);
    assert.ok(inset);
    assert.equal(1 + 2 * Number(inset[1]), 44);
    assert.match(control.props.thumbClassName, /pointer-events-auto/);
    assert.match(control.props.thumbClassName, /after:box-border.*after:rounded-full/);
    assert.match(control.props.thumbClassName, /focus-visible:after:ring-4/);
    assert.match(control.props.thumbClassName, /data-disabled:pointer-events-none/);
    assert.equal(control.props.thumbProps["aria-valuetext"], "Цветная версия 62%, контур 38%");
    assert.match(control.props.thumbProps.children.props.className, /pointer-events-none/);
  }

  assert.equal(overlay.thumbClassName, below.thumbClassName);
  assert.equal(overlay["data-comparison-control"], "image");
  assert.equal(below["data-comparison-control"], "below");
  assert.match(
    overlay.className,
    /pointer-events-none absolute inset-x-0 top-1\/2 z-10 -translate-y-1\/2/,
  );
  assert.doesNotMatch(below.className, /absolute|pointer-events-none/);
  assert.equal(overlay.trackClassName, "data-horizontal:h-2 bg-transparent");
  assert.equal(overlay.rangeClassName, "bg-transparent");
  assert.equal(below.trackClassName, "data-horizontal:h-2 bg-stone-200");
  assert.equal(below.rangeClassName, "bg-rose-500");
  assert.equal(overlay.thumbProps["aria-label"], "Сравнить контур и цветную версию на изображении");
  assert.equal(below.thumbProps["aria-label"], "Соотношение контура и цветной версии");
  assert.match(primitive, /<SliderPrimitive\.Root[\s\S]*?touch-none[\s\S]*?\{\.\.\.props\}/);
  assert.match(
    primitive,
    /<SliderPrimitive\.Thumb[\s\S]*?\{\.\.\.thumbProps\}[\s\S]*?thumbClassName/,
  );
});

test("both slider placements clamp pointer values and prevent page scroll only for adjustment keys", async () => {
  const ComparisonSlider = await loadComparisonSlider();

  for (const placement of ["image", "below"]) {
    const changes = [];
    const commits = [];
    const props = {
      placement,
      value: 50,
      disabled: false,
      onValueChange: (value) => changes.push(value),
      onValueCommit: (value) => commits.push(value),
    };
    const control = ComparisonSlider(props).props;

    for (const value of [[-10], [37.5], [110], []]) {
      control.onValueChange(value);
      control.onValueCommit(value);
    }
    assert.deepEqual(changes, [0, 37.5, 100]);
    assert.deepEqual(commits, [0, 37.5, 100]);
    assert.equal(ComparisonSlider({ ...props, disabled: true }).props.disabled, true);

    for (const [key, expected] of [
      ["ArrowLeft", 49],
      ["ArrowDown", 49],
      ["ArrowRight", 51],
      ["ArrowUp", 51],
      ["Home", 0],
      ["End", 100],
      ["PageDown", 40],
      ["PageUp", 60],
      ["Tab", undefined],
      ["Escape", undefined],
      ["Shift", undefined],
    ]) {
      const events = [];
      const keyboardProps = {
        ...props,
        onValueChange: (value) => events.push(["change", value]),
        onValueCommit: (value) => events.push(["commit", value]),
      };
      ComparisonSlider(keyboardProps).props.onKeyDown({
        key,
        preventDefault: () => events.push(["preventDefault"]),
      });
      ComparisonSlider({ ...keyboardProps, value: expected ?? 50 }).props.onKeyUp({ key });
      assert.deepEqual(
        events,
        expected === undefined
          ? []
          : [["preventDefault"], ["change", expected], ["commit", expected]],
        `${placement}: ${key}`,
      );
    }
  }
});

test("main controls remain loading and disabled until both remounted images load", async () => {
  const source = await readSource("src/features/coloring-details/ui/comparison-viewer.tsx");

  assert.match(source, /useReducer\(\s*comparisonImageReducer/);
  assert.match(source, /areComparisonImagesReady\(imageState\)/);
  assert.match(source, /kind: "colored"/);
  assert.match(source, /kind: "outline"/);
  assert.equal((source.match(/onLoad=/g) ?? []).length, 2);
  assert.equal((source.match(/disabled=\{!isComparisonReady\}/g) ?? []).length, 4);
  assert.match(source, /\{isComparisonReady && \([\s\S]*?data-comparison-divider/);
  assert.match(source, /aria-busy=\{!isComparisonReady && !imageState\.hasError\}/);
  assert.match(source, /Загружаем изображение/);
  assert.match(source, /type: "retry"/);
  assert.match(source, /imageState\.attempt/);
  assert.doesNotMatch(source, /setHasImageError/);
});

test("product gallery keeps the shared responsive shadcn Dialog and Drawer shell", async () => {
  const [responsiveViewer, drawer, gallery] = await Promise.all([
    readSource("src/shared/ui/responsive-media-viewer.tsx"),
    readSource("src/shared/ui/drawer.tsx"),
    readSource("src/entities/products/ui/gallery.tsx"),
  ]);

  assert.match(gallery, /<ResponsiveMediaViewer/);
  assert.match(responsiveViewer, /const isMobile = useIsMobile\(\)/);
  assert.match(responsiveViewer, /if \(isMobile\)[\s\S]*?<Drawer/);
  assert.match(responsiveViewer, /<Dialog/);
  assert.match(responsiveViewer, /data-responsive-media-viewer="drawer"/);
  assert.match(responsiveViewer, /data-responsive-media-viewer="dialog"/);
  assert.match(responsiveViewer, /<DrawerClose asChild>/);
  assert.match(responsiveViewer, /<DialogClose asChild>/);
  assert.match(responsiveViewer, /handleOnly/);
  assert.match(
    responsiveViewer,
    /function CloseButton\(props:[\s\S]*?<Button[\s\S]*?\{\.\.\.props\}/,
  );
  assert.match(
    responsiveViewer,
    /const drawerModalProps = \{[\s\S]*?autoFocus: true,[\s\S]*?handleOnly: true/,
  );
  assert.match(responsiveViewer, /<Drawer \{\.\.\.drawerModalProps\}/);
  assert.match(responsiveViewer, /onCloseAutoFocus=\{handleCloseAutoFocus\}/);
  assert.match(responsiveViewer, /returnFocusRef\.current\.focus\(\{ preventScroll: true \}\)/);
  assert.match(
    responsiveViewer,
    /data-\[vaul-drawer-direction=bottom\]:max-h-\[calc\(100dvh-0\.5rem\)\]/,
  );
  assert.match(responsiveViewer, /sm:max-w-\[min\(94vw,80rem\)\]/);
  assert.match(drawer, /from "vaul"/);
  assert.match(drawer, /DrawerPrimitive\.Handle/);
  assert.match(drawer, /<DrawerHandle className=/);
  assert.match(gallery, /lightboxTriggerRef\.current = event\.currentTarget/);
  assert.match(gallery, /returnFocusRef=\{lightboxTriggerRef\}/);
  assert.doesNotMatch(gallery, /iframe|onContextMenu|pointer-events-none[^\n]*overlay/i);
});

test("product gallery preserves the shared shadcn media expand button size contract", async () => {
  const [button, gallery] = await Promise.all([
    readSource("src/shared/ui/media-expand-button.tsx"),
    readSource("src/entities/products/ui/gallery.tsx"),
  ]);

  assert.match(button, /<Button/);
  assert.match(button, /variant="secondary"/);
  assert.match(button, /size="icon-lg"/);
  assert.match(button, /data-media-expand-button=""/);
  assert.match(button, /after:-inset-1/);
  assert.match(button, /"className"/);
  assert.match(button, /"style"/);
  assert.equal((gallery.match(/<MediaExpandButton/g) ?? []).length, 1);
  assert.doesNotMatch(gallery, /<MediaExpandButton[^>]*className=/);
  assert.doesNotMatch(gallery, /<Expand/);
});

test("responsive media shell uses the shared light Artmate palette and spacing", async () => {
  const [responsiveViewer, gallery] = await Promise.all([
    readSource("src/shared/ui/responsive-media-viewer.tsx"),
    readSource("src/entities/products/ui/gallery.tsx"),
  ]);

  assert.match(responsiveViewer, /from-rose-50\/90 via-white to-orange-50\/80/);
  assert.match(responsiveViewer, /border-rose-100 bg-white/);
  assert.match(responsiveViewer, /text-stone-900/);
  assert.match(responsiveViewer, /hover:bg-rose-50/);
  assert.match(responsiveViewer, /px-4 text-stone-900 sm:px-5/);
  assert.match(
    responsiveViewer,
    /<DrawerContent[\s\S]*?className="[^"]*border-rose-100 bg-white[^"]*"/,
  );
  assert.match(
    responsiveViewer,
    /<DialogContent[\s\S]*?className="[^"]*border-rose-100 bg-white[^"]*"/,
  );
  assert.doesNotMatch(
    responsiveViewer,
    /bg-(?:black|(?:stone|zinc|neutral|slate)-(?:8|9)\d{2})|text-white|border-white|ring-white/,
  );
  assert.doesNotMatch(gallery, /text-white|ring-white|bg-black/);
  assert.match(gallery, /p-3 sm:p-6/);
  assert.match(gallery, /px-4 py-3/);
  assert.match(gallery, /min\(92dvh,64rem\)-12rem/);
  assert.match(gallery, /100dvh-12rem/);
  assert.doesNotMatch(gallery, /100dvh-11rem/);
});

test("async viewer image failures announce once without duplicate live regions", async () => {
  const source = await readSource("src/features/coloring-details/ui/comparison-viewer.tsx");

  assert.equal((source.match(/role="alert"/g) ?? []).length, 1);
  assert.equal((source.match(/aria-live=/g) ?? []).length, 1);
  assert.match(
    source,
    /imageState\.hasError[\s\S]*?role="alert"[\s\S]*?Не удалось загрузить изображение/,
  );
});

test("keyboard main retry moves focus to the stable viewer before remount", async () => {
  const source = await readSource("src/features/coloring-details/ui/comparison-viewer.tsx");

  assert.match(source, /useRef<HTMLDivElement>/);
  assert.match(source, /useRef<HTMLButtonElement>/);
  assert.match(source, /type MouseEvent/);
  assert.match(
    source,
    /const retryImages = \(event: MouseEvent<HTMLButtonElement>\)[\s\S]*?event\.detail === 0[\s\S]*?document\.activeElement === mainRetryButtonRef\.current[\s\S]*?viewerStatusRef\.current\?\.focus\(\{ preventScroll: true \}\)[\s\S]*?dispatchImage\(\{ type: "retry" \}\)/,
  );
  assert.match(source, /ref=\{viewerStatusRef\}/);
  assert.match(source, /tabIndex=\{-1\}/);
  assert.match(source, /aria-label="Область сравнения контура и цветной версии"/);
  assert.match(source, /focus-visible:ring-rose-400\/40/);
  assert.match(source, /ref=\{mainRetryButtonRef\}/);
  assert.match(source, /onClick=\{retryImages\}/);
});

test("details render persisted palette colors, legacy empty state, and category-safe product CTA", async () => {
  const [detailsSource, heroSource, paletteSource, routesSource] = await Promise.all([
    readSource("src/features/coloring-details/ui/coloring-details.tsx"),
    readSource("src/features/coloring-details/ui/hero.tsx"),
    readSource("src/features/coloring-details/ui/palette-section.tsx"),
    readSource("src/shared/constants/routes.ts"),
  ]);
  const source = `${detailsSource}\n${heroSource}\n${paletteSource}`;
  const { routes } = evaluateTypeScript(routesSource);

  assert.match(source, /Цифровая версия в палитре Artmate/);
  assert.match(source, /palette\.colors\.length/);
  assert.match(source, /Использовано \$\{palette\.colors\.length\} из 168 оттенков Artmate/);
  assert.match(source, /Палитра для этой иллюстрации пока не указана/);
  assert.match(source, /Данные о маркерах появятся после настройки палитры/);
  assert.match(source, /Цвет на экране — ориентир/);
  assert.match(source, /бумаги,\s*освещения,\s*количества\s*слоёв\s*и\s*настроек\s*дисплея/);
  assert.match(source, /themes\.map/);
  assert.match(source, /Цифровые версии/);
  assert.match(source, /routes\.colorings/);
  assert.match(
    heroSource,
    /const productHref = routes\.product\(collection\.product\.category\?\.slug, collection\.product\.slug\)/,
  );
  assert.match(heroSource, /href=\{productHref\}/);
  assert.match(heroSource, /Купить печатный альбом/);
  assert.match(heroSource, /ShoppingBag/);
  assert.match(heroSource, /collection\.product\.title/);
  assert.doesNotMatch(detailsSource, /Эта иллюстрация входит в тематику/);
  assert.doesNotMatch(detailsSource, /Смотреть все иллюстрации/);
  assert.doesNotMatch(detailsSource, /lg:grid-cols-\[minmax\(0,1fr\)/);
  assert.equal(routes.product(undefined, "album-1"), "/catalog/raskraski/album-1");
  assert.equal(routes.product("fantasy", "album-1"), "/catalog/raskraski/fantasy/album-1");
  assert.doesNotMatch(detailsSource, /getMockPaletteColors/);
  assert.match(source, /aria-label="Цвета и номера маркеров"/);
  assert.match(source, /style=\{\{ backgroundColor: color\.hex \}\}/);
  assert.match(source, /№ \{color\.symbol\}/);
  assert.doesNotMatch(paletteSource, /color\.colorNumber/);
  assert.match(source, /\{color\.hex\}/);
  assert.match(source, /Маркер[\s\S]*?\{color\.markerNumber\}/);
  assert.match(source, /Pantone \{color\.pantone\}/);
  assert.match(paletteSource, /grid-cols-1[^"]*sm:grid-cols-2[^"]*lg:grid-cols-3/);
  assert.doesNotMatch(paletteSource, /min-\[360px\]:grid-cols|grid-cols-[45]/);
  assert.doesNotMatch(source, /iframe/i);
});

test("palette places prominent marker numbers after symbols with secondary HEX and Pantone", async () => {
  const { PaletteSection } = evaluateTypeScript(
    await readSource("src/features/coloring-details/ui/palette-section.tsx"),
    {
      "lucide-react": { Palette: "Palette" },
      "@/shared/ui": {
        Badge: "Badge",
        Card: "Card",
        CardContent: "CardContent",
        CardDescription: "CardDescription",
        CardTitle: "CardTitle",
      },
    },
  );
  const colors = [
    {
      symbolPosition: 1,
      symbol: "1",
      colorNumber: 27,
      markerNumber: "001",
      hex: "#D2DBD6",
      pantone: "5595C",
    },
    {
      symbolPosition: 10,
      symbol: "A",
      colorNumber: 61,
      markerNumber: "065",
      hex: "#DAAB9C",
      pantone: "7613U",
    },
    {
      symbolPosition: 19,
      symbol: "J",
      colorNumber: 168,
      markerNumber: "704",
      hex: "#FFDDE2",
      pantone: "705U",
    },
  ];

  function getElements(node) {
    if (Array.isArray(node)) return node.flatMap(getElements);
    if (!node || typeof node !== "object") return [];

    return [node, ...getElements(node.props.children)];
  }

  function getText(node) {
    if (Array.isArray(node)) return node.map(getText).join("");
    if (typeof node === "string" || typeof node === "number") return String(node);

    return node?.props ? getText(node.props.children) : "";
  }

  const palette = PaletteSection({
    palette: { colors, label: "Artmate", version: "test", usedColorCount: colors.length },
    themes: [],
  });
  const grid = getElements(palette).find(
    (node) => node.type === "ul" && node.props["aria-label"] === "Цвета и номера маркеров",
  );

  assert.ok(grid);
  assert.equal(grid.props.children.length, colors.length);

  for (const [index, color] of colors.entries()) {
    const card = grid.props.children[index];
    const elements = getElements(card);
    const marker = elements.find((node) => node.props.children === color.markerNumber);

    assert.ok(
      marker,
      `Marker ${color.markerNumber} must stay an exact string, including leading zeros`,
    );
    assert.match(marker.props.className, /\btext-3xl\b/);
    assert.match(marker.props.className, /\btext-white\b/);
    const markerLabel = elements.find((node) => node.props.children === "Маркер");
    const symbolLabel = elements.find((node) => node.type === "p");

    assert.ok(markerLabel);
    assert.match(markerLabel.props.className, /\btext-xl\b/);
    assert.ok(symbolLabel);
    assert.match(symbolLabel.props.className, /\btext-lg\b/);
    assert.equal(getText(symbolLabel), `№ ${color.symbol}`);
    assert.doesNotMatch(getText(card), /Цвет \d/);
    const labelRow = elements.find(
      (node) => Array.isArray(node.props.children) && node.props.children[0] === symbolLabel,
    );

    assert.ok(labelRow);
    assert.match(labelRow.props.className, /\bflex\b/);
    assert.match(labelRow.props.className, /\bitems-baseline\b/);
    assert.deepEqual(labelRow.props.children[1].props.children, [markerLabel, marker]);

    for (const value of [color.hex, `Pantone ${color.pantone}`]) {
      assert.ok(
        elements.some((node) => {
          const classes = (node.props.className ?? "").split(/\s+/);

          return (
            classes.includes("text-xs") &&
            classes.includes("text-stone-400") &&
            getText(node).includes(value)
          );
        }),
        `${value} must remain small, gray metadata`,
      );
    }
  }
});

test("details compose hero, full-width viewer, and palette in semantic DOM order", async () => {
  const [details, hero, palette] = await Promise.all([
    readSource("src/features/coloring-details/ui/coloring-details.tsx"),
    readSource("src/features/coloring-details/ui/hero.tsx"),
    readSource("src/features/coloring-details/ui/palette-section.tsx"),
  ]);

  assert.match(details, /<Hero[\s\S]*?<ComparisonViewer[\s\S]*?<PaletteSection/);
  assert.match(details, /w-full px-6 pb-10 md:px-8 md:pb-14/);
  assert.match(details, /mx-auto w-full max-w-\[100rem\]/);
  assert.doesNotMatch(details, /lg:grid-cols-\[minmax\(0,1\.18fr\)/);
  assert.doesNotMatch(details, /lg:sticky/);
  assert.match(hero, /<PageTitle[\s\S]*?\{title\}[\s\S]*?<\/PageTitle>/);
  assert.match(palette, /aria-labelledby="coloring-palette-title"/);
  assert.match(palette, /role="heading"/);
  assert.match(palette, /aria-level=\{2\}/);
  assert.match(palette, /grid-cols-1[^"]*sm:grid-cols-2[^"]*lg:grid-cols-3/);
});

test("hero stacks title, description and purchase CTA vertically at every breakpoint", async () => {
  const hero = await readSource("src/features/coloring-details/ui/hero.tsx");
  const [title] = getJsxElements(hero, "PageTitle");
  const [description] = getJsxElements(hero, "SectionSubtitle");
  const [cta] = getJsxElements(hero, "Button");

  assert.ok(title);
  assert.ok(description);
  assert.ok(cta);
  assert.ok(title.pos < description.pos && description.pos < cta.pos);
  assert.equal(getJsxAttribute(getJsxAncestors(title)[0], "className"), "space-y-3");
  assert.equal(getJsxAttribute(getJsxAncestors(description)[0], "className"), "space-y-3");
  assert.equal(getJsxAttribute(getJsxAncestors(title)[1], "className"), "max-w-3xl space-y-5");
  assert.equal(getJsxAttribute(getJsxAncestors(cta)[0], "className"), "max-w-3xl space-y-5");
  assert.match(getJsxAttribute(cta, "className"), /min-h-11 w-full.*sm:w-auto/);
  assert.match(hero, /<PageTitle>\{title\}<\/PageTitle>/);
  assert.match(hero, /<SectionSubtitle>\{description\}<\/SectionSubtitle>/);
  assert.doesNotMatch(hero, /grid-cols|flex-row|float-(?:left|right)|lg:justify-self-end/);
});

test("route and image configuration expose only the bounded coloring paths", async () => {
  const [routes, config, dialog] = await Promise.all([
    readSource("src/shared/constants/routes.ts"),
    readSource("next.config.js"),
    readSource("src/shared/ui/dialog.tsx"),
  ]);

  assert.match(routes, /coloring:\s*\(collectionSlug: string, number: number\)/);
  assert.match(routes, /formatColoringNumber\(number\)/);
  assert.match(config, /pathname:\s*"\/colorings\/\*\*"/);
  assert.match(config, /dangerouslyAllowLocalIP:\s*process\.env\.NODE_ENV\s*!==\s*"production"/);
  assert.match(config, /hostname:\s*"api\.artmate\.ru"[\s\S]*pathname:\s*"\/colorings\/\*\*"/);
  assert.match(config, /hostname:\s*"api\.art-mate\.ru"[\s\S]*pathname:\s*"\/colorings\/\*\*"/);
  assert.match(dialog, /motion-reduce:/);
  assert.match(dialog, /size-11/);
});
