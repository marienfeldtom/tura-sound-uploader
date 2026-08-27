import { NestFactory } from '@nestjs/core';
import { MulterModule, NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import * as session from 'express-session';
import flash = require('connect-flash');
import * as exphbs from 'express-handlebars';
import * as passport from 'passport';
import * as fs from 'fs';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Ensure critical directories exist
  const uploadsDir = join(__dirname, '..', 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const backupsDir = join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Enable graceful shutdown hooks (SIGTERM, SIGINT)
  app.enableShutdownHooks();

  // Handlebars with custom helpers
  const hbs = exphbs.create({
    extname: '.hbs',
    defaultLayout: 'main',
    helpers: {
      // strips # for use in URLs: #H4R → H4R
      urlId: (id: string) => (id || '').replace(/^#/, ''),
      // checks if id is in the ownedIds array
      isOwned: (id: string, ownedIds: string[]) => {
        return Array.isArray(ownedIds) && ownedIds.includes(id);
      },
    },
  });

  app.engine('.hbs', hbs.engine);
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'tura-handball-secret-change-in-prod',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 Tage
        sameSite: 'lax',
      },
    }),
  );

  MulterModule.register({
    dest: './public/uploads',
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });

  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());

  // Global process crash prevention & logging
  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled Promise Rejection:', reason?.stack || reason);
  });
  process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught Exception:', err?.stack || err);
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`7secs läuft auf http://localhost:${port}`);
}
bootstrap();

