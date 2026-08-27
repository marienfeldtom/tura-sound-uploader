/* eslint-disable prettier/prettier */
import { Test, TestingModule } from '@nestjs/testing';
import { LowdbService } from './lowdb.service';
import * as fs from 'fs';
import * as path from 'path';

describe('LowdbService', () => {
  let service: LowdbService;
  const testDir = path.resolve(process.cwd());
  const dbPath = path.join(testDir, 'db.json');
  const backupDir = path.join(testDir, 'backups');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LowdbService],
    }).compile();

    service = module.get<LowdbService>(LowdbService);
    await service.ensureInitialized();
  });

  it('should be defined and initialized', () => {
    expect(service).toBeDefined();
  });

  it('should guarantee collections exist', async () => {
    const users = await service.findAll('users');
    const mannschaften = await service.findAll('mannschaften');
    const spieler = await service.findAll('spieler');
    const uploadTokens = await service.findAll('uploadTokens');

    expect(Array.isArray(users)).toBe(true);
    expect(Array.isArray(mannschaften)).toBe(true);
    expect(Array.isArray(spieler)).toBe(true);
    expect(Array.isArray(uploadTokens)).toBe(true);
  });

  it('should add, find, update and delete a record safely', async () => {
    const testPlayer = {
      username: 'testplayer_' + Date.now(),
      anzeigename: 'Test Spieler',
      mannschaftId: '#TEST',
      version: 0,
      active: true,
    };

    const added = await service.add(testPlayer, 'spieler');
    expect(added.id).toBeDefined();
    expect(added.username).toBe(testPlayer.username);

    const found = await service.find({ id: added.id }, 'spieler');
    expect(found).toBeDefined();
    expect(found.anzeigename).toBe('Test Spieler');

    const updated = await service.update(
      { id: added.id },
      { anzeigename: 'Test Spieler Neuer Name' },
      'spieler',
    );
    expect(updated.anzeigename).toBe('Test Spieler Neuer Name');

    await service.increaseSpielerVersion(added.id);
    const updatedVersion = await service.find({ id: added.id }, 'spieler');
    expect(updatedVersion.version).toBe(1);

    await service.delete({ id: added.id }, 'spieler');
    const afterDelete = await service.find({ id: added.id }, 'spieler');
    expect(afterDelete).toBeUndefined();
  });

  it('should create rolling backups', async () => {
    const backupPath = await service.createBackup('test');
    expect(backupPath).toBeTruthy();
    expect(fs.existsSync(backupPath!)).toBe(true);
    expect(fs.existsSync(path.join(backupDir, 'db.backup.json'))).toBe(true);

    const content = fs.readFileSync(backupPath!, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty('spieler');
  });

  it('should handle concurrent writes without corruption', async () => {
    const promises: Promise<any>[] = [];
    const testIds: string[] = [];

    for (let i = 0; i < 5; i++) {
      promises.push(
        service.add(
          {
            username: `concur_${i}_${Date.now()}`,
            anzeigename: `Concurrent ${i}`,
            mannschaftId: '#CONCUR',
            version: 0,
            active: true,
          },
          'spieler',
        ).then(rec => {
          testIds.push(rec.id);
          return rec;
        })
      );
    }

    await Promise.all(promises);

    for (const id of testIds) {
      const found = await service.find({ id }, 'spieler');
      expect(found).toBeDefined();
      await service.delete({ id }, 'spieler');
    }
  });
});

