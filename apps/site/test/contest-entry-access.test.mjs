import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(
  new URL("../src/features/contests/lib/contest-state.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({ requested = true, user = null, pending = false, canParticipate = true } = {}) {
  const slots = [];
  const timers = new Map();
  let cursor = 0;
  let nextTimer = 0;
  let authCalls = 0;
  let authOptions;
  let session = { user, isPending: pending };
  const params = requested ? { participate: "1" } : {};
  const mocks = {
    react: {
      useRef(initial) {
        const i = cursor++;
        return (slots[i] ??= { current: initial });
      },
      useState(initial) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = initial;
        return [
          slots[i],
          (value) => {
            slots[i] = value;
          },
        ];
      },
      useEffect(effect, deps) {
        const i = cursor++;
        if (slots[i]?.deps.every((dep, j) => Object.is(dep, deps[j]))) return;
        slots[i]?.cleanup?.();
        slots[i] = { deps, cleanup: effect() };
      },
    },
    "@/entities/session": { useSession: () => session },
    "@/features/auth": {
      useAuth: (options) => {
        authOptions = options;
        return {
          onAuth: async () => {
            authCalls++;
          },
          isPending: false,
        };
      },
    },
    "@/shared/lib/query-state-manager": {
      useQueryState: () => [
        params,
        {
          add: (key, value) => {
            params[key] = value;
          },
          remove: (key) => {
            delete params[key];
          },
        },
      ],
    },
  };
  const loaded = { exports: {} };
  const clock = {
    setTimeout: (callback) => {
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  new Function("require", "module", "exports", "window", compiled)(
    (id) => mocks[id] ?? require(id),
    loaded,
    loaded.exports,
    clock,
  );
  return {
    render() {
      cursor = 0;
      return loaded.exports.useContestDetailsState(canParticipate);
    },
    flush() {
      const queued = [...timers.values()];
      timers.clear();
      queued.forEach((callback) => callback());
    },
    session(next) {
      session = next;
    },
    cancel() {
      authOptions.onError({ code: "cancelled" });
    },
    get authCalls() {
      return authCalls;
    },
    params,
  };
}

test("guest deep link waits for session and requests login before opening upload", () => {
  const h = harness({ pending: true });
  assert.equal(h.render().entryOpen, false);
  h.flush();
  assert.equal(h.authCalls, 0);
  h.session({ user: null, isPending: false });
  assert.equal(h.render().entryOpen, false);
  h.flush();
  assert.equal(h.authCalls, 1);
  h.render();
  h.flush();
  assert.equal(h.authCalls, 1, "rerender must not start a second login");
  h.session({ user: { id: "alice" }, isPending: false });
  assert.equal(h.render().entryOpen, true, "login resumes the requested upload");
});

test("participation button requests login; cancellation clears intent", () => {
  const h = harness({ requested: false });
  h.render().openEntry({ focus() {} });
  assert.equal(h.params.participate, "1");
  assert.equal(h.render().entryOpen, false);
  h.flush();
  assert.equal(h.authCalls, 1);
  h.cancel();
  assert.equal(h.render().entryOpen, false);
  assert.equal(h.params.participate, undefined);
  h.flush();
  assert.equal(h.authCalls, 1);
});

test("confirmed server submission closes the form and opens own entry", () => {
  const h = harness({ user: { id: "alice" } });
  assert.equal(h.render().entryOpen, true);
  assert.equal(h.render().userId, "alice");
  h.render().entrySubmitted();
  assert.equal(h.render().entryOpen, false);
  assert.equal(h.render().tab, "mine");
});

test("expired session closes upload and starts login without accepting a submission", () => {
  const h = harness({ user: { id: "alice" } });
  assert.equal(h.render().entryOpen, true);
  h.session({ user: null, isPending: false });
  const state = h.render();
  assert.equal(state.entryOpen, false);
  h.flush();
  assert.equal(h.authCalls, 1);
});

test("closed contest ignores participation intent", () => {
  const h = harness({ canParticipate: false, user: { id: "alice" } });
  const state = h.render();
  assert.equal(state.entryOpen, false);
  h.flush();
  assert.equal(h.authCalls, 0);
});
