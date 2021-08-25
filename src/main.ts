import { NestFactory } from '@nestjs/core';
import { MulterModule, NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

import * as session from 'express-session';
import flash = require('connect-flash');
import * as exphbs from 'express-handlebars';
import * as passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.engine('.hbs', exphbs({ extname: '.hbs', defaultLayout: 'main' }));
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');

  app.use(
    session({
      secret: 'nest cats',
      resave: false,
      saveUninitialized: false,
    }),
  );

  MulterModule.register({
    dest: './public/uploads',
    limits: {
      fileSize: 10 * 1024 * 1024, // f.e. 50MB
    },
  });

  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());

  await app.listen(3000);
}
bootstrap();
