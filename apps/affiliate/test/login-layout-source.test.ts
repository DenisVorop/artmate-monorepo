import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const loginSource = readFileSync(
  new URL("../src/_pages/login/index.tsx", import.meta.url),
  "utf8",
);
const loginFormSource = readFileSync(
  new URL("../src/features/auth/ui/login-form.tsx", import.meta.url),
  "utf8",
);
const siteConstantsSource = readFileSync(
  new URL("../src/shared/constants/site.ts", import.meta.url),
  "utf8",
);
const constantsIndexSource = readFileSync(
  new URL("../src/shared/constants/index.ts", import.meta.url),
  "utf8",
);

test("uses the finished desktop login surface without dead hero decoration", () => {
  assert.doesNotMatch(loginSource, /Творчество объединяет/);
  assert.doesNotMatch(loginSource, /Договор и условия сотрудничества в одном кабинете\./);
  assert.doesNotMatch(loginSource, /hero-surface|hero-orb/);
  assert.match(loginSource, /<section className="[^"]*hidden[^"]*bg-ink[^"]*text-white[^"]*lg:flex/);
  assert.match(loginSource, /lg:flex-col/);
  assert.match(loginSource, /gap-12/);
  assert.match(loginSource, /className="relative z-10 my-auto max-w-2xl"/);
});

test("retains the responsive partner intro and login form", () => {
  assert.match(loginSource, /Пространство для партнёров Artmate/);
  assert.match(loginSource, /<LoginForm nextPath=\{nextPath\} \/>/);
  assert.match(loginSource, /hidden[^"]*lg:flex/);
  assert.match(loginSource, /lg:hidden/);
});

test("removes the alternate site login and its obsolete imports", () => {
  assert.doesNotMatch(
    loginSource,
    /ArrowUpRight|publicSiteAuthUrl|Войти через сайт Artmate|>\s*или\s*</,
  );
  assert.doesNotMatch(loginSource, /import \{ Button \} from "@\/shared\/ui"/);
});

test("exports the verified public recovery URL instead of the old auth URL", () => {
  assert.doesNotMatch(siteConstantsSource, /publicSiteAuthUrl/);
  assert.match(siteConstantsSource, /publicSiteRecoveryUrl/);
  assert.match(siteConstantsSource, /publicSiteUrl\.replace\(\/\\\/\$\/, ""\)/);
  assert.match(siteConstantsSource, /\/auth\/recovery/);
  assert.match(constantsIndexSource, /publicSiteRecoveryUrl/);
  assert.doesNotMatch(constantsIndexSource, /publicSiteAuthUrl/);
});

test("links password recovery beside an explicitly associated password label", () => {
  assert.match(loginFormSource, /useId/);
  assert.match(loginFormSource, /htmlFor=\{passwordInputId\}/);
  assert.match(loginFormSource, /id=\{passwordInputId\}/);
  assert.match(loginFormSource, /href=\{publicSiteRecoveryUrl\}/);
  assert.match(loginFormSource, /Забыли пароль\?/);
  assert.match(loginFormSource, /target="_blank"/);
  assert.match(loginFormSource, /rel="noopener noreferrer"/);
  assert.match(loginFormSource, /aria-label="[^"]*новой вкладке[^"]*"/);
  assert.match(
    loginFormSource,
    /<div className="flex flex-wrap[^>]*>[\s\S]*?<label[^>]*>\s*Пароль\s*<\/label>[\s\S]*?<a/,
  );
});
