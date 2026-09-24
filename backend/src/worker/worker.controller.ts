import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioRow } from '../common/usuario.util';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import { WorkerService } from './worker.service';

@ApiTags('Worker')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('worker')
export class WorkerController {
  constructor(private readonly workers: WorkerService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Obtener el perfil del trabajador (HU-05)',
    description: 'Devuelve tarifas, horarios, cobertura y el estado público Disponible/Ocupado.',
  })
  getProfile(@CurrentUser() user: UsuarioRow) {
    return this.workers.getProfile(user);
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Actualizar el perfil del trabajador (HU-05)',
    description: 'Crea o actualiza oficio, tarifas, horarios y zonas de cobertura.',
  })
  updateProfile(@CurrentUser() user: UsuarioRow, @Body() dto: UpdateWorkerProfileDto) {
    return this.workers.updateProfile(user, dto);
  }

  @Put('availability')
  @ApiOperation({
    summary: 'Alternar disponibilidad pública (HU-07)',
    description:
      'Cambia el estado público entre Disponible y Ocupado. Si envías disponibilidad, se asigna ese valor; si no, se alterna.',
  })
  @ApiBody({ type: UpdateAvailabilityDto, required: false })
  updateAvailability(@CurrentUser() user: UsuarioRow, @Body() dto: UpdateAvailabilityDto = {}) {
    return this.workers.updateAvailability(user, dto);
  }
}
