import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

const DEFAULT_PORT = 3002;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = getPort(process.env.PORT);

  await app.listen(port);
}

function getPort(port: string | undefined) {
  if (!port) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number(port);

  if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort >= 65536) {
    throw new Error(`Invalid PORT value: ${port}`);
  }

  return parsedPort;
}

void bootstrap();
