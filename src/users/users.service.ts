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
        password: '123',
      },
      {
        userId: 2,
        username: 'damen',
        password: '123',
      },
      {
        userId: 3,
        username: 'all',
        password: '123',
      },
    ];
  }

  async findOne(username: string): Promise<any> {
    return this.users.find((user) => user.username === username);
  }
}
