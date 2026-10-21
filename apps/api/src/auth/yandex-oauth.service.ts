import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  YANDEX_AUTHORIZE_URL,
  YANDEX_PROFILE_URL,
  YANDEX_TOKEN_URL,
} from "./auth.constants";
import { isEmail } from "class-validator";
import type { YandexProfileResponse, YandexTokenResponse } from "./auth.types";

/** Provider transport only. It never creates users, links accounts or sessions.
 * default_email is contact metadata, not an exact-email verification claim. */
@Injectable()
export class YandexOAuthService {
  public getAuthorizationUrl(state: string, challenge: string): string {
    const url = new URL(YANDEX_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this._required("YANDEX_OAUTH_CLIENT_ID"));
    url.searchParams.set("redirect_uri", this.getRedirectUri());
    url.searchParams.set("force_confirm", "yes");
    url.searchParams.set("scope", "login:info login:email");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  public async getIdentityByCode(
    code: string,
    verifier: string,
  ): Promise<{ providerUserId: string; contactEmail: string | null }> {
    const response = await fetch(YANDEX_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: this._required("YANDEX_OAUTH_CLIENT_ID"),
        client_secret: this._required("YANDEX_OAUTH_CLIENT_SECRET"),
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!response.ok) throw new BadGatewayException("Yandex exchange failed");
    const token = (await response.json()) as YandexTokenResponse;
    if (typeof token.access_token !== "string" || !token.access_token)
      throw new BadGatewayException("Yandex exchange failed");
    const profileResponse = await fetch(YANDEX_PROFILE_URL, {
      headers: { authorization: `OAuth ${token.access_token}` },
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!profileResponse.ok)
      throw new BadGatewayException("Yandex profile is unavailable");
    const profile = (await profileResponse.json()) as YandexProfileResponse;
    if (
      typeof profile.id !== "string" ||
      !/^[a-zA-Z0-9._:-]{1,320}$/.test(profile.id) ||
      (profile.client_id !== undefined &&
        profile.client_id !== this._required("YANDEX_OAUTH_CLIENT_ID"))
    )
      throw new BadGatewayException("Yandex profile is invalid");
    return {
      providerUserId: profile.id,
      contactEmail:
        typeof profile.default_email === "string" &&
        profile.default_email.length <= 320 &&
        isEmail(profile.default_email.trim())
          ? profile.default_email.trim().toLowerCase()
          : null,
    };
  }

  public getRedirectUri(): string {
    return (
      process.env.YANDEX_OAUTH_REDIRECT_URI ??
      `${(process.env.API_PUBLIC_URL ?? "http://localhost:3002").replace(/\/+$/, "")}/auth/oauth/yandex/callback`
    );
  }

  private _required(name: string): string {
    const value = process.env[name]?.trim();
    if (!value)
      throw new InternalServerErrorException(`${name} is not configured`);
    return value;
  }
}
