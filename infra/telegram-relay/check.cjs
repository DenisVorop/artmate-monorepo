// Run inside the deployed API container; never prints credentials or bot data.
const { getTelegramBotMethodUrl, getTelegramRequestHeaders } = require(
  `${process.cwd()}/dist/telegram/telegram-api.js`,
);

async function main() {
  for (const name of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_MINI_APP_BOT_TOKEN"]) {
    const token = process.env[name]?.trim();
    if (!token) throw new Error(`${name} is missing`);
    const start = Date.now();
    const response = await fetch(getTelegramBotMethodUrl(token, "getMe"), {
      method: "POST",
      headers: getTelegramRequestHeaders(token),
      body: "{}",
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    console.log(JSON.stringify({ bot: name, status: response.status, ok: result.ok, elapsedMs: Date.now() - start }));
    if (!response.ok || result.ok !== true) process.exitCode = 1;
  }
}
main().catch(() => {
  console.error("Telegram transport check failed");
  process.exitCode = 1;
});
