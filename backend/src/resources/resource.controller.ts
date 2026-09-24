import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Type,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ResourceService } from './resource.service';
import { ResourceConfig } from './resources.config';

export function createResourceController(config: ResourceConfig): Type<unknown> {
  const readGuard = config.publicRead ? OptionalJwtAuthGuard : JwtAuthGuard;

  @ApiTags(config.path)
  @ApiBearerAuth('access-token')
  @Controller(config.path)
  class ResourceController {
    constructor(public readonly resources: ResourceService) {}

    @Get()
    @UseGuards(readGuard)
    @ApiOperation({ summary: `Listar ${config.path}` })
    findAll(@Query() query: Record<string, string>) {
      return this.resources.findAll(config, query);
    }

    @Get(Array.isArray(config.pk) ? ':idPerfil/:idZona' : ':id')
    @UseGuards(readGuard)
    @ApiOperation({ summary: `Obtener un registro de ${config.path}` })
    findOne(@Param('id') id?: string, @Param('idPerfil') idPerfil?: string, @Param('idZona') idZona?: string) {
      return this.resources.findOne(config, keysFromParams(config, { id, idPerfil, idZona }));
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: `Crear un registro en ${config.path}` })
    create(@Body() body: Record<string, unknown>) {
      assertWritable(config);
      return this.resources.create(config, body);
    }

    @Patch(Array.isArray(config.pk) ? ':idPerfil/:idZona' : ':id')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: `Actualizar un registro de ${config.path}` })
    update(
      @Body() body: Record<string, unknown>,
      @Param('id') id?: string,
      @Param('idPerfil') idPerfil?: string,
      @Param('idZona') idZona?: string,
    ) {
      assertWritable(config);
      return this.resources.update(
        config,
        keysFromParams(config, { id, idPerfil, idZona }),
        body,
      );
    }

    @Delete(Array.isArray(config.pk) ? ':idPerfil/:idZona' : ':id')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: `Eliminar un registro de ${config.path}` })
    remove(
      @Param('id') id?: string,
      @Param('idPerfil') idPerfil?: string,
      @Param('idZona') idZona?: string,
    ) {
      assertWritable(config);
      return this.resources.remove(config, keysFromParams(config, { id, idPerfil, idZona }));
    }
  }

  Object.defineProperty(ResourceController, 'name', {
    value: `${toPascal(config.path)}Controller`,
  });

  return ResourceController;
}

function assertWritable(config: ResourceConfig) {
  if (!config.denyMutations) return;
  if (config.table === 'solicitud_servicio') {
    throw new ForbiddenException(
      'El estado de una solicitud solo cambia con PUT /api/requests/{id}/status.',
    );
  }
  if (config.table === 'resena') {
    throw new ForbiddenException('Las reseñas se crean con POST /api/reviews/create.');
  }
  throw new ForbiddenException('Este recurso no admite altas, cambios ni bajas por esta vía.');
}

function keysFromParams(
  config: ResourceConfig,
  params: { id?: string; idPerfil?: string; idZona?: string },
) {
  if (Array.isArray(config.pk)) {
    return {
      id_perfil: Number(params.idPerfil),
      id_zona: Number(params.idZona),
    };
  }
  return { [config.pk]: Number(params.id) };
}

function toPascal(value: string) {
  return value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
