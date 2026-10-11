import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber, Min } from "class-validator";

/**
 * Seuls la commande, les règlements et le pourboire sont fournis par le client :
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

  // Pourboire : hors CA soumis à TVA
  @IsOptional()
  @IsNumber()
  @Min(0)
  tip?: number;

  // Équipier ayant encaissé sur la tablette (diffère de la session en cas de rejeu hors-ligne)
  @IsOptional()
  @IsString()
  operatorId?: string;

  // Ticket par convive : [{ itemId, qty }] encaissés sur un ticket séparé (validés par le serveur)
  @IsOptional()
  @IsArray()
  lines?: { itemId: string; qty: number }[];
}
