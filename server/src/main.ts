import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ALLOWED_ORIGINS } from "./cors";
import { JournalService } from "./journal/journal.service";
import { readFileSync } from "fs";
import { join } from "path";

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
  // 🔒 Boucle locale par défaut : le LAN passe obligatoirement par Caddy (HTTPS)
  const host = process.env.HOST || "127.0.0.1";
  await app.listen(port, host);
  logger.log(`🍽️ RestoFlow NestJS Server running on http://${host}:${port}`);
  // Lu dans package.json : npm_package_version est vide quand systemd ou NSSM lancent node directement
  const { version } = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8"));
  await app.get(JournalService).log("SERVER_START", null, { version });
}

bootstrap();
