/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as lowdb from 'lowdb';
import * as FileAsync from 'lowdb/adapters/FileAsync';
import * as uuid from 'uuid';

type CollctionName = 'spieler';

@Injectable()
export class LowdbService {
    private db: any; //Set correct type

  constructor() {
    this.initDatabase('spieler');
  }

  private async initDatabase(collctionName: CollctionName) {
    const adapter = new FileAsync('db.json');
    this.db = await lowdb(adapter);
    const listUsers = await this.db.get(collctionName).value();
    if (!listUsers) {
      await this.db.set(collctionName, []).write();
    }
  }

  async findAll(collctionName: CollctionName): Promise<any> {
    const listUsers = await this.db.get(collctionName).sortBy('anzeigename').value();
    return listUsers;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  async find(condition: object, collctionName: CollctionName): Promise<any> {
    const values = await this.db.get(collctionName).find(condition).value();
    return values;
  }

   // eslint-disable-next-line @typescript-eslint/ban-types
   async delete(condition: object, collctionName: CollctionName): Promise<any> {
    await this.db.get(collctionName).remove(condition).write();
  }

  async increase(id): Promise<any> {
    const spieler = await this.db.get('spieler').find({ id: id }).value();
    const newVersion = spieler.version + 1;
    await this.db.get('spieler').find({ id: id })
            .assign({version: newVersion})
            .write();
  }

  async add(record: any, collctionName: CollctionName): Promise<any> {
    const listData = await this.db.get(collctionName).value();
    record.id = uuid.v1();
    listData.push(record);
    await this.db.set(collctionName, listData).write();
    return record;
  }
}
