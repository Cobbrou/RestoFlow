import { Module } from "@nestjs/common";
import { RecipesService } from "./recipes.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [RecipesService],
  exports: [RecipesService],
})
export class RecipesModule {}
