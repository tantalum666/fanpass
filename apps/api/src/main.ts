import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { json, raw, urlencoded } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { AppModule } from "./app.module";
import { FanPassSocketIoAdapter } from "./common/fanpass-socket-io.adapter";
import { PrismaService } from "./common/prisma.service";
import {
  isProductionLikeEnvironment,
  readIntegerConfig,
} from "./config/security-config";
import {
  privyCredentialRateLimitKey,
  usesDedicatedAuthRateLimit,
} from "./common/auth-rate-limit";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const productionLike = isProductionLikeEnvironment();
  const config = app.get(ConfigService);
  app
    .getHttpAdapter()
    .getInstance()
    .set(
      "trust proxy",
      productionLike
        ? readIntegerConfig(config, "FANPASS_TRUST_PROXY_HOPS", 1)
        : false,
    );
  app.getHttpAdapter().getInstance().disable("x-powered-by");
  app.use(
    "/payments/webhook",
    raw({
      type: "application/json",
      limit: "256kb",
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: false,
      hsts: productionLike
        ? {
            maxAge: 15_552_000,
            includeSubDomains: true,
            preload: false,
          }
        : false,
      frameguard: {
        action: "deny",
      },
      referrerPolicy: {
        policy: "no-referrer",
      },
    }),
  );
  app.use(json({ limit: "256kb" }));
  app.use(urlencoded({ extended: false, limit: "64kb" }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: readIntegerConfig(config, "RATE_LIMIT_GENERAL_PER_MINUTE", 600),
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (request) => request.path === "/health",
      message: {
        message: "Too many requests",
      },
    }),
  );
  app.use(
    "/auth",
    rateLimit({
      windowMs: 60_000,
      limit: readIntegerConfig(config, "RATE_LIMIT_AUTH_PER_MINUTE", 30),
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: usesDedicatedAuthRateLimit,
      message: {
        message: "Too many authentication requests",
      },
    }),
  );
  app.use(
    "/auth/privy/sync",
    rateLimit({
      windowMs: 60_000,
      limit: readIntegerConfig(
        config,
        "RATE_LIMIT_PRIVY_ORIGIN_PER_MINUTE",
        300,
      ),
      standardHeaders: false,
      legacyHeaders: false,
      message: {
        message: "Too many Privy requests from this network",
      },
    }),
    rateLimit({
      windowMs: 60_000,
      limit: readIntegerConfig(config, "RATE_LIMIT_PRIVY_PER_MINUTE", 12),
      keyGenerator: privyCredentialRateLimitKey,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        message: "Too many Privy sync requests",
      },
    }),
  );
  app.use(
    "/auth/privy/accept-staff-invite",
    rateLimit({
      windowMs: 60_000,
      limit: readIntegerConfig(config, "RATE_LIMIT_STAFF_INVITE_PER_MINUTE", 6),
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        message: "Too many staff invite requests",
      },
    }),
  );
  app.use(
    [
      "/alpha/gate-assignments",
      /^\/alpha\/gate-assignments\/[^/]+\/(deactivate|invites)$/,
    ],
    rateLimit({
      windowMs: 60_000,
      limit: readIntegerConfig(
        config,
        "RATE_LIMIT_STAFF_ASSIGNMENT_PER_MINUTE",
        30,
      ),
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        message: "Too many staff assignment requests",
      },
    }),
  );
  app.use(
    "/verification",
    rateLimit({
      windowMs: 60_000,
      limit: readIntegerConfig(config, "RATE_LIMIT_VERIFY_PER_MINUTE", 120),
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        message: "Too many verification requests",
      },
    }),
  );
  const corsOrigins = (
    config.get<string>("FANPASS_CORS_ORIGINS") ??
    "http://localhost:3000,http://localhost:4000,http://localhost:5173,http://localhost:5174,http://localhost:5175"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.useWebSocketAdapter(new FanPassSocketIoAdapter(app, corsOrigins));
  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin is not allowed"), false);
    },
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = readIntegerConfig(config, "PORT", 4000);
  await app.listen(port);
  const environmentLabel = productionLike ? "production-like" : "local";
  console.log(
    `FanPass API listening on http://localhost:${port} (${environmentLabel})`,
  );
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
