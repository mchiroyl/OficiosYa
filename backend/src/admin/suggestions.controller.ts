import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioRow } from '../common/usuario.util';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { ReviewSuggestionDto } from './dto/review-suggestion.dto';
import { SuggestionsService } from './suggestions.service';

@Controller()
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  @Post('oficios/sugerencias')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiTags('Oficios')
  @ApiOperation({ summary: 'Sugerir un oficio nuevo para que un administrador lo apruebe' })
  create(@CurrentUser() user: UsuarioRow, @Body() dto: CreateSuggestionDto) {
    return this.suggestions.create(user, dto);
  }

  @Get('oficios/sugerencias')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiTags('Oficios')
  @ApiOperation({ summary: 'Listar las sugerencias de oficio del usuario autenticado' })
  mine(@CurrentUser() user: UsuarioRow) {
    return this.suggestions.listMine(user);
  }

  @Get('admin/sugerencias')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('access-token')
  @ApiTags('Admin')
  @ApiOperation({ summary: 'Listar sugerencias de oficios (administrador)' })
  listAll(@Query('estado') estado?: string) {
    return this.suggestions.listAll(estado);
  }

  @Patch('admin/sugerencias/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('access-token')
  @ApiTags('Admin')
  @ApiOperation({ summary: 'Aprobar o rechazar una sugerencia de oficio' })
  review(
    @CurrentUser() admin: UsuarioRow,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewSuggestionDto,
  ) {
    return this.suggestions.review(admin, id, dto.accion, dto.motivo);
  }
}
