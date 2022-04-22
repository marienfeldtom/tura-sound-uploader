import {
  Get,
  Controller,
  Render,
  Post,
  Req,
  Res,
  Redirect,
  UseGuards,
  UseFilters,
  Param,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { AppService } from './app.service';
import { request, Response } from 'express';
import { LowdbService } from './lowdb/lowdb.service';
import { LoginGuard } from './common/guards/login.guard';
import { AuthenticatedGuard } from './common/guards/authenticated.guard';
import { AuthExceptionFilter } from './common/filters/auth-exceptions.filter';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import path from 'path';

@Controller()
@UseFilters(AuthExceptionFilter)
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly lowdbService: LowdbService,
  ) {}

  @UseGuards(AuthenticatedGuard)
  @Get('/all')
  @Render('index')
  async root(@Req() req) {
    let spieler = await this.lowdbService.findAll('spieler');
    if (req.user.username != 'all') {
      spieler = spieler.filter(function (element) {
        return element.mannschaft == req.user.username;
      });
    }
    return {
      user: req.user,
      message: req.flash('message'),
      spieler: spieler,
    };
  }

  @UseGuards(AuthenticatedGuard)
  @Get('/edit/:id')
  @Render('edit')
  async edit(@Param() params) {
    return { id: params.id };
  }

  @Post('/upload')
  @UseInterceptors(FileInterceptor('file', { dest: './public/uploads' }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body,
    @Res() res: Response,
  ) {
    const spieler = await this.lowdbService.find({ id: body.id }, 'spieler');
    fs.rename(
      file.destination + '/' + file.filename,
      file.destination + '/' + spieler.username + '.mp3',
      function (err) {
        if (err) console.log('ERROR: ' + err);
      },
    );
    await this.lowdbService.increase(body.id);
    res.redirect('/all');
  }

  @UseGuards(LoginGuard)
  @Post('/login')
  login(@Res() res: Response) {
    res.redirect('/all');
  }

  @Get('/')
  @Render('login')
  index(@Req() req): { message: string } {
    return { message: req.flash('loginError') };
  }

  @Get('/logout')
  logout(@Req() req, @Res() res: Response) {
    req.logout();
    res.redirect('/');
  }

  @Get('/info')
  async info() {
    const spieler = await this.lowdbService.findAll('spieler');
    return spieler.filter(function (element) {
      return element.version > 0 && element.active;
    });
  }

  @UseGuards(AuthenticatedGuard)
  @Get('/delete/:id')
  async delete(@Param() params, @Res() res: Response, @Req() req) {
    const spieler = await this.lowdbService.find({ id: params.id }, 'spieler');
    const mp3path = './public/uploads/' + spieler.username + '.mp3';
    await this.lowdbService.delete({ id: params.id }, 'spieler');
    try {
      if (fs.existsSync(mp3path)) {
        fs.unlink(mp3path, function (err) {
          if (err) throw err;
          req.flash('message', 'Spieler wurde erfolgreich gelöscht!');
          res.redirect('/all');
        });
      } else {
        req.flash('message', 'Spieler wurde erfolgreich gelöscht!');
        res.redirect('/all');
      }
    } catch (err) {
      console.error(err);
    }
  }

  @UseGuards(AuthenticatedGuard)
  @Get('/switch/:id')
  async switch(@Param() params, @Res() res: Response, @Req() req) {
    const spieler = await this.lowdbService.find({ id: params.id }, 'spieler');
    spieler.active = !spieler.active;
    res.redirect('/all');
  }

  @UseGuards(AuthenticatedGuard)
  @Post('/spieler')
  async addSpieler(@Req() request, @Res() res: Response) {
    await this.lowdbService.add(
      {
        username: request.body.username,
        anzeigename: request.body.anzeigename,
        mannschaft: request.body.mannschaft,
        version: 0,
        active: true,
      },
      'spieler',
    );
    request.flash('message', 'Spieler wurde erfolgreich hinzugefügt!');
    res.redirect('/all');
  }
}
