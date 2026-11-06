import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;
}
