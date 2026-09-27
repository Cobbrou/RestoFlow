import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class TransferTableDto {
  @IsString()
  @IsNotEmpty()
  sourceTableId: string;

  @IsString()
  @IsNotEmpty()
  targetTableId: string;

  @IsOptional()
  @IsString()
  staffName?: string;
}

export class MergeTableDto {
  @IsString()
  @IsNotEmpty()
  sourceTableId: string;

  @IsString()
  @IsNotEmpty()
  targetTableId: string;

  @IsOptional()
  @IsString()
  staffName?: string;
}
