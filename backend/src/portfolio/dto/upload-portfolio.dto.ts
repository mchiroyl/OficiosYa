import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadPortfolioDto {
  @ApiPropertyOptional({ example: 'Reparación de tubería' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  titulo?: string;

  @ApiPropertyOptional({ example: 'Cambio de tubería en cocina.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;
}
