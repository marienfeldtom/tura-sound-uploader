/* eslint-disable prettier/prettier */
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as lowdb from 'lowdb';
import * as FileAsync from 'lowdb/adapters/FileAsync';
import * as uuid from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export type CollectionName = 'spieler' | 'users' | 'mannschaften' | 'uploadTokens';

const REQUIRED_COLLECTIONS: CollectionName[] = ['spieler', 'users', 'mannschaften', 'uploadTokens'];
const MAX_BACKUPS = 15;

@Injectable()
export class LowdbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LowdbService.name);
  private db: any;
  private dbPath = path.resolve(process.cwd(), 'db.json');
  private backupDir = path.resolve(process.cwd(), 'backups');
  private writeMutex: Promise<any> = Promise.resolve();
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Eager trigger so tests or early calls without OnModuleInit still trigger init
    this.initPromise = this.initDatabase();
  }

  async onModuleInit() {
    if (this.initPromise) {
      await this.initPromise;
    } else {
      await this.initDatabase();
    }
  }

  async onModuleDestroy() {
    // Flush any pending write operations before shutdown
    await this.writeMutex;
    this.logger.log('Datenbankverbindung ordnungsgemäß heruntergefahren.');
  }

  public async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Initializes the database with crash-recovery, corruption check, and automatic backups.
   */
  private async initDatabase(): Promise<void> {
    try {
      this.ensureDirectories();
      this.verifyAndRecoverDatabaseFile();

      const adapter = new FileAsync(this.dbPath);
      this.db = await lowdb(adapter);

      // Ensure all collections exist
      for (const col of REQUIRED_COLLECTIONS) {
        const existing = await this.db.get(col).value();
        if (!existing) {
          await this.db.set(col, []).write();
        }
      }

      // Create an immediate baseline backup on successful startup
      await this.createBackup('startup');
      this.logger.log('Datenbank erfolgreich initialisiert und Backup gesichert.');
    } catch (error) {
      this.logger.error(`Kritischer Fehler bei DB-Initialisierung: ${error.message}`, error.stack);
      throw error;
    }
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }

  /**
   * Checks db.json integrity. If missing or corrupt, attempts recovery from backups.
   */
  private verifyAndRecoverDatabaseFile(): void {
    const defaultData = {
      users: [],
      mannschaften: [],
      spieler: [],
      uploadTokens: [],
    };

    if (!fs.existsSync(this.dbPath)) {
      this.logger.warn(`db.json nicht gefunden unter ${this.dbPath}. Suche nach Backups...`);
      if (!this.restoreFromLatestBackup()) {
        const examplePath = path.resolve(process.cwd(), 'db.json.example');
        if (fs.existsSync(examplePath)) {
          fs.copyFileSync(examplePath, this.dbPath);
          this.logger.log('db.json aus db.json.example wiederhergestellt.');
        } else {
          this.writeAtomic(this.dbPath, JSON.stringify(defaultData, null, 2));
          this.logger.log('Neue leere db.json erstellt.');
        }
      }
      return;
    }

    try {
      const content = fs.readFileSync(this.dbPath, 'utf8');
      if (!content || !content.trim()) {
        throw new Error('db.json ist leer (0 Bytes).');
      }
      JSON.parse(content);
    } catch (parseError) {
      this.logger.error(
        `db.json ist beschädigt (${parseError.message})! Starte automatische Wiederherstellung...`,
      );
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const corruptPath = path.join(this.backupDir, `db.corrupt.${timestamp}.json`);
      try {
        fs.copyFileSync(this.dbPath, corruptPath);
        this.logger.warn(`Beschädigte Datei gesichert unter ${corruptPath}`);
      } catch (e) {
        this.logger.error(`Fehler beim Sichern der beschädigten Datei: ${e.message}`);
      }

      if (!this.restoreFromLatestBackup()) {
        this.logger.error('Kein gültiges Backup gefunden. Erstelle Standard-Datenbank.');
        this.writeAtomic(this.dbPath, JSON.stringify(defaultData, null, 2));
      }
    }
  }

  /**
   * Restores db.json from the newest valid backup file.
   */
  private restoreFromLatestBackup(): boolean {
    if (!fs.existsSync(this.backupDir)) return false;

    const files = fs
      .readdirSync(this.backupDir)
      .filter((f) => f.startsWith('db-backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    for (const file of files) {
      const fullPath = path.join(this.backupDir, file);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        JSON.parse(content);
        fs.copyFileSync(fullPath, this.dbPath);
        this.logger.log(`Datenbank erfolgreich aus Backup wiederhergestellt: ${file}`);
        return true;
      } catch (err) {
        this.logger.warn(`Backup ${file} ist ungültig: ${err.message}`);
      }
    }

    const latestStaticBackup = path.join(this.backupDir, 'db.backup.json');
    if (fs.existsSync(latestStaticBackup)) {
      try {
        const content = fs.readFileSync(latestStaticBackup, 'utf8');
        JSON.parse(content);
        fs.copyFileSync(latestStaticBackup, this.dbPath);
        this.logger.log(`Datenbank aus db.backup.json wiederhergestellt.`);
        return true;
      } catch (err) {
        this.logger.warn(`db.backup.json ist ungültig: ${err.message}`);
      }
    }

    return false;
  }

  /**
   * Safely creates a timestamped rolling backup and cleans up old ones.
   */
  public async createBackup(tag = 'auto'): Promise<string | null> {
    try {
      if (!fs.existsSync(this.dbPath)) return null;
      const content = fs.readFileSync(this.dbPath, 'utf8');
      if (!content || !content.trim()) return null;

      // Verify valid JSON before creating backup
      JSON.parse(content);

      this.ensureDirectories();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `db-backup-${timestamp}-${tag}.json`;
      const backupFilePath = path.join(this.backupDir, backupFilename);
      const latestBackupFilePath = path.join(this.backupDir, 'db.backup.json');

      this.writeAtomic(backupFilePath, content);
      this.writeAtomic(latestBackupFilePath, content);

      this.pruneOldBackups();
      return backupFilePath;
    } catch (err) {
      this.logger.error(`Backup-Erstellung fehlgeschlagen: ${err.message}`);
      return null;
    }
  }

  private pruneOldBackups(): void {
    try {
      if (!fs.existsSync(this.backupDir)) return;
      const files = fs
        .readdirSync(this.backupDir)
        .filter((f) => f.startsWith('db-backup-') && f.endsWith('.json'))
        .map((f) => ({
          name: f,
          path: path.join(this.backupDir, f),
          time: fs.statSync(path.join(this.backupDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > MAX_BACKUPS) {
        const toDelete = files.slice(MAX_BACKUPS);
        for (const file of toDelete) {
          try {
            fs.unlinkSync(file.path);
          } catch (e) {
            // ignore unlink errors
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Fehler beim Bereinigen alter Backups: ${err.message}`);
    }
  }

  /**
   * Atomic file writing using temporary file + rename to prevent data corruption.
   */
  private writeAtomic(filePath: string, data: string): void {
    const dir = path.dirname(filePath);
    const tempPath = path.join(dir, `.${path.basename(filePath)}.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 6)}`);
    fs.writeFileSync(tempPath, data, 'utf8');
    fs.renameSync(tempPath, filePath);
  }

  /**
   * Executes a write operation within a sequential lock to prevent concurrent write collisions.
   */
  private async executeWrite<T>(op: () => Promise<T>): Promise<T> {
    await this.ensureInitialized();
    const currentLock = this.writeMutex;
    let release: () => void;
    this.writeMutex = new Promise<void>((resolve) => {
      release = resolve;
    });

    try {
      await currentLock;
      const result = await op();
      // Asynchronously trigger backup creation without blocking current request
      this.createBackup('write').catch((err) =>
        this.logger.warn(`Hintergrund-Backup nach Schreibvorgang fehlgeschlagen: ${err.message}`),
      );
      return result;
    } finally {
      release!();
    }
  }

  async findAll(collectionName: CollectionName): Promise<any[]> {
    await this.ensureInitialized();
    return await this.db.get(collectionName).value();
  }

  async findAllSorted(collectionName: CollectionName, sortKey: string): Promise<any[]> {
    await this.ensureInitialized();
    return await this.db.get(collectionName).sortBy(sortKey).value();
  }

  async find(condition: object, collectionName: CollectionName): Promise<any> {
    await this.ensureInitialized();
    return await this.db.get(collectionName).find(condition).value();
  }

  async findWhere(condition: object, collectionName: CollectionName): Promise<any[]> {
    await this.ensureInitialized();
    return await this.db.get(collectionName).filter(condition).value();
  }

  async add(record: any, collectionName: CollectionName): Promise<any> {
    return this.executeWrite(async () => {
      if (!record.id) {
        record.id = uuid.v1();
      }
      const list = (await this.db.get(collectionName).value()) || [];
      const updatedList = [...list, record];
      await this.db.set(collectionName, updatedList).write();
      return record;
    });
  }

  async update(condition: object, updates: object, collectionName: CollectionName): Promise<any> {
    return this.executeWrite(async () => {
      await this.db.get(collectionName).find(condition).assign(updates).write();
      return await this.db.get(collectionName).find(condition).value();
    });
  }

  async delete(condition: object, collectionName: CollectionName): Promise<void> {
    return this.executeWrite(async () => {
      await this.db.get(collectionName).remove(condition).write();
    });
  }

  async increaseSpielerVersion(id: string): Promise<void> {
    return this.executeWrite(async () => {
      const spieler = await this.db.get('spieler').find({ id }).value();
      if (spieler) {
        const newVersion = (spieler.version || 0) + 1;
        await this.db.get('spieler').find({ id }).assign({ version: newVersion }).write();
      }
    });
  }
}
