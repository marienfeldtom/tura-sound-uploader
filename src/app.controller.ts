import {
  Get,
  Controller,
  Render,
  Post,
  Req,
  Res,
  UseGuards,
  UseFilters,
  Param,
  UploadedFile,
  UseInterceptors,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import { LowdbService } from './lowdb/lowdb.service';
import { UsersService } from './users/users.service';
import { MannschaftenService } from './mannschaften/mannschaften.service';
import { AuthService } from './auth/auth.service';
import { LoginGuard } from './common/guards/login.guard';
import { AuthenticatedGuard } from './common/guards/authenticated.guard';
import { AuthExceptionFilter } from './common/filters/auth-exceptions.filter';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as uuid from 'uuid';
import * as crypto from 'crypto';

// Route helper: URLs use IDs without '#' (e.g. H4R), DB stores with '#' (e.g. #H4R)
function toDbId(urlParam: string): string {
  return urlParam.startsWith('#') ? urlParam : '#' + urlParam;
}

@Controller()
@UseFilters(AuthExceptionFilter)
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly lowdbService: LowdbService,
    private readonly usersService: UsersService,
    private readonly mannschaftenService: MannschaftenService,
    private readonly authService: AuthService,
  ) {}

  // ─── Public: Landing / Auth ──────────────────────────────────────────────────

  @Get('/')
  @Render('landing')
  index(@Req() req): object {
    return {
      error: req.flash('loginError'),
      success: req.flash('success'),
      layout: false,
    };
  }

  @UseGuards(LoginGuard)
  @Post('/auth/login')
  login(@Res() res: Response) {
    res.redirect('/dashboard');
  }

  @Post('/auth/register')
  async register(@Body() body, @Req() req, @Res() res: Response) {
    const { email, password, mannschaftName } = body;
    if (!email || !password || !mannschaftName) {
      req.flash('loginError', 'Bitte alle Felder ausfüllen.');
      return res.redirect('/');
    }
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      req.flash('loginError', 'Diese E-Mail ist bereits registriert.');
      return res.redirect('/');
    }
    const { mannschaft } = await this.authService.register(email, password, mannschaftName);
    // Show only the 3-char part in the success message (without #)
    req.flash('success', mannschaft.id.replace(/^#/, ''));
    res.redirect('/');
  }

  @Get('/logout')
  logout(@Req() req, @Res() res: Response) {
    req.logout();
    res.redirect('/');
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────────

  @UseGuards(AuthenticatedGuard)
  @Get('/dashboard')
  @Render('dashboard')
  async dashboard(@Req() req) {
    const user = await this.usersService.findById(req.user.id);
    const ownedIds = user.ownedMannschaftIds || [];
    const mannschaften = await this.mannschaftenService.findManyByIds(ownedIds);
    return {
      user,
      message: req.flash('message'),
      error: req.flash('error'),
      mannschaften,
    };
  }

  @UseGuards(AuthenticatedGuard)
  @Post('/mannschaft/new')
  async newMannschaft(@Req() req, @Res() res: Response) {
    const { name } = req.body;
    if (!name) {
      req.flash('error', 'Bitte einen Mannschaftsnamen eingeben.');
      return res.redirect('/dashboard');
    }
    const mannschaft = await this.mannschaftenService.create(name, req.user.id);
    await this.usersService.addOwnedMannschaft(req.user.id, mannschaft.id);
    req.flash('message', `Mannschaft "${name}" erstellt! Deine ID: ${mannschaft.id}`);
    res.redirect('/dashboard');
  }

  // ─── Spieler Verwaltung ───────────────────────────────────────────────────────

  // Route param uses URL-safe ID without '#': /mannschaft/H4R
  @UseGuards(AuthenticatedGuard)
  @Get('/mannschaft/:id')
  @Render('spieler')
  async spielerList(@Param() params, @Req() req) {
    const mannschaftId = toDbId(params.id); // H4R → #H4R
    const user = await this.usersService.findById(req.user.id);
    const ownedIds = user.ownedMannschaftIds || [];

    if (!ownedIds.includes(mannschaftId)) {
      throw new NotFoundException('Mannschaft nicht gefunden oder kein Zugriff.');
    }

    const mannschaft = await this.mannschaftenService.findById(mannschaftId);
    if (!mannschaft) throw new NotFoundException('Mannschaft nicht gefunden.');

    const spieler = (await this.lowdbService.findAll('spieler'))
      .filter((s: any) => s.mannschaftId === mannschaftId)
      .sort((a: any, b: any) => a.anzeigename.localeCompare(b.anzeigename));

    const totalCount = spieler.length;
    const activeCount = spieler.filter((s: any) => s.active).length;
    const inactiveCount = spieler.filter((s: any) => !s.active).length;
    const readyCount = spieler.filter((s: any) => s.active && s.version > 0).length;

    const uploadLinkFlash = req.flash('uploadLink');
    let uploadLink: { spielerName: string; url: string } | null = null;
    if (uploadLinkFlash && uploadLinkFlash.length > 0) {
      try {
        uploadLink = JSON.parse(uploadLinkFlash[0]);
      } catch (e) {
        uploadLink = null;
      }
    }

    return {
      user,
      mannschaft,
      spieler,
      totalCount,
      activeCount,
      inactiveCount,
      readyCount,
      isOwner: true, // only owners can reach this page
      message: req.flash('message'),
      uploadLink,
      error: req.flash('error'),
    };
  }

  @UseGuards(AuthenticatedGuard)
  @Post('/spieler')
  async addSpieler(@Req() req, @Res() res: Response) {
    const { anzeigename, mannschaftId } = req.body;
    const dbId = toDbId(mannschaftId);
    const user = await this.usersService.findById(req.user.id);
    if (!(user.ownedMannschaftIds || []).includes(dbId)) {
      req.flash('error', 'Kein Zugriff auf diese Mannschaft.');
      return res.redirect('/dashboard');
    }
    if (!anzeigename || !anzeigename.trim()) {
      req.flash('error', 'Bitte einen Namen eingeben.');
      return res.redirect(`/mannschaft/${mannschaftId.replace(/^#/, '')}`);
    }

    const trimmedName = anzeigename.trim();
    const username = await this.generateUniqueUsername(trimmedName);

    await this.lowdbService.add(
      { username, anzeigename: trimmedName, mannschaftId: dbId, version: 0, active: true },
      'spieler',
    );
    req.flash('message', `${trimmedName} wurde hinzugefügt!`);
    res.redirect(`/mannschaft/${mannschaftId.replace(/^#/, '')}`);
  }

  private async generateUniqueUsername(anzeigename: string): Promise<string> {
    let slug = anzeigename
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    if (!slug) {
      slug = 'spieler';
    }

    const allSpieler = await this.lowdbService.findAll('spieler');
    const existingUsernames = new Set(
      (allSpieler || []).map((s: any) => (s.username || '').toLowerCase()),
    );

    let candidate = slug;
    let counter = 2;
    while (existingUsernames.has(candidate)) {
      candidate = `${slug}${counter}`;
      counter++;
    }
    return candidate;
  }

  @UseGuards(AuthenticatedGuard)
  @Get('/spieler/delete/:id')
  async deleteSpieler(@Param() params, @Req() req, @Res() res: Response) {
    const spieler = await this.lowdbService.find({ id: params.id }, 'spieler');
    if (!spieler) {
      req.flash('error', 'Spieler nicht gefunden.');
      return res.redirect('/dashboard');
    }
    const user = await this.usersService.findById(req.user.id);
    if (!(user.ownedMannschaftIds || []).includes(spieler.mannschaftId)) {
      req.flash('error', 'Kein Zugriff.');
      return res.redirect('/dashboard');
    }
    const mp3path = `./public/uploads/${spieler.username}.mp3`;
    await this.lowdbService.delete({ id: params.id }, 'spieler');
    if (fs.existsSync(mp3path)) fs.unlinkSync(mp3path);
    req.flash('message', `${spieler.anzeigename} wurde gelöscht.`);
    res.redirect(`/mannschaft/${spieler.mannschaftId.replace(/^#/, '')}`);
  }

  @UseGuards(AuthenticatedGuard)
  @Post('/spieler/edit/:id')
  async editSpieler(
    @Param() params,
    @Body() body,
    @Req() req,
    @Res() res: Response,
  ) {
    const { id } = params;
    const { anzeigename } = body;
    const spieler = await this.lowdbService.find({ id }, 'spieler');
    if (!spieler) {
      req.flash('error', 'Spieler nicht gefunden.');
      return res.redirect('/dashboard');
    }
    const user = await this.usersService.findById(req.user.id);
    if (!(user.ownedMannschaftIds || []).includes(spieler.mannschaftId)) {
      req.flash('error', 'Kein Zugriff.');
      return res.redirect('/dashboard');
    }
    if (!anzeigename || !anzeigename.trim()) {
      req.flash('error', 'Bitte einen gültigen Namen eingeben.');
      return res.redirect(`/mannschaft/${spieler.mannschaftId.replace(/^#/, '')}`);
    }

    const trimmedName = anzeigename.trim();
    await this.lowdbService.update({ id }, { anzeigename: trimmedName }, 'spieler');
    req.flash('message', `Spielername zu "${trimmedName}" geändert.`);
    res.redirect(`/mannschaft/${spieler.mannschaftId.replace(/^#/, '')}`);
  }

  @UseGuards(AuthenticatedGuard)
  @Get('/spieler/switch/:id')
  async switchSpieler(@Param() params, @Req() req, @Res() res: Response) {
    const spieler = await this.lowdbService.find({ id: params.id }, 'spieler');
    if (!spieler) return res.redirect('/dashboard');
    const user = await this.usersService.findById(req.user.id);
    if (!(user.ownedMannschaftIds || []).includes(spieler.mannschaftId)) {
      req.flash('error', 'Kein Zugriff.');
      return res.redirect('/dashboard');
    }
    await this.lowdbService.update({ id: params.id }, { active: !spieler.active }, 'spieler');
    res.redirect(`/mannschaft/${spieler.mannschaftId.replace(/^#/, '')}`);
  }

  // ─── Sound Upload (Admin) ─────────────────────────────────────────────────────

  @UseGuards(AuthenticatedGuard)
  @Post('/upload')
  @UseInterceptors(FileInterceptor('file', { dest: './public/uploads' }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body,
    @Req() req,
    @Res() res: Response,
  ) {
    const spieler = await this.lowdbService.find({ id: body.id }, 'spieler');
    if (!spieler) {
      req.flash('error', 'Spieler nicht gefunden.');
      return res.redirect('/dashboard');
    }
    const user = await this.usersService.findById(req.user.id);
    if (!(user.ownedMannschaftIds || []).includes(spieler.mannschaftId)) {
      req.flash('error', 'Kein Zugriff.');
      return res.redirect('/dashboard');
    }
    fs.renameSync(
      `${file.destination}/${file.filename}`,
      `${file.destination}/${spieler.username}.mp3`,
    );
    await this.lowdbService.increaseSpielerVersion(body.id);
    req.flash('message', `Sound für ${spieler.anzeigename} hochgeladen!`);
    res.redirect(`/mannschaft/${spieler.mannschaftId.replace(/^#/, '')}`);
  }

  // ─── Upload Token (Shareable Link) ───────────────────────────────────────────

  @UseGuards(AuthenticatedGuard)
  @Post('/upload-token')
  async createUploadToken(@Body() body, @Req() req, @Res() res: Response) {
    const spieler = await this.lowdbService.find({ id: body.spielerId }, 'spieler');
    if (!spieler) {
      req.flash('error', 'Spieler nicht gefunden.');
      return res.redirect('/dashboard');
    }
    const user = await this.usersService.findById(req.user.id);
    if (!(user.ownedMannschaftIds || []).includes(spieler.mannschaftId)) {
      req.flash('error', 'Kein Zugriff.');
      return res.redirect('/dashboard');
    }
    const token = crypto.randomBytes(24).toString('hex');
    await this.lowdbService.add(
      {
        id: uuid.v1(),
        token,
        spielerId: spieler.id,
        mannschaftId: spieler.mannschaftId,
        createdAt: new Date().toISOString(),
        usedAt: null,
      },
      'uploadTokens',
    );
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const uploadUrl = `${baseUrl}/upload/${token}`;
    req.flash(
      'uploadLink',
      JSON.stringify({ spielerName: spieler.anzeigename, url: uploadUrl }),
    );
    res.redirect(`/mannschaft/${spieler.mannschaftId.replace(/^#/, '')}`);
  }

  @Get('/upload/:token')
  @Render('upload-token')
  async uploadTokenPage(@Param() params, @Req() req) {
    const tokenEntry = await this.lowdbService.find({ token: params.token }, 'uploadTokens');
    if (!tokenEntry || tokenEntry.usedAt) {
      return { invalid: true };
    }
    const spieler = await this.lowdbService.find({ id: tokenEntry.spielerId }, 'spieler');
    const mannschaft = await this.mannschaftenService.findById(tokenEntry.mannschaftId);
    return { tokenEntry, spieler, mannschaft, error: req.flash('error') };
  }

  @Post('/upload/public/:token')
  @UseInterceptors(FileInterceptor('file', { dest: './public/uploads' }))
  async uploadPublic(
    @Param() params,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
    @Req() req,
  ) {
    const tokenEntry = await this.lowdbService.find({ token: params.token }, 'uploadTokens');
    if (!tokenEntry || tokenEntry.usedAt) {
      req.flash('error', 'Dieser Upload-Link ist ungültig oder wurde bereits verwendet.');
      return res.redirect(`/upload/${params.token}`);
    }
    if (!file) {
      req.flash('error', 'Bitte eine MP3-Datei auswählen.');
      return res.redirect(`/upload/${params.token}`);
    }
    const spieler = await this.lowdbService.find({ id: tokenEntry.spielerId }, 'spieler');
    fs.renameSync(
      `${file.destination}/${file.filename}`,
      `${file.destination}/${spieler.username}.mp3`,
    );
    await this.lowdbService.increaseSpielerVersion(spieler.id);
    await this.lowdbService.update(
      { token: params.token },
      { usedAt: new Date().toISOString() },
      'uploadTokens',
    );
    return res.send(`
      <!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
      <title>Upload erfolgreich</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="/app.css">
      <style>body{min-height:100svh;display:grid;place-items:center;background:var(--c-surface);padding:var(--sp-xl)}</style>
      </head><body>
      <div class="card p-2xl text-center" style="max-width:420px;width:100%">
        <div style="font-size:3rem" aria-hidden="true">🎵</div>
        <h1 style="font-size:var(--fs-xl)" class="mt-lg">Upload erfolgreich!</h1>
        <p class="text-muted text-sm mt-md">
          Dein Sound für <strong>${spieler.anzeigename}</strong> wurde hochgeladen.
        </p>
        <p class="text-sm mt-sm" style="color:var(--c-text-light)">Dieser Link wurde deaktiviert.</p>
      </div>
      </body></html>
    `);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  @Get('/api/info')
  async apiInfo() {
    const spieler = await this.lowdbService.findAll('spieler');
    return spieler.filter((s: any) => s.version > 0 && s.active);
  }

  @Get('/api/info/:mannschaftId')
  async apiInfoByMannschaft(@Param() params) {
    const id = toDbId(params.mannschaftId); // support both H4R and #H4R
    const spieler = await this.lowdbService.findAll('spieler');
    return spieler.filter(
      (s: any) => s.mannschaftId === id && s.version > 0 && s.active,
    );
  }

  @Get('/api/mannschaften')
  async apiMannschaften() {
    return await this.mannschaftenService.findAll();
  }
}
