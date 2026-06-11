import "./load-local-env.js";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { getAllowedOrigins, isAllowedOrigin } from "./config/allowed-origins.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.API_PORT ?? 3001);
  const allowedOrigins = getAllowedOrigins();

  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  });

  if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
    console.warn("WORKMAP_ALLOWED_ORIGINS or WORKMAP_ALLOWED_ORIGIN is not configured; browser CORS origins will be rejected.");
  }

  await app.listen(port);
}

void bootstrap();
