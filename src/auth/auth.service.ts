// src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { MannschaftenService } from '../mannschaften/mannschaften.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly mannschaftenService: MannschaftenService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const valid = await this.usersService.validatePassword(user, password);
    if (!valid) return null;
    // Don't leak passwordHash to session
    const { passwordHash, ...result } = user;
    return result;
  }

  async register(email: string, password: string, mannschaftName: string): Promise<{ user: any; mannschaft: any }> {
    // Create mannschaft first to get the ID
    const tempUserId = 'temp';
    const mannschaft = await this.mannschaftenService.create(mannschaftName, tempUserId);
    // Create user with the mannschaft ID
    const user = await this.usersService.create(email, password, mannschaft.id);
    // Update mannschaft ownerId to the real user id
    await this.mannschaftenService.updateOwner(mannschaft.id, user.id);
    mannschaft.ownerId = user.id;
    const { passwordHash, ...cleanUser } = user;
    return { user: cleanUser, mannschaft };
  }
}
