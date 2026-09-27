import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, IsArray } from "class-validator";

export class AddItemDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  qty?: number = 1;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  course?: string;

  @IsOptional()
  @IsArray()
  composition?: any[];
}
