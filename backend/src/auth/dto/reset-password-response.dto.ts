import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordResponseDto {
  @ApiProperty({ example: 'La contraseña se restableció correctamente.' })
  message: string;
}
