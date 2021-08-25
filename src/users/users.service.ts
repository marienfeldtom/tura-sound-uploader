// src/users/users.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  private readonly users: any[];

  constructor() {
    this.users = [
      {
        userId: 1,
        username: 'herren',
        password: 'handball',
        canEditHerren: true,
        canEditDamen: false,
      },
      {
        userId: 2,
        username: 'damen',
        password: '123',
        canEditHerren: false,
        canEditDamen: true,
      },
      {
        userId: 3,
        username: 'all',
        password: '123',
        canEditHerren: true,
        canEditDamen: true,
      },
    ];
  }

  async findOne(username: string): Promise<any> {
    return this.users.find((user) => user.username === username);
  }
}
