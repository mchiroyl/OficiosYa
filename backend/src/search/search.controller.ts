import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchProfilesDto } from './dto/search-profiles.dto';
import { SearchWorkersDto } from './dto/search-workers.dto';
import { SearchIndexService } from './search-index.service';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly index: SearchIndexService,
  ) {}

  @Get('profiles')
  @ApiOperation({
    summary: 'Motor de búsqueda indexada de perfiles (HU-10, HU-11)',
    description:
      'Cruza texto libre, zona, disponibilidad, precio y reputación. Usa la función SQL buscar_perfiles_indexados e índices GIN/B-tree.',
  })
  searchProfiles(@Query() query: SearchProfilesDto) {
    return this.index.searchProfiles(query);
  }

  @Get('quadrants')
  @ApiOperation({
    summary: 'Listar cuadrantes y zonas (HU-12)',
    description:
      'Devuelve el catálogo geográfico. Si envías lat y lng, marca el cuadrante que contiene el punto y la distancia al centro.',
  })
  listQuadrants(@Query() query: SearchWorkersDto) {
    return this.search.listQuadrants(query.lat, query.lng);
  }

  @Get('workers')
  @ApiOperation({
    summary: 'Buscar trabajadores disponibles por ubicación (HU-12)',
    description:
      'Filtra por cuadrante, id_zona o coordenadas aproximadas. Solo incluye perfiles Disponibles con cobertura en esas zonas.',
  })
  searchWorkers(@Query() query: SearchWorkersDto) {
    return this.search.searchWorkers(query);
  }

  @Post('workers')
  @ApiOperation({
    summary: 'Buscar trabajadores disponibles (cuerpo JSON)',
    description: 'Misma búsqueda que GET /search/workers, útil cuando se envían coordenadas desde el cliente.',
  })
  searchWorkersPost(@Body() dto: SearchWorkersDto) {
    return this.search.searchWorkers(dto);
  }
}
