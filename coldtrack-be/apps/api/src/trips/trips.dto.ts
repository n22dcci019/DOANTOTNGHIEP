import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

export class TripVersionDto {
  @IsInt() @Min(1)
  version!: number;
}

export class TripNotesDto extends TripVersionDto {
  @IsString() @MaxLength(4000)
  driver_notes!: string;
}

export class TripProofDto {
  // Multipart fields arrive as strings; only the proof DTO coerces version.
  @Type(() => Number) @IsInt() @Min(1)
  version!: number;

  @ValidateIf((_, value) => value !== undefined) @IsString() @MaxLength(200)
  signed_by?: string;
}
