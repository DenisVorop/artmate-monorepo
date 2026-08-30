import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
  UseInterceptors,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { ClassConstructor, plainToInstance } from "class-transformer";
import { validateSync, ValidationError } from "class-validator";
import { Observable, map } from "rxjs";

import { matchesIfNoneMatch, quoteStrongEtag } from "./conditional-get";

type ResponseValidationOptions = {
  conditionalGet?: boolean;
  isArray?: boolean;
};

type ConditionalGetRequest = {
  headers: { "if-none-match"?: string };
};

type ConditionalGetResponse = {
  setHeader(name: string, value: string): void;
  statusCode: number;
};

const validatorOptions = {
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  validationError: {
    target: false,
    value: false,
  },
  whitelist: true,
};

@Injectable()
export class ResponseValidationInterceptor<
  T extends object,
> implements NestInterceptor {
  constructor(
    private readonly dto: ClassConstructor<T>,
    private readonly options: ResponseValidationOptions = {},
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<T | T[] | undefined> {
    const http = context.switchToHttp();
    const request = http.getRequest<ConditionalGetRequest>();
    const response = http.getResponse<ConditionalGetResponse>();

    if (this.options.conditionalGet) {
      response.setHeader("Cache-Control", "no-store");
    }

    return next.handle().pipe(
      map((value) => {
        const validated = this.validateResponse(value);

        if (!this.options.conditionalGet) {
          return validated;
        }

        const etag = quoteStrongEtag(
          createHash("sha256").update(JSON.stringify(validated)).digest("hex"),
        );
        response.setHeader(
          "Cache-Control",
          "public, max-age=0, must-revalidate",
        );
        response.setHeader("ETag", etag);

        if (matchesIfNoneMatch(request.headers["if-none-match"], etag)) {
          response.statusCode = 304;
          return undefined;
        }

        return validated;
      }),
    );
  }

  private validateResponse(value: unknown): T | T[] {
    if (this.options.isArray) {
      if (!Array.isArray(value)) {
        throw new InternalServerErrorException("Response validation failed");
      }

      return value.map((item) => this.validateItem(item));
    }

    return this.validateItem(value);
  }

  private validateItem(value: unknown): T {
    const instance = plainToInstance(this.dto, value);
    const errors = validateSync(instance, validatorOptions);

    if (errors.length > 0) {
      throw new InternalServerErrorException({
        message: "Response validation failed",
        errors: this.formatErrors(errors),
      });
    }

    return instance;
  }

  private formatErrors(errors: ValidationError[], path = ""): string[] {
    return errors.flatMap((error) => {
      const propertyPath = path ? `${path}.${error.property}` : error.property;
      const currentErrors = Object.values(error.constraints ?? {}).map(
        (message) => `${propertyPath}: ${message}`,
      );
      const childErrors = this.formatErrors(error.children ?? [], propertyPath);

      return [...currentErrors, ...childErrors];
    });
  }
}

export function ValidateResponse<T extends object>(
  dto: ClassConstructor<T>,
  options?: ResponseValidationOptions,
) {
  return UseInterceptors(new ResponseValidationInterceptor(dto, options));
}
