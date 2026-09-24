import { Body, Controller, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioRow } from '../common/usuario.util';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { RequestsService } from './requests.service';

@ApiTags('Requests')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post('create')
  @ApiOperation({
    summary: 'Crear una nueva solicitud de servicio (HU-13)',
    description:
      'El cliente autenticado envía una solicitud. Se inserta en solicitud_servicio con estado inicial Enviada.',
  })
  create(@CurrentUser() user: UsuarioRow, @Body() dto: CreateRequestDto) {
    return this.requests.create(user, dto);
  }

  @Put(':id/status')
  @ApiOperation({
    summary: 'Cambiar estado de una solicitud (HU-14, HU-15)',
    description:
      'Máquina de estados transaccional. Aceptar/Rechazar: trabajador sobre Enviada. Cancelar: cliente sobre Enviada o Aceptada. Finalizar: cliente o trabajador sobre Aceptada. Impide saltos inválidos y condiciones de carrera.',
  })
  @ApiResponse({ status: 400, description: 'Salto de estado inválido.' })
  @ApiResponse({ status: 403, description: 'El actor no puede ejecutar esa acción.' })
  @ApiResponse({ status: 409, description: 'La solicitud cambió de estado en paralelo.' })
  updateStatus(
    @CurrentUser() user: UsuarioRow,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRequestStatusDto,
  ) {
    return this.requests.updateStatus(user, id, dto);
  }
}
