import { IsString, IsNotEmpty } from "class-validator";

// L'équipier qui transfère ou fusionne est celui de la session (un staffName envoyé par le client est ignoré)
export class TransferTableDto {
  @IsString()
  @IsNotEmpty()
  sourceTableId: string;

  @IsString()
  @IsNotEmpty()
  targetTableId: string;
}

export class MergeTableDto {
  @IsString()
  @IsNotEmpty()
  sourceTableId: string;

  @IsString()
  @IsNotEmpty()
  targetTableId: string;
}
