const sensitiveQueryParamNames = new Set([
  "accesstoken",
  "address",
  "auth",
  "authdate",
  "authorization",
  "code",
  "customer",
  "customerid",
  "email",
  "emailaddress",
  "firstname",
  "fio",
  "fullname",
  "hash",
  "idtoken",
  "lastname",
  "mail",
  "middlename",
  "mobile",
  "name",
  "next",
  "oauthtoken",
  "otp",
  "pass",
  "password",
  "phone",
  "phonenumber",
  "postalcode",
  "queryid",
  "recipient",
  "recipientid",
  "redirect",
  "redirecturi",
  "refreshtoken",
  "returnurl",
  "secret",
  "session",
  "sessionid",
  "signature",
  "street",
  "telephone",
  "tgwebappdata",
  "tgwebappplatform",
  "tgwebappthemeparams",
  "tgwebappversion",
  "token",
  "user",
  "userid",
  "verificationcode",
  "zipcode",
]);

const sensitiveNameFragments = [
  "accesstoken",
  "address",
  "authhash",
  "authorization",
  "contact",
  "email",
  "firstname",
  "fullname",
  "hash",
  "lastname",
  "middlename",
  "password",
  "phone",
  "refreshtoken",
  "signature",
  "street",
  "telegramuser",
  "tgwebapp",
];

const emailPattern = /[^\s@]+@[^\s@]+\.[^\s@]+/u;
const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const phonePattern = /(?:^|[^\d])\+?\d[\d\s().-]{7,}\d(?:$|[^\d])/u;
const allowedProtocols = new Set(["http:", "https:"]);

export function sanitizeAnalyticsUrl(value: string, baseUrl?: string): string {
  const url = parseUrl(value, baseUrl);

  if (!url || !allowedProtocols.has(url.protocol)) {
    return "";
  }

  url.username = "";
  url.password = "";
  url.hash = "";

  for (const [key, paramValue] of Array.from(url.searchParams.entries())) {
    if (isSensitiveAnalyticsParamName(key) || isSensitiveAnalyticsParamValue(paramValue)) {
      url.searchParams.delete(key);
    }
  }

  return url.toString();
}

function parseUrl(value: string, baseUrl?: string): URL | null {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  try {
    return baseUrl ? new URL(normalizedValue, baseUrl) : new URL(normalizedValue);
  } catch {
    return null;
  }
}

export function isSensitiveAnalyticsParamName(name: string): boolean {
  const normalizedName = normalizeParamName(name);

  return (
    sensitiveQueryParamNames.has(normalizedName) ||
    sensitiveNameFragments.some((fragment) => normalizedName.includes(fragment)) ||
    normalizedName.endsWith("token") ||
    normalizedName.endsWith("signature") ||
    normalizedName.endsWith("code") ||
    /^(?:buyer|client|customer|recipient|user)(?:data|id|name)?$/u.test(normalizedName)
  );
}

export function isSensitiveAnalyticsParamValue(value: string): boolean {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return false;
  }

  return (
    emailPattern.test(normalizedValue) ||
    phonePattern.test(normalizedValue) ||
    jwtPattern.test(normalizedValue) ||
    /^bearer\s+/iu.test(normalizedValue)
  );
}

function normalizeParamName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/gu, "");
}
