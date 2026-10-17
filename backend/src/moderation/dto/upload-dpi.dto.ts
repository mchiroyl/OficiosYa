import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';

export class UploadDpiDto {
  @ApiPropertyOptional({
    example: '1234567890101',
    description: 'Número de DPI (13 dígitos). Se guarda solo enmascarado y con hash.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @Matches(/^\d{13}$/, { message: 'El DPI debe tener 13 dígitos.' })
  numero_dpi?: string;
}
