import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioRow } from '../common/usuario.util';
import { UploadPortfolioDto } from './dto/upload-portfolio.dto';
import { PortfolioService } from './portfolio.service';

@ApiTags('Portfolio')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar fotos del portafolio del trabajador',
    description: 'Incluye imagen_url e imagen_thumb_url para carga diferida (RNF-08).',
  })
  listMine(@CurrentUser() user: UsuarioRow) {
    return this.portfolio.listMine(user);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Subir foto de un trabajo (RNF-08)',
    description:
      'Comprime la imagen con sharp, la guarda en Supabase Storage y registra el elemento en portafolio.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'JPG, PNG, WebP o GIF. Máx. 8 MB.' },
        titulo: { type: 'string', example: 'Reparación de tubería' },
        descripcion: { type: 'string', example: 'Cambio de tubería en cocina.' },
      },
    },
  })
  upload(
    @CurrentUser() user: UsuarioRow,
    @UploadedFile()
    file: { buffer: Buffer; mimetype?: string; originalname?: string },
    @Body() dto: UploadPortfolioDto,
  ) {
    return this.portfolio.upload(user, file, dto);
  }
}
