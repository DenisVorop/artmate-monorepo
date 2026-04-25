import { NextResponse } from "next/server";

const DEFAULT_API_BASE_URL = "http://localhost:3002";

type OAuthRouteProps = {
  params: Promise<{
    provider: string;
  }>;
};

export async function GET(_request: Request, { params }: OAuthRouteProps) {
  const { provider } = await params;
  const url = new URL(`/auth/oauth/${encodeURIComponent(provider)}`, getApiBaseUrl());

  return NextResponse.redirect(url);
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
}
