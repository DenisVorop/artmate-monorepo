export const authAccessTokenCookieName = "artmate_access_token";
export const authAccessTokenMaxAgeSeconds = 60 * 60 * 24 * 7;

export function parseAuthCookie(header: string | null) {
  if (!header) {
    return undefined;
  }

  const cookieHeader = header
    .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${authAccessTokenCookieName}=`));

  if (!cookieHeader) {
    return undefined;
  }

  const [nameValue = "", ...attributes] = cookieHeader
    .split(";")
    .map((part) => part.trim());
  const separatorIndex = nameValue.indexOf("=");

  if (separatorIndex < 0) {
    return undefined;
  }

  const maxAgeAttribute = attributes.find((attribute) =>
    attribute.toLowerCase().startsWith("max-age="),
  );
  const maxAge = maxAgeAttribute
    ? Number(maxAgeAttribute.slice("max-age=".length))
    : undefined;
  const domainAttribute = attributes.find((attribute) =>
    attribute.toLowerCase().startsWith("domain="),
  );
  const domain = domainAttribute?.slice("domain=".length).trim();

  return {
    domain: domain || undefined,
    maxAge: Number.isFinite(maxAge) ? maxAge : undefined,
    value: nameValue.slice(separatorIndex + 1),
  };
}
