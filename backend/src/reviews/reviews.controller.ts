import { Body, Controller, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioRow } from '../common/usuario.util';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

class ReplyReviewDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  respuesta: string;
}

@ApiTags('Reviews')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('create')
  @ApiOperation({
    summary: 'Crear reseña de un servicio (HU-18)',
    description:
      'Solo el cliente puede calificar una solicitud en estado Finalizada. Una solicitud admite una sola reseña. Actualiza el promedio del trabajador (trigger SQL o recálculo en API).',
  })
  @ApiResponse({ status: 201, description: 'Reseña creada y promedio del trabajador actualizado.' })
  @ApiResponse({ status: 400, description: 'La solicitud no está Finalizada o la calificación es inválida.' })
  @ApiResponse({ status: 403, description: 'Solo el cliente de la solicitud puede calificar.' })
  @ApiResponse({ status: 409, description: 'La solicitud ya tiene una reseña.' })
  create(@CurrentUser() user: UsuarioRow, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user, dto);
  }

  @Put(':id/reply')
  @ApiOperation({
    summary: 'Responder una reseña recibida (HU-19)',
    description:
      'El trabajador dueño de la reseña publica una sola respuesta. Queda visible en el perfil. Un segundo intento responde 409.',
  })
  @ApiResponse({ status: 200, description: 'Respuesta pública guardada.' })
  @ApiResponse({ status: 403, description: 'La reseña no es de este trabajador.' })
  @ApiResponse({ status: 409, description: 'La reseña ya tiene una respuesta.' })
  reply(
    @CurrentUser() user: UsuarioRow,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.reviews.reply(user, id, dto.respuesta);
  }
}
