import type {
  ActivationPasswordDraftInputDTO,
  AuthReadinessDTO,
  AuthUserDTO,
  PasswordFlowInputDTO,
  ProfileDraftInputDTO,
  RecoveryFlowInputDTO,
  RegistrationDraftInputDTO,
  RequestRegistrationCodeInputDTO,
} from "@/shared/actions/auth";
import type {
  AuthFailure,
  AuthFlowConfig,
  AuthFlowPorts,
  AuthFlowSnapshot,
  AuthOptions,
  AuthRouteEntry,
  AuthOutcome,
} from "./auth-flow-state";

import { toConsentDecision } from "./to-consent-decision";
import { readAdvertisingConsentDevice } from "./read-advertising-consent-device";

type Request = {
  owner: symbol;
  config: AuthFlowConfig;
  success: (_user: AuthUserDTO) => void | Promise<void>;
  failure: (_error: AuthFailure) => void | Promise<void>;
  promise: Promise<AuthOutcome>;
  resolve: (_result: AuthOutcome) => void;
  reject: (_error: unknown) => void;
  alive: boolean;
  settled: boolean;
  operationKey: string;
  registration: boolean;
};

/** One browser-cookie pipeline, with a continuation bound to its initiating component. */
export class AuthFlowCoordinator {
  private readonly _listeners = new Set<() => void>();
  private _snapshot: AuthFlowSnapshot = {
    step: "closed",
    visible: false,
    pending: false,
    error: null,
    email: "",
    recoverySent: false,
    canRetry: false,
  };
  private _active: Request | null = null;
  private _inFlight: Promise<void> = Promise.resolve();
  private _epoch = 0;

  public constructor(private readonly _ports: AuthFlowPorts) {}

