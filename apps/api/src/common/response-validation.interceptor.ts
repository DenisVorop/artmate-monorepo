import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
  UseInterceptors,
} from "@nestjs/common";
import { ClassConstructor, plainToInstance } from "class-transformer";
import { validateSync, ValidationError } from "class-validator";
import { Observable, map } from "rxjs";

type ResponseValidationOptions = {
  isArray?: boolean;
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
export class ResponseValidationInterceptor<T extends object>
  implements NestInterceptor
{
  constructor(
    private readonly dto: ClassConstructor<T>,
    private readonly options: ResponseValidationOptions = {},
  ) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<T | T[]> {
    return next.handle().pipe(map((value) => this.validateResponse(value)));
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
      const propertyPath = path
        ? `${path}.${error.property}`
        : error.property;
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
