import "dotenv/config";
import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

  await app.listen(port);
}

function getCorsOrigins() {
  const origins =
    process.env.CORS_ORIGIN ??
    process.env.SITE_URL ??
    "http://localhost:3000";

  return origins.split(",").map((origin) => origin.trim()).filter(Boolean);
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
