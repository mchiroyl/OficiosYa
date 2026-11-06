import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioRow } from '../common/usuario.util';
import { ReviewDpiDto } from './dto/review-dpi.dto';
import { UploadDpiDto } from './dto/upload-dpi.dto';
import { IdentityService } from './identity.service';

type UploadFile = { buffer: Buffer; mimetype?: string; originalname?: string };

@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get('identity/dpi')
  @ApiTags('Identity')
  @ApiOperation({
    summary: 'Consultar el estado de verificación de identidad (HU-20)',
    description: 'Devuelve el estado y URLs firmadas temporales del DPI del usuario autenticado.',
  })
  getMine(@CurrentUser() user: UsuarioRow) {
    return this.identity.getMine(user);
  }

  @Post('identity/dpi')
  @ApiTags('Identity')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'frente', maxCount: 1 },
        { name: 'reverso', maxCount: 1 },
      ],
      { limits: { fileSize: 8 * 1024 * 1024 } },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Enviar documentos de identidad (HU-20)',
    description:
      'Recibe frente y reverso del DPI, los comprime y los guarda en un bucket privado. El número se almacena enmascarado y con hash SHA-256. No se exponen URLs públicas.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['frente', 'reverso'],
      properties: {
        frente: { type: 'string', format: 'binary' },
        reverso: { type: 'string', format: 'binary' },
        numero_dpi: { type: 'string', example: '1234567890101' },
      },
    },
  })
  submit(
    @CurrentUser() user: UsuarioRow,
    @UploadedFiles()
    files: { frente?: UploadFile[]; reverso?: UploadFile[] },
    @Body() dto: UploadDpiDto,
  ) {
    return this.identity.submit(
      user,
      { frente: files?.frente?.[0], reverso: files?.reverso?.[0] },
      dto.numero_dpi,
    );
  }

  @Get('admin/identity')
  @ApiTags('Admin')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Listar verificaciones de DPI pendientes' })
  listPending() {
    return this.identity.listPending();
  }

  @Get('admin/identity/:idUsuario')
  @ApiTags('Admin')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Ver documentos de identidad de un trabajador (URLs firmadas)' })
  getOne(@Param('idUsuario', ParseIntPipe) idUsuario: number) {
    return this.identity.getForAdmin(idUsuario);
  }

  @Patch('admin/identity/:idUsuario')
  @ApiTags('Admin')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Aprobar o rechazar un DPI',
    description: 'Al aprobar se marca perfil_trabajador.verificado = true.',
  })
  review(
    @CurrentUser() user: UsuarioRow,
    @Param('idUsuario', ParseIntPipe) idUsuario: number,
    @Body() dto: ReviewDpiDto,
  ) {
    return this.identity.review(user, idUsuario, dto);
  }
}
