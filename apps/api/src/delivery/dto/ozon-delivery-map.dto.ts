import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { deliveryPickupPointIdMaxLength } from "../delivery.constants";

export class StorefrontOzonMapCoordinateDTO {
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-180)
  @Max(180)
  long!: number;
}

export class StorefrontOzonMapViewportDTO {
  @IsDefined()
  @ValidateNested()
  @Type(() => StorefrontOzonMapCoordinateDTO)
  leftBottom!: StorefrontOzonMapCoordinateDTO;

  @IsDefined()
  @ValidateNested()
  @Type(() => StorefrontOzonMapCoordinateDTO)
  rightTop!: StorefrontOzonMapCoordinateDTO;
}

export class StorefrontOzonDeliveryMapRequestDTO {
  @IsDefined()
  @ValidateNested()
  @Type(() => StorefrontOzonMapViewportDTO)
  viewport!: StorefrontOzonMapViewportDTO;

  @IsInt()
  @Min(0)
  @Max(19)
  zoom!: number;
}

export class StorefrontOzonDeliveryMapClusterDTO {
  @IsDefined()
  @ValidateNested()
  @Type(() => StorefrontOzonMapCoordinateDTO)
  coordinate!: StorefrontOzonMapCoordinateDTO;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(deliveryPickupPointIdMaxLength, { each: true })
  mapPointIds!: string[];

  @IsInt()
  @Min(1)
  pointsCount!: number;

  @IsBoolean()
  isSameBuilding!: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => StorefrontOzonMapViewportDTO)
  viewport?: StorefrontOzonMapViewportDTO;
}

export class StorefrontOzonDeliveryMapResponseDTO {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StorefrontOzonDeliveryMapClusterDTO)
  clusters!: StorefrontOzonDeliveryMapClusterDTO[];
}

export class StorefrontOzonDeliveryPointInfoRequestDTO {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(deliveryPickupPointIdMaxLength, { each: true })
  mapPointIds!: string[];
}
