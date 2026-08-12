import "./load-local-env.js";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import {
  CORS_PREFLIGHT_MAX_AGE_SECONDS,
  getAllowedOrigins,
  isAllowedOrigin,
} from "./config/allowed-origins.js";
import { PrismaService } from "./modules/prisma/prisma.service.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.API_PORT ?? 3001);
  const allowedOrigins = getAllowedOrigins();

  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
  });

  if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
    console.warn("WORKMAP_ALLOWED_ORIGINS or WORKMAP_ALLOWED_ORIGIN is not configured; browser CORS origins will be rejected.");
  }

  await app.listen(port);
  void app.get(PrismaService).connectAfterStartup();
}

void bootstrap();
