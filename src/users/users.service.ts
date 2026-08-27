// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { LowdbService } from '../lowdb/lowdb.service';
import * as crypto from 'crypto';
import * as uuid from 'uuid';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const newHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === newHash;
}

@Injectable()
export class UsersService {
  constructor(private readonly lowdbService: LowdbService) {}

  async findByEmail(email: string): Promise<any> {
    return await this.lowdbService.find({ email: email.toLowerCase() }, 'users');
  }

  async findById(id: string): Promise<any> {
    return await this.lowdbService.find({ id }, 'users');
  }

  async create(email: string, password: string, firstMannschaftId: string): Promise<any> {
    const passwordHash = hashPassword(password);
    const user = {
      id: uuid.v1(),
      email: email.toLowerCase(),
      passwordHash,
      createdAt: new Date().toISOString(),
      ownedMannschaftIds: [firstMannschaftId],
      linkedMannschaftIds: [],
    };
    return await this.lowdbService.add(user, 'users');
  }

  async addOwnedMannschaft(userId: string, mannschaftId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;
    const ownedIds = [...(user.ownedMannschaftIds || []), mannschaftId];
    await this.lowdbService.update({ id: userId }, { ownedMannschaftIds: ownedIds }, 'users');
  }

  async addLinkedMannschaft(userId: string, mannschaftId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;
    const linkedIds = [...(user.linkedMannschaftIds || []), mannschaftId];
    await this.lowdbService.update({ id: userId }, { linkedMannschaftIds: linkedIds }, 'users');
  }

  async removeLinkedMannschaft(userId: string, mannschaftId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;
    const linkedIds = (user.linkedMannschaftIds || []).filter((id: string) => id !== mannschaftId);
    await this.lowdbService.update({ id: userId }, { linkedMannschaftIds: linkedIds }, 'users');
  }

  async validatePassword(user: any, password: string): Promise<boolean> {
    // Support both old bcrypt-style (from migration) and new PBKDF2
    if (user.passwordHash && user.passwordHash.startsWith('$2')) {
      // Legacy bcrypt hash from migration – reject, needs re-register
      return false;
    }
    return verifyPassword(password, user.passwordHash);
  }
}
