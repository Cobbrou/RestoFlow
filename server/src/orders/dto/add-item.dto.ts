import { IsString, IsNotEmpty, IsOptional, IsObject } from "class-validator";

export class AddItemDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsOptional()
  @IsObject()
  product?: any;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  price?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  course?: string;

  @IsOptional()
  @IsString()
  station?: string;

  @IsOptional()
  @IsString()
  courseStatus?: string;

  @IsOptional()
  composition?: any;
}
