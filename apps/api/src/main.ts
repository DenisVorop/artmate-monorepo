import "dotenv/config";
import "reflect-metadata";

import { join } from "node:path";

import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { type NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import { configureStaticUploads } from "./colorings/static-uploads";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = getPort(process.env.PORT);

  app.enableCors({
    credentials: true,
    origin: getCorsOrigins(),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      validationError: {
        target: false,
        value: false,
      },
      whitelist: true,
    }),
  );

  configureStaticUploads(app, join(process.cwd(), "uploads"));

  if (process.env.SWAGGER_ENABLED !== "false") {
    setupSwagger(app);
  }

  await app.listen(port);
}

function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("Artmate API")
    .setDescription("Backend API for Artmate")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("swagger", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}

function getCorsOrigins() {
  const origins =
    process.env.CORS_ORIGIN ??
    [
      process.env.SITE_URL ?? "http://localhost:3000",
      process.env.ADMIN_URL ?? "http://localhost:3003",
    ].join(",");

  return origins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getPort(port: string | undefined) {
  if (!port) {
    return 3002;
  }

  const parsedPort = Number(port);

  if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort >= 65536) {
    throw new Error(`Invalid PORT value: ${port}`);
  }

  return parsedPort;
}

void bootstrap();
