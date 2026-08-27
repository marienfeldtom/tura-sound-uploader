import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LowdbService } from './lowdb/lowdb.service';
import { UsersService } from './users/users.service';
import { MannschaftenService } from './mannschaften/mannschaften.service';
import { AuthService } from './auth/auth.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: AppService, useValue: {} },
        { provide: LowdbService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: MannschaftenService, useValue: {} },
        { provide: AuthService, useValue: {} },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });

  describe('addSpieler', () => {
    it('should generate sanitized username from anzeigename and save spieler', async () => {
      const addedRecords: any[] = [];
      const lowdbMock = {
        findAll: jest.fn().mockResolvedValue([
          { username: 'tomm' }
        ]),
        add: jest.fn().mockImplementation((record) => {
          addedRecords.push(record);
          return record;
        }),
      };
      const usersMock = {
        findById: jest.fn().mockResolvedValue({
          id: 'user1',
          ownedMannschaftIds: ['#H4R'],
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          { provide: AppService, useValue: {} },
          { provide: LowdbService, useValue: lowdbMock },
          { provide: UsersService, useValue: usersMock },
          { provide: MannschaftenService, useValue: {} },
          { provide: AuthService, useValue: {} },
        ],
      }).compile();

      const controller = module.get<AppController>(AppController);
      const req = {
        user: { id: 'user1' },
        body: { anzeigename: 'Jöran Müller', mannschaftId: 'H4R' },
        flash: jest.fn(),
      };
      const res = {
        redirect: jest.fn(),
      };

      await controller.addSpieler(req as any, res as any);

      expect(lowdbMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'joeranmueller',
          anzeigename: 'Jöran Müller',
          mannschaftId: '#H4R',
          version: 0,
          active: true,
        }),
        'spieler',
      );
      expect(req.flash).toHaveBeenCalledWith('message', 'Jöran Müller wurde hinzugefügt!');
      expect(res.redirect).toHaveBeenCalledWith('/mannschaft/H4R');
    });

    it('should handle duplicate usernames by adding a numeric suffix', async () => {
      const lowdbMock = {
        findAll: jest.fn().mockResolvedValue([
          { username: 'tom' },
          { username: 'tom2' }
        ]),
        add: jest.fn().mockResolvedValue({}),
      };
      const usersMock = {
        findById: jest.fn().mockResolvedValue({
          id: 'user1',
          ownedMannschaftIds: ['#H4R'],
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          { provide: AppService, useValue: {} },
          { provide: LowdbService, useValue: lowdbMock },
          { provide: UsersService, useValue: usersMock },
          { provide: MannschaftenService, useValue: {} },
          { provide: AuthService, useValue: {} },
        ],
      }).compile();

      const controller = module.get<AppController>(AppController);
      const req = {
        user: { id: 'user1' },
        body: { anzeigename: 'Tom', mannschaftId: '#H4R' },
        flash: jest.fn(),
      };
      const res = {
        redirect: jest.fn(),
      };

      await controller.addSpieler(req as any, res as any);

      expect(lowdbMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'tom3',
          anzeigename: 'Tom',
        }),
        'spieler',
      );
    });
  });

  describe('editSpieler', () => {
    it('should update the spieler anzeigename and redirect', async () => {
      const lowdbMock = {
        find: jest.fn().mockResolvedValue({
          id: 'sp123',
          username: 'tomm',
          anzeigename: 'Tom',
          mannschaftId: '#H4R',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'sp123',
          username: 'tomm',
          anzeigename: 'Thomas M.',
          mannschaftId: '#H4R',
        }),
      };
      const usersMock = {
        findById: jest.fn().mockResolvedValue({
          id: 'user1',
          ownedMannschaftIds: ['#H4R'],
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          { provide: AppService, useValue: {} },
          { provide: LowdbService, useValue: lowdbMock },
          { provide: UsersService, useValue: usersMock },
          { provide: MannschaftenService, useValue: {} },
          { provide: AuthService, useValue: {} },
        ],
      }).compile();

      const controller = module.get<AppController>(AppController);
      const req = {
        user: { id: 'user1' },
        flash: jest.fn(),
      };
      const res = {
        redirect: jest.fn(),
      };

      await controller.editSpieler(
        { id: 'sp123' },
        { anzeigename: 'Thomas M.' },
        req as any,
        res as any,
      );

      expect(lowdbMock.update).toHaveBeenCalledWith(
        { id: 'sp123' },
        { anzeigename: 'Thomas M.' },
        'spieler',
      );
      expect(req.flash).toHaveBeenCalledWith('message', 'Spielername zu "Thomas M." geändert.');
      expect(res.redirect).toHaveBeenCalledWith('/mannschaft/H4R');
    });

    it('should reject edit if user does not own team', async () => {
      const lowdbMock = {
        find: jest.fn().mockResolvedValue({
          id: 'sp123',
          mannschaftId: '#OTHER',
        }),
        update: jest.fn(),
      };
      const usersMock = {
        findById: jest.fn().mockResolvedValue({
          id: 'user1',
          ownedMannschaftIds: ['#H4R'],
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          { provide: AppService, useValue: {} },
          { provide: LowdbService, useValue: lowdbMock },
          { provide: UsersService, useValue: usersMock },
          { provide: MannschaftenService, useValue: {} },
          { provide: AuthService, useValue: {} },
        ],
      }).compile();

      const controller = module.get<AppController>(AppController);
      const req = {
        user: { id: 'user1' },
        flash: jest.fn(),
      };
      const res = {
        redirect: jest.fn(),
      };

      await controller.editSpieler(
        { id: 'sp123' },
        { anzeigename: 'Hacker Name' },
        req as any,
        res as any,
      );

      expect(lowdbMock.update).not.toHaveBeenCalled();
      expect(req.flash).toHaveBeenCalledWith('error', 'Kein Zugriff.');
      expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('dashboard', () => {
    it('should render dashboard with owned mannschaften', async () => {
      const usersMock = {
        findById: jest.fn().mockResolvedValue({
          id: 'user1',
          ownedMannschaftIds: ['#H4R'],
        }),
      };
      const mannschaftenMock = {
        findManyByIds: jest.fn().mockResolvedValue([{ id: '#H4R', name: 'Herren' }]),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          { provide: AppService, useValue: {} },
          { provide: LowdbService, useValue: {} },
          { provide: UsersService, useValue: usersMock },
          { provide: MannschaftenService, useValue: mannschaftenMock },
          { provide: AuthService, useValue: {} },
        ],
      }).compile();

      const controller = module.get<AppController>(AppController);
      const req = {
        user: { id: 'user1' },
        flash: jest.fn().mockReturnValue([]),
      };
      const res = {
        render: jest.fn(),
        redirect: jest.fn(),
      };

      await controller.dashboard(req as any, res as any);

      expect(usersMock.findById).toHaveBeenCalledWith('user1');
      expect(mannschaftenMock.findManyByIds).toHaveBeenCalledWith(['#H4R']);
      expect(res.render).toHaveBeenCalledWith(
        'dashboard',
        expect.objectContaining({
          user: expect.objectContaining({ id: 'user1' }),
          mannschaften: [{ id: '#H4R', name: 'Herren' }],
        }),
      );
    });

    it('should logout and redirect to / if user not found in database', async () => {
      const usersMock = {
        findById: jest.fn().mockResolvedValue(null),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          { provide: AppService, useValue: {} },
          { provide: LowdbService, useValue: {} },
          { provide: UsersService, useValue: usersMock },
          { provide: MannschaftenService, useValue: {} },
          { provide: AuthService, useValue: {} },
        ],
      }).compile();

      const controller = module.get<AppController>(AppController);
      const req = {
        user: { id: 'deleted_user' },
        logout: jest.fn(),
        flash: jest.fn(),
      };
      const res = {
        render: jest.fn(),
        redirect: jest.fn(),
      };

      await controller.dashboard(req as any, res as any);

      expect(req.logout).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/');
    });

    it('should parse and pass welcomeInfo to dashboard view if flash is present', async () => {
      const usersMock = {
        findById: jest.fn().mockResolvedValue({
          id: 'user1',
          ownedMannschaftIds: ['#H4R'],
        }),
      };
      const mannschaftenMock = {
        findManyByIds: jest.fn().mockResolvedValue([{ id: '#H4R', name: 'Herren' }]),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          { provide: AppService, useValue: {} },
          { provide: LowdbService, useValue: {} },
          { provide: UsersService, useValue: usersMock },
          { provide: MannschaftenService, useValue: mannschaftenMock },
          { provide: AuthService, useValue: {} },
        ],
      }).compile();

      const controller = module.get<AppController>(AppController);
      const welcomeData = { mannschaftId: '#H4R', mannschaftName: 'Herren', urlId: 'H4R' };
      const req = {
        user: { id: 'user1' },
        flash: jest.fn().mockImplementation((key) => {
          if (key === 'welcomeInfo') return [JSON.stringify(welcomeData)];
          return [];
        }),
      };
      const res = {
        render: jest.fn(),
        redirect: jest.fn(),
      };

      await controller.dashboard(req as any, res as any);

      expect(res.render).toHaveBeenCalledWith(
        'dashboard',
        expect.objectContaining({
          welcomeInfo: welcomeData,
          mannschaften: [{ id: '#H4R', name: 'Herren' }],
        }),
      );
    });
  });

  describe('register', () => {
    it('should reject registration if fields are missing', async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          { provide: AppService, useValue: {} },
          { provide: LowdbService, useValue: {} },
          { provide: UsersService, useValue: {} },
          { provide: MannschaftenService, useValue: {} },
          { provide: AuthService, useValue: {} },
        ],
      }).compile();

      const controller = module.get<AppController>(AppController);
      const req = { flash: jest.fn() };
      const res = { redirect: jest.fn() };

      await controller.register({ email: '', password: '', mannschaftName: '' }, req as any, res as any);

      expect(req.flash).toHaveBeenCalledWith('loginError', 'Bitte alle Felder ausfüllen.');
      expect(res.redirect).toHaveBeenCalledWith('/');
    });

    it('should reject registration if email is already taken', async () => {
      const usersMock = {
        findByEmail: jest.fn().mockResolvedValue({ id: 'existing' }),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          { provide: AppService, useValue: {} },
          { provide: LowdbService, useValue: {} },
          { provide: UsersService, useValue: usersMock },
          { provide: MannschaftenService, useValue: {} },
          { provide: AuthService, useValue: {} },
        ],
      }).compile();

      const controller = module.get<AppController>(AppController);
      const req = { flash: jest.fn() };
      const res = { redirect: jest.fn() };

      await controller.register(
        { email: 'taken@test.de', password: 'password123', mannschaftName: 'Team 1' },
        req as any,
        res as any,
      );

      expect(req.flash).toHaveBeenCalledWith('loginError', 'Diese E-Mail ist bereits registriert.');
      expect(res.redirect).toHaveBeenCalledWith('/');
    });

    it('should register user, log in, set welcomeInfo flash, and redirect to /dashboard', async () => {
      const usersMock = {
        findByEmail: jest.fn().mockResolvedValue(null),
      };
      const createdUser = { id: 'u1', email: 'neu@test.de', ownedMannschaftIds: ['#H4R'] };
      const createdTeam = { id: '#H4R', name: 'Herren 1' };
      const authMock = {
        register: jest.fn().mockResolvedValue({ user: createdUser, mannschaft: createdTeam }),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          { provide: AppService, useValue: {} },
          { provide: LowdbService, useValue: {} },
          { provide: UsersService, useValue: usersMock },
          { provide: MannschaftenService, useValue: {} },
          { provide: AuthService, useValue: authMock },
        ],
      }).compile();

      const controller = module.get<AppController>(AppController);
      const req = {
        flash: jest.fn(),
        logIn: jest.fn().mockImplementation((user, cb) => cb(null)),
      };
      const res = { redirect: jest.fn() };

      await controller.register(
        { email: 'neu@test.de', password: 'password123', mannschaftName: 'Herren 1' },
        req as any,
        res as any,
      );

      expect(authMock.register).toHaveBeenCalledWith('neu@test.de', 'password123', 'Herren 1');
      expect(req.logIn).toHaveBeenCalledWith(createdUser, expect.any(Function));
      expect(req.flash).toHaveBeenCalledWith(
        'welcomeInfo',
        JSON.stringify({
          mannschaftId: '#H4R',
          mannschaftName: 'Herren 1',
          urlId: 'H4R',
        }),
      );
      expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });
  });
});

