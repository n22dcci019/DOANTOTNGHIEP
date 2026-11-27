import { Transform } from 'class-transformer';
import { Allow, IsInt, IsNumber, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateShipmentDto {
  @IsString() @Matches(/\S/) @MaxLength(200)
  product_type!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false }) @Min(-25) @Max(-15)
  temp_min!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false }) @Min(-25) @Max(-15)
  temp_max!: number;

  @ValidateIf((_, value) => value !== undefined) @IsString() @MaxLength(2000)
  warehouse_notes?: string;

  // Compatibility required by 2.3: accept and ignore this untrusted input.
  // The service inserts only the authenticated principal's userId.
  @Allow()
  customer_id?: unknown;
}

export class ShipmentVersionDto {
  @IsInt() @Min(1)
  version!: number;
}

export class UpdateShipmentDto extends ShipmentVersionDto {
  @ValidateIf((_, value) => value !== undefined) @IsString() @Matches(/\S/) @MaxLength(200)
  product_type?: string;

  @ValidateIf((_, value) => value !== undefined) @IsNumber({ allowInfinity: false, allowNaN: false }) @Min(-25) @Max(-15)
  temp_min?: number;

  @ValidateIf((_, value) => value !== undefined) @IsNumber({ allowInfinity: false, allowNaN: false }) @Min(-25) @Max(-15)
  temp_max?: number;

  @ValidateIf((_, value) => value !== undefined) @IsString() @MaxLength(2000)
  warehouse_notes?: string;
}

export class RejectShipmentDto extends ShipmentVersionDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Matches(/\S/) @MaxLength(2000)
  rejected_reason!: string;
}

export class AssignShipmentDto extends ShipmentVersionDto {
  @IsUUID() vehicle_id!: string;
  @IsUUID() driver_id!: string;
  @IsUUID() device_id!: string;
}
