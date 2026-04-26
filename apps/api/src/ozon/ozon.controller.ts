import {
  ApiBadGatewayResponse,
  ApiBody,
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Redirect,
  Res,
  UnauthorizedException,
} from "@nestjs/common";

import { AuthService } from "../auth/auth.service";

import {
  OZON_OAUTH_STATE_COOKIE_NAME,
  OZON_OAUTH_STATE_MAX_AGE_MS,
} from "./ozon.constants";
import {
  OzonAuthorizationUrlDTO,
  OzonDeliveryMapRequestDTO,
  OzonDeliveryPointInfoRequestDTO,
  OzonExchangeCodeRequestDTO,
  OzonRefreshTokenRequestDTO,
  OzonTokenStatusDTO,
  OzonTokenStatusResponseDTO,
} from "./dto";
import { OzonOAuthService } from "./ozon-oauth.service";

type CookieResponse = {
  cookie: (
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      maxAge?: number;
      path: string;
      sameSite: "lax";
      secure: boolean;
    },
  ) => void;
  clearCookie: (
    name: string,
    options: {
      path: string;
      sameSite: "lax";
      secure: boolean;
    },
  ) => void;
};

@ApiTags("Ozon")
@Controller("ozon")
export class OzonController {
  constructor(
    private readonly authService: AuthService,
    private readonly ozonOAuthService: OzonOAuthService,
  ) {}

  @Get("oauth/url")
  @ApiOperation({
    summary: "Build Ozon OAuth authorization URL",
    description:
      "Use this from Swagger. It returns the Ozon authorization URL without following external redirects and sets the state cookie for callback validation.",
  })
  @ApiQuery({
    name: "scope",
    required: false,
    description:
      "Optional scope override. By default the API uses OZON_OAUTH_SCOPE.",
  })
  @ApiOkResponse({ type: OzonAuthorizationUrlDTO })
  getAuthorizationUrl(
    @Query("scope") scope: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const state = this.ozonOAuthService.createState();
    const authorizationUrl = this.ozonOAuthService.getAuthorizationUrl(
      state,
      scope,
    );

    this.setStateCookie(response, state);

    return {
      url: authorizationUrl,
    };
  }

