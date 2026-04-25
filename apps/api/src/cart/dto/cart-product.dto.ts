import { IsNotEmpty, IsNumber, IsString, Min } from "class-validator";

export class CartProductDTO {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  price!: number;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  categorySlug!: string;

  @IsString()
  @IsNotEmpty()
  image!: string;
}
