import { IsString, IsOptional, IsInt, Min, Max, Matches } from 'class-validator';

export class CreateReservationDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  customerName: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format de date invalide (YYYY-MM-DD)' })
  date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Format d\'heure invalide (HH:mm)' })
  time: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  guests?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