  public readonly subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  };

  public readonly getSnapshot = (): AuthFlowSnapshot => this._snapshot;

  public request<Payload>(
    owner: symbol,
    config: AuthFlowConfig,
    options: AuthOptions<Payload>,
    payload: Payload,
    entry?: AuthRouteEntry,
  ): Promise<AuthOutcome> {
    if (this._active?.owner === owner) return this._active.promise;
    if (this._active) {
      const error: AuthFailure = { code: "busy" };
      try {
        return Promise.resolve(options.onError?.(error, payload)).then(() => ({
          status: "error" as const,
          error,
        }));
      } catch (failure) {
        return Promise.reject(failure);
      }
    }
    let resolve!: Request["resolve"];
    let reject!: Request["reject"];
    const promise = new Promise<AuthOutcome>((accept, decline) => {
      resolve = accept;
      reject = decline;
    });
    const request: Request = {
      owner,
      config: { ...config },
      success: (user) => options.onSuccess?.(user, payload),
      failure: (error) => options.onError?.(error, payload),
      promise,
      resolve,
      reject,
      alive: true,
      settled: false,
      operationKey: this._ports.operationKey?.() ?? crypto.randomUUID(),
      registration: false,
    };
    this._active = request;
    this._set({
      step: "loading",
      visible: false,
      pending: true,
      error: null,
      email: config.initialEmail ?? "",
      emailConfirmation: undefined,
      recoverySent: false,
      canRetry: false,
      flow: undefined,
      user: undefined,
    });
    this._set({ pending: false });
    void this._run(
      async () => {
        if (entry?.type === "activation") {
          if (!this._ports.exchangeActivation) throw { status: 503 };
          return this._ports.exchangeActivation({ token: entry.token });
        }
        if (entry?.type === "resume") return this._ports.resume();
        if (entry?.type === "recovery") {
          this._set({ step: "recovery" });
          return undefined;
        }
        return this._ports.start(request.config);
      },
      entry?.type === "activation" ? "activation" : entry?.type === "resume" ? "other" : "start",
    );
    return promise;
  }

  public isPending(owner: symbol): boolean {
    return this._active?.owner === owner && !this._active.settled;
  }

  public releaseOwner(owner: symbol): void {
    if (this._active?.owner !== owner) return;
    this._active.alive = false;
    void this.cancel();
  }

  public async cancel(): Promise<void> {
    const request = this._active;
    if (!request) {
      this._set({ step: "closed", error: null, flow: undefined, user: undefined, email: "" });
      return;
    }
    if (request.settled) return this._inFlight;
    const epoch = ++this._epoch;
    this._ports.cancelProvider?.();
    this._fail(request, { code: "cancelled" });
    this._set({
      step: "closed",
      pending: false,
      error: null,
      flow: undefined,
      user: undefined,
      email: "",
    });
    // Keep the cookie owner reserved until the outstanding response and cancellation drain.
    const previous = this._inFlight;
    this._inFlight = (async () => {
      await previous;
      try {
        await this._ports.cancel();
      } catch {
        // The continuation is gone. A later request always starts with a fresh server check.
      } finally {
        if (this._active === request && this._epoch === epoch) this._active = null;
      }
    })();
    return this._inFlight;
  }

  public showEmail(): Promise<void> {
    return this._entry("email");
  }
  public showLogin(): Promise<void> {
    return this._entry("login");
  }
  public showRecovery(): Promise<void> {
    return this._entry("recovery");
  }

  public login(input: PasswordFlowInputDTO): Promise<void> {
    if (this._snapshot.step !== "login") return Promise.resolve();
    const request = this._active;
    const epoch = this._epoch;
    this._set({ email: input.email, emailConfirmation: undefined });
    return this._run(async () => {
      // Explicit credentials start a new identity attempt, including after a reload.
      try {
        await this._ports.cancel();
      } catch (error) {
        if (this._status(error) !== 401) throw error;
      }
      if (!request || !this._owns(request, epoch)) return undefined;
      return this._ports.login(input);
    }, "password");
  }
  public requestCode(input: RequestRegistrationCodeInputDTO): Promise<void> {
    if (this._snapshot.step !== "email") return Promise.resolve();
    this._set({ email: input.email });
    return this._run(() => this._ports.requestCode(input), "other");
  }
  public confirmCode(input: { code: string }): Promise<void> {
    const flow = this._snapshot.flow;
    if (flow?.status !== "PENDING" || flow.nextStep !== "code") return Promise.resolve();
    return this._run(
      () => this._ports.confirmCode({ ...input, generation: flow.generation }),
      "confirm",
    );
  }
  public resendCode(): Promise<void> {
    if (this._snapshot.step !== "code") return Promise.resolve();
    return this._run(() => this._ports.resend(), "other");
  }
  public saveRegistration(input: Omit<RegistrationDraftInputDTO, "operationKey">): Promise<void> {
    const request = this._active;
    if (!request || this._snapshot.step !== "registration") return Promise.resolve();
    return this._run(
      () => this._ports.saveRegistration({ ...input, operationKey: request.operationKey }),
      "other",
    );
  }
  public saveActivation(
    input: Omit<ActivationPasswordDraftInputDTO, "operationKey">,
  ): Promise<void> {
    const request = this._active;
    if (!request || this._snapshot.step !== "activation") return Promise.resolve();
    return this._run(
      () => this._ports.saveActivation({ ...input, operationKey: request.operationKey }),
      "other",
    );
  }
  public saveProfile(input: ProfileDraftInputDTO): Promise<void> {
    if (this._snapshot.step !== "profile") return Promise.resolve();
    return this._run(() => this._ports.saveProfile(input), "other");
  }
  public submitConsents(values: { personalData: boolean; advertising: boolean }): Promise<void> {
    const flow = this._snapshot.flow;
    const request = this._active;
    if (!request || flow?.status !== "PENDING" || flow.nextStep !== "consents") {
      return Promise.resolve();
    }
    if (!values.personalData) {
      this._set({ error: "Нужно согласие на обработку данных." });
      return Promise.resolve();
    }
    const epoch = this._epoch;
    return this._run(
      async () => {
        const input = toConsentDecision(flow, values, request.config.source);
        if (values.advertising) {
          input.advertisingDevice = await readAdvertisingConsentDevice();
          if (!this._owns(request, epoch)) return;
        }
        return this._ports.complete(input);
      },
      "completion",
    );
  }

  public requestRecovery(input: RecoveryFlowInputDTO): Promise<void> {
    if (this._snapshot.step !== "recovery") return Promise.resolve();
    return this._run(async () => {
      await this._ports.recovery(input);
      this._set({ recoverySent: true });
      return undefined;
    }, "other");
  }
  public retry(): Promise<void> {
    if (!this._snapshot.canRetry) return Promise.resolve();
    return this._run(() => this._ports.resume(), "completion");
  }
  public startYandex(): Promise<void> {
    if (!["login", "email"].includes(this._snapshot.step)) return Promise.resolve();
    return this._run(async () => {
      this._set({ step: "provider" });
      if (!this._ports.yandex) throw { code: "PROVIDER_UNAVAILABLE" };
      return this._ports.yandex();
    }, "provider");
  }

  private async _entry(step: "login" | "email" | "recovery"): Promise<void> {
    const request = this._active;
    if (!request || request.settled) return;
    const epoch = ++this._epoch;
    request.registration = false;
    this._ports.cancelProvider?.();
    this._set({ pending: true, error: null, canRetry: false });
    const previous = this._inFlight;
    this._inFlight = (async () => {
      await previous;
      if (!this._owns(request, epoch)) return;
      try {
        await this._ports.cancel();
      } catch (error) {
        if (this._status(error) !== 401) {
          if (this._owns(request, epoch)) {
            this._set({ pending: false, error: "Не удалось вернуться. Попробуйте ещё раз." });
          }
          return;
        }
      }
      if (this._owns(request, epoch)) {
        this._set({
          step,
          pending: false,
          error: null,
          flow: undefined,
          recoverySent: false,
          emailConfirmation: undefined,
        });
      }
    })();
    return this._inFlight;
  }

  private _run(
    operation: () => Promise<AuthReadinessDTO | undefined>,
    action: "start" | "password" | "confirm" | "completion" | "other" | "provider" | "activation",
  ): Promise<void> {
    const request = this._active;
    if (!request || request.settled || (this._snapshot.pending && action !== "start")) {
      return Promise.resolve();
    }
    const epoch = this._epoch;
    const recoverOnly = this._snapshot.canRetry;
    this._set({ pending: true, error: null, canRetry: false });
    const task = async () => {
      try {
        const result = await (recoverOnly ? this._ports.resume() : operation());
        if (this._owns(request, epoch) && result) await this._apply(result, request, epoch);
      } catch (error) {
        if (!this._owns(request, epoch)) return;
        await this._handleError(error, action, request, epoch);
      } finally {
        if (this._owns(request, epoch)) this._set({ pending: false });
      }
    };
    this._inFlight = task();
    return this._inFlight;
  }

  private async _apply(result: AuthReadinessDTO, request: Request, epoch: number): Promise<void> {
    let state = result;
    let polls = 0;
    let resumedPreparation = false;
    while (this._owns(request, epoch)) {
      if (state.status === "COMPLETED") {
        await this._ports.publishSession(state.user);
        if (!this._owns(request, epoch)) return;
        request.settled = true;
        if (request.registration) {
          try {
            this._ports.registrationCompleted?.();
          } catch {
            /* Telemetry cannot change a completed login. */
          }
        }
        this._active = null;
        this._set({ step: "success", pending: false, flow: undefined, user: state.user });
        try {
          await request.success(state.user);
          request.resolve({ status: "success", user: state.user });
        } catch (error) {
          // A business continuation failure is never reported as an authentication failure.
          request.reject(error);
        } finally {
          if (this._active === request) this._active = null;
        }
        return;
      }
      if (state.status === "REJECTED") {
        this._terminal(request, this._rejection(state.errorCode));
        return;
      }
      if (state.status === "EMAIL_CONFIRMATION_REQUIRED") {
        this._set({ step: "email", flow: state, emailConfirmation: "required" });
        return;
      }
      if (state.status === "LOGIN_REQUIRED") {
        const confirmed =
          this._snapshot.step === "code" && this._snapshot.emailConfirmation === "required";
        this._set({
          step: "login",
          flow: state,
          emailConfirmation: confirmed ? "confirmed" : undefined,
        });
        return;
      }
      if (Date.parse(state.expiresAt) <= (this._ports.now?.() ?? Date.now())) {
        this._terminal(request, "flow_expired");
        return;
      }
      if (state.nextStep === "preparing") {
        if (resumedPreparation) {
          this._terminal(request, "state_unavailable");
          return;
        }
        resumedPreparation = true;
        state = await this._ports.resume();
        continue;
      }
      if (state.nextStep === "registration") request.registration = true;
      this._set({ step: state.nextStep, flow: state });
      if (state.nextStep !== "completion") return;
      if (++polls > 30) {
        this._set({
          visible: true,
          canRetry: true,
          error: "Вход ещё завершается. Попробуйте позже.",
        });
        return;
      }
      await (this._ports.wait?.(250) ?? new Promise((resolve) => setTimeout(resolve, 250)));
      if (!this._owns(request, epoch)) return;
      state = await this._ports.resume();
    }
  }

  private async _handleError(
    error: unknown,
    action: "start" | "password" | "confirm" | "completion" | "other" | "provider" | "activation",
    request: Request,
    epoch: number,
  ): Promise<void> {
    const status = this._status(error);
    if (action === "activation" && [400, 409].includes(status)) {
      this._terminal(request, status === 400 ? "flow_expired" : "authentication_failed");
      return;
    }
    if (action === "provider" && error && typeof error === "object" && "code" in error) {
      try {
        await this._ports.cancel();
      } catch {
        /* A failed entry may not have a pending flow. */
      }
      if (this._owns(request, epoch)) this._set({ step: "login", error: _providerMessage(error) });
      return;
    }
    if (action === "start" && status === 401) {
      this._set({ step: "login", flow: undefined });
      return;
    }
    if (action === "password") {
      // Resuming here could publish an older account instead of the submitted one.
      this._set({
        step: "login",
        flow: undefined,
        canRetry: false,
        error:
          status === 401
            ? "Проверьте почту и пароль."
            : status === 429
              ? "Слишком много попыток. Попробуйте позже."
              : "Не удалось войти. Попробуйте ещё раз.",
      });
      return;
    }
    if (status === 401 || status === 410) {
      this._terminal(request, "flow_expired");
      return;
    }
    if (status === 400 || status === 429) {
      this._set({
        error:
          status === 429
            ? "Слишком много попыток. Попробуйте позже."
            : action === "confirm"
              ? "Код не подошёл. Проверьте или запросите новый."
              : "Проверьте введённые данные.",
      });
      return;
    }
    // The request may have committed: recover the same bound flow, never repeat its mutation.
    try {
      const result = await this._ports.resume();
      if (this._owns(request, epoch)) await this._apply(result, request, epoch);
    } catch {
      if (this._owns(request, epoch)) {
        this._set({
          step: "completion",
          visible: true,
          canRetry: true,
          error: "Не удалось проверить вход. Попробуйте снова.",
        });
      }
    }
  }

  private _terminal(request: Request, code: AuthFailure["code"]): void {
    if (request.config.presentation === "inline") {
      request.registration = false;
      const epoch = ++this._epoch;
      const previous = this._inFlight;
      this._set({
        step: "login",
        visible: true,
        pending: true,
        flow: undefined,
        canRetry: false,
        emailConfirmation: undefined,
        error:
          code === "flow_expired" || code === "session_expired"
            ? "Время входа истекло. Войдите заново."
            : "Не удалось войти. Попробуйте ещё раз.",
      });
      this._inFlight = previous.then(async () => {
        try {
          await this._ports.cancel();
        } catch {
          // The next explicit attempt starts with fresh server state.
        } finally {
          if (this._owns(request, epoch)) this._set({ pending: false });
        }
      });
      return;
    }
    this._fail(request, { code });
    this._set({ step: "closed", pending: false, flow: undefined, canRetry: false });
    // Keep the owner through the current response turn, so a terminal callback cannot
    // start a competing cookie mutation before the old pipeline has drained.
    const epoch = this._epoch;
    void this._inFlight.then(async () => {
      try {
        await this._ports.cancel();
      } catch {
        // No continuation remains; the next entry still checks fresh server state.
      } finally {
        if (this._active === request && this._epoch === epoch) this._active = null;
      }
    });
  }

  private _fail(request: Request, error: AuthFailure): void {
    if (request.settled) return;
    request.settled = true;
    if (request.alive) {
      try {
        void Promise.resolve(request.failure(error)).catch(() => undefined);
      } catch {
        // Authentication already has its terminal result; do not dispatch it again.
      }
    }
    request.resolve({ status: "error", error });
  }
  private _owns(request: Request, epoch: number): boolean {
    return this._active === request && !request.settled && request.alive && this._epoch === epoch;
  }
  private _status(error: unknown): number {
    return error !== null &&
      typeof error === "object" &&
      "status" in error &&
      typeof error.status === "number"
      ? error.status
      : 500;
  }
  private _rejection(code: string): AuthFailure["code"] {
    if (code.includes("EXPIRED")) return "flow_expired";
    if (code.includes("PROFILE")) return "profile_incomplete";
    if (code.includes("CONSENT")) return "required_consent_missing";
    return "authentication_failed";
  }
  private _set(update: Partial<AuthFlowSnapshot>): void {
    const interactive = [
      "provider",
      "login",
      "email",
      "code",
      "registration",
      "activation",
      "profile",
      "consents",
      "recovery",
    ];
    if (update.step && interactive.includes(update.step)) update.visible = true;
    if (update.step === "closed" || update.step === "success") update.visible = false;
    this._snapshot = { ...this._snapshot, ...update };
    this._listeners.forEach((listener) => listener());
  }
}

function _providerMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === "POPUP_BLOCKED") return "Разрешите всплывающие окна для входа.";
  if (code === "POPUP_CLOSED") return "Окно Яндекса закрыто. Попробуйте снова.";
  if (code === "PROVIDER_DENIED") return "Вход через Яндекс отменён.";
  if (code === "EMAIL_CONFIRMATION_REQUIRED") return "Яндекс не передал почту. Войдите с паролем.";
  if (code === "ACCOUNT_LINK_REQUIRED") return "Яндекс не подключён. Войдите с паролем.";
  return "Не удалось войти через Яндекс. Попробуйте ещё раз.";
}
