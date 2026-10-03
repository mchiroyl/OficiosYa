import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Ana Pérez' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: 'El nombre completo es obligatorio.' })
  @MaxLength(150)
  nombre: string;

  @ApiProperty({ example: 'ana@example.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @MaxLength(150)
  correo: string;

  @ApiPropertyOptional({ example: '70001234' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9+\s()-]*$/, {
    message: 'El teléfono solo puede contener números y símbolos + - ( ).',
  })
  telefono?: string;

  @ApiProperty({ example: 'secreto123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(72)
  password: string;

  @ApiPropertyOptional({ enum: ['cliente', 'trabajador'], example: 'cliente' })
  @IsOptional()
  @IsIn(['cliente', 'trabajador'], {
    message: 'El modo debe ser cliente o trabajador.',
  })
  modo?: 'cliente' | 'trabajador';

  @ApiPropertyOptional({ example: 'Plomería' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  oficio_principal?: string;

  @ApiPropertyOptional({ example: 'Reparaciones residenciales.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @ApiPropertyOptional({ example: '5 años' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  experiencia?: string;
}
