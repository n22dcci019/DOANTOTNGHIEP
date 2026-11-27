import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsString, Matches, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value;

export class UpdateProfileDto {
  @ValidateIf((_, value) => value !== undefined) @IsString() @MaxLength(200)
  full_name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.replace(/\s/g, '') : value)
  @Matches(/^(?:\+84|0)\d{9,10}$/)
  phone?: string;

  @ValidateIf((_, value) => value !== undefined) @Transform(normalizeEmail) @IsEmail() @MaxLength(254)
  email?: string;

  @IsInt() @Min(1)
  version!: number;
}

export class InviteDto {
  @Transform(normalizeEmail) @IsEmail() @MaxLength(254)
  email!: string;

  @IsIn(['customer', 'driver', 'admin'])
  role_code!: string;
}

export class AcceptInvitationDto {
  @IsString() @MaxLength(512)
  token!: string;

  @IsString() @MinLength(1) @MaxLength(200)
  full_name!: string;

  @IsString() @MinLength(8) @MaxLength(128)
  password!: string;
}
