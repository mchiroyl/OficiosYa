import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListMessagesDto {
  @ApiPropertyOptional({ description: 'Devuelve mensajes con id_mensaje mayor que este valor.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  after?: number;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PollMessagesDto extends ListMessagesDto {
  @ApiPropertyOptional({
    example: 25,
    description: 'Segundos máximos de espera si no hay mensajes nuevos (1–30).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  timeout?: number;
}
