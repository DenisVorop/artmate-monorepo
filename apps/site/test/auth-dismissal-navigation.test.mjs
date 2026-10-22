import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const read = (path) => readFile(new URL(`../src/features/auth/${path}`, import.meta.url), "utf8");
function evaluate(source, mocks) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(
    (id) => (id in mocks ? mocks[id] : require(id)),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}

for (const [pathname, dismissible] of [
  ["/auth", false],
  ["/auth/recovery", false],
  ["/auth/activate-order", false],
  ["/auth/reset-password", false],
  ["/contacts", true],
  ["/author", true],
]) {
  test(`auth dismissal on ${pathname} preserves route ownership`, async () => {
    let cancellations = 0;
    const coordinator = {
      subscribe() {},
      getSnapshot: () => ({ visible: true, step: "login", pending: false }),
      cancel: () => {
        cancellations++;
      },
    };
    const flowMocks = {
      react: { useEffect() {}, useState: (initial) => [initial] },
      "./flow/flow-view": { AuthFlowView: "flow" },
    };
    const currentFlow = evaluate(await read("ui/current-flow-view.tsx"), flowMocks);
    const { AuthHost } = evaluate(await read("ui/auth-host.tsx"), {
      react: {
        useEffect() {},
        useRef: () => ({ current: null }),
        useSyncExternalStore: (_, snapshot) => snapshot(),
      },
      "next/navigation": { usePathname: () => pathname },
      "@/shared/constants": { routes: { auth: "/auth" } },
      "@/shared/ui/dialog": { Dialog: "dialog", DialogContent: "content", DialogTitle: "title" },
      "./current-flow-view": currentFlow,
    });
    const dialog = AuthHost({ coordinator, returnFocus: { current: null } });
    if (!dismissible) {
      assert.equal(dialog, null, "standalone pages must never mount a dialog");
      assert.equal(cancellations, 0);
      return;
    }
    const content = dialog.props.children;
    dialog.props.onOpenChange(false);
    assert.equal(cancellations, 1);
    const current = content.props.children[1];
    const view = current.type(current.props);
    assert.equal(typeof view.props.onCancel, "function");
    view.props.onCancel();
    assert.equal(cancellations, 2);
  });
}

for (const step of ["closed", "loading"]) {
  for (const initialStep of ["login", "recovery", "activation-loading", "completion"]) {
    test(`${initialStep} is rendered before route initialization (${step})`, async () => {
      const { CurrentFlowView } = evaluate(await read("ui/current-flow-view.tsx"), {
        react: { useEffect() {}, useState: (initial) => [initial] },
        "./flow/flow-view": { AuthFlowView: "flow" },
      });
      const view = CurrentFlowView({
        snapshot: { step, pending: false },
        coordinator: {},
        dismissible: false,
        initialStep,
      });
      assert.equal(view.props.step, initialStep);
      assert.equal(view.props.onCancel, undefined);
      assert.equal(view.props.isPending, true);
    });
  }
}

for (const [path, name] of [
  ["ui/session-menu.tsx", "SessionMenu"],
  ["ui/session-links.tsx", "SessionLinks"],
]) {
  test(`${name} redirects to home only after successful logout`, async () => {
    const events = [];
    const previousWindow = globalThis.window;
    globalThis.window = { location: { replace: (url) => events.push(["replace", url]) } };
    let options;
    const ui = evaluate(await read(path), {
      "next/navigation": {
        useRouter: () => ({
          replace: (url) => events.push(["replace", url]),
          refresh: () => assert.fail("must not refresh the protected route"),
        }),
      },
      "@/entities/session": {
        useSession: () => ({ user: { email: "test@example.test" }, isPending: false }),
        getSessionUserDisplayName: () => "Test",
      },
      "@/shared/constants": {
        routes: { home: "/", auth: "/auth", account: "/account", workshop: "/account/workshop" },
      },
      "@/shared/ui": new Proxy({}, { get: (_, key) => key }),
      "@/shared/ui/link": { Link: "a" },
      "../model": {
        useLogoutMutation: (value) => {
          options = value;
          return { mutate() {}, isPending: false };
        },
      },
    });
    ui[name]({ onNavigate: () => events.push(["close-menu"]) });
    assert.deepEqual(events, []);
    options.onSuccess();
    globalThis.window = previousWindow;
    assert.deepEqual(
      events,
      name === "SessionLinks" ? [["close-menu"], ["replace", "/"]] : [["replace", "/"]],
    );
  });
}
