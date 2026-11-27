import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class CreateTemperatureConfigDto {
  @IsNumber({ allowInfinity: false, allowNaN: false }) @Min(-25) @Max(-15)
  target_min!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false }) @Min(-25) @Max(-15)
  target_max!: number;

  @IsInt() @Min(1)
  version!: number;
}
