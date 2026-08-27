import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import * as exphbs from 'express-handlebars';
import { join } from 'path';

describe('AppController (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();

    const hbs = exphbs.create({
      extname: '.hbs',
      defaultLayout: 'main',
      helpers: {
        urlId: (id: string) => (id || '').replace(/^#/, ''),
        isOwned: (id: string, ownedIds: string[]) => Array.isArray(ownedIds) && ownedIds.includes(id),
      },
    });

    app.engine('.hbs', hbs.engine);
    app.setBaseViewsDir(join(__dirname, '..', 'views'));
    app.setViewEngine('hbs');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET) returns landing page', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200);
  });
});

