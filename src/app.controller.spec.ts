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
});

