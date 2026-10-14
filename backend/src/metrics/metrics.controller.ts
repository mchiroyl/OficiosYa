import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MetricsQueryDto } from './dto/metrics-query.dto';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @ApiOperation({
    summary: 'Indicadores clave de la plataforma (HU-23)',
    description:
      'Devuelve usuarios activos, el ranking de oficios más solicitados y las solicitudes cerradas con éxito. Solo moderación.',
  })
  resumen(@Query() query: MetricsQueryDto) {
    return this.metrics.resumen(query.limit);
  }

  @Get('usuarios-activos')
  @ApiOperation({
    summary: 'Usuarios activos (HU-23)',
    description: 'COUNT de cuentas con estado ACTIVO y modo operable.',
  })
  usuariosActivos() {
    return this.metrics.usuariosActivos();
  }

  @Get('oficios-solicitados')
  @ApiOperation({
    summary: 'Oficios más solicitados (HU-23)',
    description: 'GROUP BY categoría sobre las solicitudes, ordenado por cantidad.',
  })
  oficios(@Query() query: MetricsQueryDto) {
    return this.metrics.oficiosMasSolicitados(query.limit);
  }

  @Get('solicitudes-exitosas')
  @ApiOperation({
    summary: 'Solicitudes cerradas con éxito (HU-23)',
    description: 'COUNT de solicitudes en estado Finalizada, FINALIZADA o COMPLETADA, con el total y la tasa.',
  })
  solicitudesExitosas() {
    return this.metrics.solicitudesCerradasExito();
  }
}
