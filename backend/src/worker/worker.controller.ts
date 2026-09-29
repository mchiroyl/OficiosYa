import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioRow } from '../common/usuario.util';
import { HorarioDto } from './dto/horario.dto';
import { TarifasDto } from './dto/tarifas.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import { WorkerProfileResponseDto, ZonaCoberturaDto } from './dto/worker-profile-response.dto';
import { WorkerService } from './worker.service';

@ApiTags('Worker')
@ApiExtraModels(
  HorarioDto,
  TarifasDto,
  UpdateAvailabilityDto,
  UpdateWorkerProfileDto,
  WorkerProfileResponseDto,
  ZonaCoberturaDto,
)
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
@UseGuards(JwtAuthGuard)
@Controller('worker')
export class WorkerController {
  constructor(private readonly workers: WorkerService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Obtener el perfil del trabajador (HU-05)',
    description:
      'Devuelve oficio, tarifas, horarios, zonas de cobertura y el estado público Disponible/Ocupado. Si aún no hay perfil, responde un borrador vacío con existe=false.',
  })
  @ApiOkResponse({ type: WorkerProfileResponseDto })
  getProfile(@CurrentUser() user: UsuarioRow) {
    return this.workers.getProfile(user);
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Actualizar el perfil del trabajador (HU-05)',
    description:
      'Crea o actualiza oficio, tarifas, horarios y cobertura geográfica. Tarifas y horarios se guardan en el JSON de perfil_trabajador.descripcion. cobertura reemplaza las filas de perfil_zona.',
  })
  @ApiBody({ type: UpdateWorkerProfileDto })
  @ApiOkResponse({ type: WorkerProfileResponseDto })
  updateProfile(@CurrentUser() user: UsuarioRow, @Body() dto: UpdateWorkerProfileDto) {
    return this.workers.updateProfile(user, dto);
  }

  @Put('availability')
  @ApiOperation({
    summary: 'Alternar disponibilidad pública (HU-07)',
    description:
      'Cambia el estado público entre Disponible y Ocupado. Si envías disponibilidad, se asigna ese valor; si no, se alterna. Crea el perfil si todavía no existe.',
  })
  @ApiBody({ type: UpdateAvailabilityDto, required: false })
  @ApiOkResponse({ type: WorkerProfileResponseDto })
  updateAvailability(@CurrentUser() user: UsuarioRow, @Body() dto: UpdateAvailabilityDto = {}) {
    return this.workers.updateAvailability(user, dto);
  }
}
