import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
      'Solo el cliente puede calificar una solicitud en estado Finalizada. Actualiza el promedio del trabajador (trigger SQL o recálculo en API).',
  })
  create(@CurrentUser() user: UsuarioRow, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user, dto);
  }
}
