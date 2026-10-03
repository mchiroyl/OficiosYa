import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendTextDto {
  @ApiProperty({ example: '¿Puede llegar hoy por la tarde?' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'El mensaje no puede estar vacío.' })
  @MaxLength(4000, { message: 'El mensaje no puede superar 4000 caracteres.' })
  contenido: string;
}
