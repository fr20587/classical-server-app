import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CsrfService } from './csrf.service';
import { getCookieConfig } from '../../config/cookie.config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('CSRF')
@Controller('csrf-token')
export class CsrfController {
  constructor(private readonly csrfService: CsrfService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener token CSRF' })
  @ApiResponse({ status: 200, description: 'Token CSRF generado exitosamente' })
  async getCsrfToken(@Res() res: Response) {
    const token = await this.csrfService.generateToken();
    const cookieConfig = getCookieConfig();

    // Establecer cookie XSRF-TOKEN (estándar Angular)
    res.cookie('XSRF-TOKEN', token, cookieConfig.csrf_token);

    return res.json({
      message: 'CSRF token generated',
      token, // También lo enviamos en el body para compatibilidad
    });
  }
}