  @Get("oauth")
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: "Start Ozon OAuth authorization",
    description:
      "Redirects to Ozon Seller OAuth. Open this endpoint in the browser, then approve access in Ozon.",
  })
  @ApiQuery({
    name: "scope",
    required: false,
    description:
      "Optional scope override. By default the API uses OZON_OAUTH_SCOPE.",
  })
  @ApiFoundResponse({ description: "Redirect to Ozon OAuth authorize page." })
  @Redirect()
  authorize(
    @Query("scope") scope: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const state = this.ozonOAuthService.createState();
    const authorizationUrl = this.ozonOAuthService.getAuthorizationUrl(
      state,
      scope,
    );

    this.setStateCookie(response, state);

    return {
      url: authorizationUrl,
    };
  }

  @Get("oauth/callback")
  @ApiOperation({
    summary: "Handle Ozon OAuth callback",
    description:
      "Ozon redirects here with code/state. The API exchanges code for tokens and saves them to DB.",
  })
  @ApiQuery({ name: "code", required: true })
  @ApiQuery({ name: "state", required: true })
  @ApiOkResponse({ type: OzonTokenStatusResponseDTO })
  async handleOAuthCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    this.validateState(cookieHeader, state);

    if (!code) {
      throw new BadRequestException("Ozon OAuth callback is missing code");
    }

    const tokenStatus = await this.ozonOAuthService.exchangeCode(code);

    this.clearStateCookie(response);

    return {
      ok: true,
      token: tokenStatus,
    };
  }

  @Get("oauth/status")
  @ApiOperation({
    summary: "Check saved Ozon OAuth token status",
    description:
      "Returns whether OAuth credentials are configured and whether an access/refresh token is saved in DB. Token values are not returned.",
  })
  @ApiOkResponse({ type: OzonTokenStatusDTO })
  getTokenStatus() {
    return this.ozonOAuthService.getTokenStatus();
  }

  @Post("oauth/refresh")
  @ApiOperation({
    summary: "Refresh Ozon OAuth token",
    description:
      "Uses refreshToken from body, saved DB token, or OZON_OAUTH_REFRESH_TOKEN. Saves the new token to DB.",
  })
  @ApiOkResponse({ type: OzonTokenStatusResponseDTO })
  async refreshToken(@Body() request: OzonRefreshTokenRequestDTO) {
    const tokenStatus =
      await this.ozonOAuthService.refreshAccessToken(request.refreshToken);

    return {
      ok: true,
      token: tokenStatus,
    };
  }

  @Post("oauth/exchange")
  @ApiOperation({
    summary: "Exchange copied Ozon authorization code",
    description:
      "Dev helper for callbacks like https://oauth.pstmn.io/v1/callback. Generate URL through /ozon/oauth/url, open it in browser, then paste code and state from the callback URL here.",
  })
  @ApiOkResponse({ type: OzonTokenStatusResponseDTO })
  async exchangeCode(
    @Body() request: OzonExchangeCodeRequestDTO,
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    this.validateState(cookieHeader, request.state);

    const tokenStatus = await this.ozonOAuthService.exchangeCode(request.code);

    this.clearStateCookie(response);

    return {
      ok: true,
      token: tokenStatus,
    };
  }

  @Post("logistics/map")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get Ozon Logistics pickup point clusters by map viewport",
    description:
      "Sends POST /v1/delivery/map to Ozon Seller API using the saved OAuth bearer token. Use this endpoint in Swagger instead of the full point list.",
  })
  @ApiBody({
    type: OzonDeliveryMapRequestDTO,
    examples: {
      moscow: {
        summary: "Moscow viewport",
        value: {
          viewport: {
            left_bottom: {
              lat: 55.55,
              long: 37.35,
            },
            right_top: {
              lat: 55.95,
              long: 37.85,
            },
          },
          zoom: 11,
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      "Raw Ozon Seller API response with pickup point clusters and map_point_ids.",
  })
  @ApiForbiddenResponse({
    description:
      "Ozon rejected the request, for example when logistics API is disabled for the selected seller or app.",
  })
  @ApiBadGatewayResponse({
    description: "Ozon Seller API returned a server-side error.",
  })
  getDeliveryMap(@Body() request: OzonDeliveryMapRequestDTO) {
    return this.ozonOAuthService.requestSellerApi("/v1/delivery/map", request);
  }

  @Post("logistics/point-info")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get Ozon Logistics pickup point details",
    description:
      "Sends POST /v1/delivery/point/info to Ozon Seller API using the saved OAuth bearer token. Take map_point_ids from /ozon/logistics/map response.",
  })
  @ApiBody({
    type: OzonDeliveryPointInfoRequestDTO,
    examples: {
      point: {
        summary: "Pickup point from map response",
        value: {
          map_point_ids: [123456789],
        },
      },
    },
  })
  @ApiOkResponse({
    description: "Raw Ozon Seller API response.",
  })
  @ApiForbiddenResponse({
    description:
      "Ozon rejected the request, for example when logistics API is disabled for the selected seller or app.",
  })
  @ApiBadGatewayResponse({
    description: "Ozon Seller API returned a server-side error.",
  })
  getDeliveryPointInfo(@Body() request: OzonDeliveryPointInfoRequestDTO) {
    return this.ozonOAuthService.requestSellerApi(
      "/v1/delivery/point/info",
      request,
    );
  }

  @Post("logistics/pickup-points")
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: "Proxy Ozon Logistics full pickup point list",
    description:
      "Sends POST /v1/delivery/point/list to Ozon Seller API. This can return a very large response, so it is hidden from Swagger.",
  })
  getPickupPoints(@Body() body: unknown) {
    return this.ozonOAuthService.requestSellerApi(
      "/v1/delivery/point/list",
      body ?? {},
    );
  }

  private validateState(cookieHeader: string | undefined, state?: string) {
    const expectedState = this.authService.getCookieValue(
      cookieHeader,
      OZON_OAUTH_STATE_COOKIE_NAME,
    );

    if (!state || !expectedState || state !== expectedState) {
      throw new UnauthorizedException("Ozon OAuth state is invalid");
    }
  }

  private setStateCookie(response: CookieResponse, state: string) {
    response.cookie(OZON_OAUTH_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      maxAge: OZON_OAUTH_STATE_MAX_AGE_MS,
      path: "/ozon/oauth",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  private clearStateCookie(response: CookieResponse) {
    response.clearCookie(OZON_OAUTH_STATE_COOKIE_NAME, {
      path: "/ozon/oauth",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
}
