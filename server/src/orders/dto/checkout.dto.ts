import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray, Min } from "class-validator";

export class CheckoutDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsArray()
  payments?: any[];

  @IsOptional()
  @IsString()
  serverName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total?: number;

  @IsOptional()
  discount?: any;

  @IsOptional()
  vatDetails?: any;

  @IsOptional()
  @IsString()
  ticketNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tip?: number;
}
