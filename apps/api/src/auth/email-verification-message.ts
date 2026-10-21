import {
  renderBrandedEmail,
  renderEmailNotice,
  renderEmailParagraph,
  renderSupportEmailFooter,
  renderSupportEmailFooterText,
} from "../mailer/branded-email";
import type { SendMailInput } from "../mailer/mailer.service";

export class EmailVerificationMessage {
  public static create(
    to: string,
    code: string,
    ttlMinutes: number,
  ): SendMailInput {
    return {
      to,
      subject: "Код подтверждения Artmate",
      text: this._text(code, ttlMinutes),
      html: this._html(code, ttlMinutes),
    };
  }
  private static _text(code: string, ttlMinutes: number) {
    return [
      "ARTMATE",
      "",
      `Код подтверждения: ${code}`,
      "",
      `Код действует ${ttlMinutes} минут.`,
      "Если вы не регистрировались в Artmate, просто игнорируйте письмо.",
      "",
      renderSupportEmailFooterText(),
    ].join("\n");
  }

  private static _html(code: string, ttlMinutes: number) {
    const codeCells = code
      .split("")
      .map(
        (digit) => `
          <td style="width:42px;height:50px;border:1px solid #f2bfd7;border-radius:12px;background:#fff9fc;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:50px;font-weight:700;color:#202530;">
            ${digit}
          </td>
        `,
      )
      .join('<td style="width:8px;"></td>');

    return renderBrandedEmail({
      title: "Подтверждение почты",
      previewText: `Код подтверждения Artmate: ${code}`,
      contentHtml: `
        ${renderEmailParagraph("Введите этот код на сайте, чтобы подтвердить почту.")}
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px auto 4px;">
          <tr>${codeCells}</tr>
        </table>
        ${renderEmailNotice(
          `Код действует <strong style="color:#202530;">${ttlMinutes} минут</strong>. Если вы не регистрировались в Artmate, просто игнорируйте это письмо.`,
        )}
      `,
      footerHtml: renderSupportEmailFooter(),
    });
  }
}
