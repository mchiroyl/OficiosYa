import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'secreto123' })
  @IsString()
  @MinLength(1, { message: 'La contraseña actual es obligatoria.' })
  passwordActual: string;

  @ApiProperty({ example: 'nuevaClave123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
  passwordNueva: string;
}
