import { IsString, IsNotEmpty, IsOptional, IsArray } from "class-validator";

/**
 * Seuls la commande et les règlements sont fournis par le client :
 * sous-total, remise, TVA, total et numéro de ticket sont calculés par le serveur.
 */
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
}
