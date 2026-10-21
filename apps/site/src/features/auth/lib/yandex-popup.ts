import type { AuthReadinessDTO, YandexResultDTO, YandexStartDTO } from "@/shared/actions/auth";

type PopupPorts = {
  start: () => Promise<YandexStartDTO>;
  read: (_attemptId: string) => Promise<YandexResultDTO>;
};

/** Owns only this popup's listeners and lifetime. Its message is a wakeup,
 * never proof of login: the bound server result is always read again. */
export class YandexPopup {
  public static open(ports: PopupPorts): { result: Promise<AuthReadinessDTO>; cancel: () => void } {
    const popup = window.open("about:blank", "", "popup,width=520,height=720");
    if (!popup)
      return {
        result: Promise.reject({ code: "POPUP_BLOCKED" }),
        cancel: () => {},
      };
    let attemptId: string | null = null;
    let finished = false;
    let reading = false;
    let startSettled = false;
    let deferredFailure: unknown;
    let lastRead = 0;
    let resolve!: (_state: AuthReadinessDTO) => void;
    let reject!: (_error: unknown) => void;
    const result = new Promise<AuthReadinessDTO>((accept, decline) => {
      resolve = accept;
      reject = decline;
    });
    const channel =
      typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("artmate:oauth");
    const finish = (state?: AuthReadinessDTO, error?: unknown) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      window.removeEventListener("message", receive);
      channel?.close();
      popup.close();
      if (state) resolve(state);
      else if (startSettled) reject(error);
      else deferredFailure = error;
    };
    const read = async () => {
      if (reading || finished || !attemptId) return;
      reading = true;
      try {
        const response = await ports.read(attemptId);
        if (finished) return;
        if (response.attemptId !== attemptId) return;
        if (response.status === "PENDING") finish(response.state);
        if (response.status === "REJECTED") finish(undefined, { code: response.errorCode });
      } catch {
        // A lost callback or temporary read failure never repeats the provider exchange.
      } finally {
        reading = false;
      }
    };
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== popup) return;
      if (!event.data || event.data.type !== "artmate:oauth" || event.data.attemptId !== attemptId)
        return;
      void read();
    };
    window.addEventListener("message", receive);
    if (channel)
      channel.onmessage = (event: MessageEvent) => {
        if (event.data?.type === "artmate:oauth" && event.data.attemptId === attemptId) void read();
      };
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const timer = setInterval(() => {
      if (Date.now() >= expiresAt) {
        finish(undefined, { code: "POPUP_TIMEOUT" });
        return;
      }
      // COOP can make a live cross-origin popup appear closed. Its bound
      // server attempt, not Window.closed, determines whether it completed.
      if (attemptId && Date.now() - lastRead >= 1000) {
        lastRead = Date.now();
        void read();
      }
    }, 250);
    void ports
      .start()
      .then((response) => {
        if (finished) return;
        const url = new URL(response.authorizationUrl);
        if (url.origin !== "https://oauth.yandex.ru" || url.pathname !== "/authorize")
          throw new Error("Unexpected authorization destination");
        attemptId = response.attemptId;
        popup.location.replace(url.toString());
      })
      .catch(() => finish(undefined, { code: "PROVIDER_UNAVAILABLE" }))
      .finally(() => {
        startSettled = true;
        if (deferredFailure !== undefined) reject(deferredFailure);
      });
    return { result, cancel: () => finish(undefined, { code: "POPUP_CLOSED" }) };
  }
}
