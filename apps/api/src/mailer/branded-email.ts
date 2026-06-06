type BrandedEmailInput = {
  readonly title: string;
  readonly previewText: string;
  readonly contentHtml: string;
  readonly footerHtml: string;
};

type EmailButtonInput = {
  readonly href: string;
  readonly label: string;
};

type EmailDetailRow = {
  readonly label: string;
  readonly value: string;
};

const brand = {
  background: "#fff7fb",
  border: "#f5d7e6",
  card: "#ffffff",
  gradientFallback: "#e0197d",
  gradient: "linear-gradient(135deg, #fcb316 0%, #e0197d 52%, #6252a2 100%)",
  logoPath: "/brand/artmate-logo-email.png",
  muted: "#667085",
  mutedBackground: "#fff9fc",
  text: "#202530",
} as const;

const supportEmail = "support@artmate.ru";

export function renderBrandedEmail(input: BrandedEmailInput) {
  const logoUrl = getAbsoluteSiteUrl(brand.logoPath);

  return `
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${escapeEmailHtml(input.title)}</title>
      </head>
      <body style="margin:0;padding:0;background:${brand.background};color:${brand.text};">
        <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${brand.background};opacity:0;">
          ${escapeEmailHtml(input.previewText)}
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.background};margin:0;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:${brand.card};border:1px solid ${brand.border};border-radius:20px;overflow:hidden;">
                <tr>
                  <td style="padding:0;background:${brand.gradientFallback};background-image:${brand.gradient};">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:26px 32px 24px;font-family:Arial,Helvetica,sans-serif;">
                          <table role="presentation" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;">
                            <tr>
                              <td style="padding:10px 14px;">
                                <img src="${escapeEmailHtml(logoUrl)}" width="123" height="58" alt="Artmate" style="display:block;width:123px;max-width:123px;height:auto;border:0;outline:none;text-decoration:none;" />
                              </td>
                            </tr>
                          </table>
                          <div style="margin-top:18px;font-size:24px;line-height:30px;font-weight:700;color:#ffffff;">
                            ${escapeEmailHtml(input.title)}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px 32px 30px;font-family:Arial,Helvetica,sans-serif;">
                    ${input.contentHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 32px;background:${brand.mutedBackground};border-top:1px solid ${brand.border};font-family:Arial,Helvetica,sans-serif;color:${brand.muted};font-size:12px;line-height:18px;">
                    ${input.footerHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export function renderSupportEmailFooterText() {
  return `Пожалуйста, не отвечайте на это письмо. Если у вас есть вопросы или вы не ожидали это письмо, напишите нам на ${supportEmail}.`;
}

export function renderSupportEmailFooter() {
  const escapedSupportEmail = escapeEmailHtml(supportEmail);

  return `Пожалуйста, не отвечайте на это письмо. Если у вас есть вопросы или вы не ожидали это письмо, напишите нам на <a href="mailto:${escapedSupportEmail}" style="color:${brand.text};font-weight:700;text-decoration:none;">${escapedSupportEmail}</a>.`;
}

export function renderEmailParagraph(contentHtml: string) {
  return `<p style="margin:0;color:${brand.muted};font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;">${contentHtml}</p>`;
}

export function renderEmailButton(input: EmailButtonInput) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px auto 4px;">
      <tr>
        <td style="border-radius:14px;background:${brand.gradientFallback};background-image:${brand.gradient};">
          <a href="${escapeEmailHtml(input.href)}" style="display:inline-block;border-radius:14px;padding:14px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">
            ${escapeEmailHtml(input.label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

export function renderEmailNotice(contentHtml: string) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border:1px solid ${brand.border};border-radius:16px;background:${brand.mutedBackground};">
      <tr>
        <td style="padding:16px 18px;color:${brand.muted};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;">
          ${contentHtml}
        </td>
      </tr>
    </table>
  `;
}

export function renderEmailDetails(rows: EmailDetailRow[]) {
  const rowHtml = rows
    .map(
      (row) => `
        <tr>
          <td style="padding:7px 0;color:${brand.muted};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;">
            ${escapeEmailHtml(row.label)}
          </td>
          <td align="right" style="padding:7px 0;color:${brand.text};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:700;">
            ${escapeEmailHtml(row.value)}
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border:1px solid ${brand.border};border-radius:16px;background:${brand.mutedBackground};">
      <tr>
        <td style="padding:12px 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            ${rowHtml}
          </table>
        </td>
      </tr>
    </table>
  `;
}

export function escapeEmailHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getAbsoluteSiteUrl(path: string) {
  return new URL(path, `${getSiteUrl()}/`).toString();
}

function getSiteUrl() {
  return (process.env.SITE_URL?.trim() || "https://artmate.ru").replace(
    /\/+$/,
    "",
  );
}
