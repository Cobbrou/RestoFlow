import { IsString, IsNotEmpty, IsNumber, Min } from "class-validator";

export class ChangeQtyDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @Min(0)
  qty: number;
}
