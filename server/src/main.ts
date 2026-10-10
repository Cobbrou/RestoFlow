import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ALLOWED_ORIGINS } from "./cors";
import { JournalService } from "./journal/journal.service";

async function bootstrap() {
  const logger = new Logger("RestoFlowServer");
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    })
  );

  // 🔒 Liste blanche d'origines (le front passe par le proxy Vite, donc même origine par défaut)
  app.enableCors({
    origin: ALLOWED_ORIGINS,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🍽️ RestoFlow NestJS Server running on http://localhost:${port}`);
  await app.get(JournalService).log("SERVER_START", null, { version: process.env.npm_package_version || null });
}

bootstrap();
