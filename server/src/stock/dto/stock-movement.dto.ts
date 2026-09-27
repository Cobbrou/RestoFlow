import { IsString, IsNotEmpty, IsNumber, IsOptional, IsIn } from "class-validator";

export class StockMovementDto {
  @IsString()
  @IsNotEmpty()
  ingredientId: string;

  @IsString()
  @IsIn(["DELIVERY", "WASTE", "ADJUSTMENT", "ORDER_CONSUMPTION", "CANCEL_RETURN"])
  type: "DELIVERY" | "WASTE" | "ADJUSTMENT" | "ORDER_CONSUMPTION" | "CANCEL_RETURN";

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsNumber()
  unitCost?: number;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
