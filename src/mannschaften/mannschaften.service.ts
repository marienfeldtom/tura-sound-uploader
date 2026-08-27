// src/mannschaften/mannschaften.service.ts
import { Injectable } from '@nestjs/common';
import { LowdbService } from '../lowdb/lowdb.service';

@Injectable()
export class MannschaftenService {
  constructor(private readonly lowdbService: LowdbService) {}

  /** Generate a unique random 3-char alphanumeric ID like #A4F */
  private async generateUniqueId(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let id: string;
    let attempts = 0;
    do {
      id =
        '#' +
        Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      attempts++;
      if (attempts > 100) throw new Error('Could not generate unique Mannschaft ID');
    } while (await this.findById(id));
    return id;
  }

  async create(name: string, ownerId: string): Promise<any> {
    const id = await this.generateUniqueId();
    const mannschaft = {
      id,
      name,
      ownerId,
      createdAt: new Date().toISOString(),
    };
    return await this.lowdbService.add(mannschaft, 'mannschaften');
  }

  async findById(id: string): Promise<any> {
    return await this.lowdbService.find({ id }, 'mannschaften');
  }

  async findByOwner(ownerId: string): Promise<any[]> {
    return await this.lowdbService.findWhere({ ownerId }, 'mannschaften');
  }

  async findManyByIds(ids: string[]): Promise<any[]> {
    const all = await this.lowdbService.findAll('mannschaften');
    return all.filter((m: any) => ids.includes(m.id));
  }

  async updateOwner(id: string, ownerId: string): Promise<any> {
    return await this.lowdbService.update({ id }, { ownerId }, 'mannschaften');
  }

  async findAll(): Promise<any[]> {
    return await this.lowdbService.findAll('mannschaften');
  }
}
