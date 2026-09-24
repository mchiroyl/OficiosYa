import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioRow } from '../common/usuario.util';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

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
}
