import { Injectable, InternalServerErrorException } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";

type SendMailInput = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
};

@Injectable()
export class MailerService {
  private transporter?: Transporter;

  async sendMail(input: SendMailInput) {
    if (this.shouldLogOnly()) {
      console.info("[mail:log-only]", {
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
      return;
    }

    await this.getTransporter().sendMail({
      from: this.getRequiredEnv("MAIL_FROM"),
      replyTo: this.getOptionalEnv("MAIL_REPLY_TO"),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  }

  private getTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.getRequiredEnv("SMTP_HOST"),
        port: this.getRequiredIntegerEnv("SMTP_PORT"),
        secure: this.getBooleanEnv("SMTP_SECURE", false),
        auth: {
          user: this.getRequiredEnv("SMTP_USER"),
          pass: this.getRequiredEnv("SMTP_PASSWORD"),
        },
      });
    }

    return this.transporter;
  }

  private shouldLogOnly() {
    return (
      process.env.NODE_ENV !== "production" &&
      process.env.MAIL_LOG_ONLY === "true"
    );
  }

  private getBooleanEnv(name: string, defaultValue: boolean) {
    const value = this.getOptionalEnv(name);

    if (!value) {
      return defaultValue;
    }

    return value === "true";
  }

  private getRequiredIntegerEnv(name: string) {
    const value = Number(this.getRequiredEnv(name));

    if (!Number.isInteger(value) || value < 0 || value >= 65536) {
      throw new InternalServerErrorException(`${name} must be a valid port`);
    }

    return value;
  }

  private getOptionalEnv(name: string) {
    const value = process.env[name]?.trim();

    return value ? value : undefined;
  }

  private getRequiredEnv(name: string) {
    const value = this.getOptionalEnv(name);

    if (!value) {
      throw new InternalServerErrorException(`${name} is not configured`);
    }

    return value;
  }
}
