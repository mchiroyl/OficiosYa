import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioRow } from '../common/usuario.util';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsDto } from './dto/list-reports.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportsService } from './reports.service';

@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('reports/create')
  @ApiTags('Reports')
  @ApiOperation({
    summary: 'Denunciar una cuenta o recurso',
    description: 'Crea un reporte en estado PENDIENTE. No admite denunciarte a ti mismo ni duplicar un pendiente.',
  })
  create(@CurrentUser() user: UsuarioRow, @Body() dto: CreateReportDto) {
    return this.reports.create(user, dto);
  }

  @Get('admin/reports')
  @ApiTags('Admin')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Listar denuncias (HU-21)',
    description: 'Consulta reportes y la cuenta denunciada. Filtros: estado y tipo_recurso.',
  })
  list(@Query() query: ListReportsDto) {
    return this.reports.list(query);
  }

  @Get('admin/reports/:id')
  @ApiTags('Admin')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Obtener una denuncia' })
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.reports.getOne(id);
  }

  @Patch('admin/reports/:id')
  @ApiTags('Admin')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Resolver o rechazar una denuncia (HU-21)',
    description:
      'Pasa el reporte a RESUELTO o RECHAZADO. Opcionalmente suspende, reactiva o elimina la cuenta denunciada.',
  })
  update(
    @CurrentUser() user: UsuarioRow,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReportDto,
  ) {
    return this.reports.update(user, id, dto);
  }
}
