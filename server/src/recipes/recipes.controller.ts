import { Controller, Get, Post, Delete, Body, Param } from "@nestjs/common";
import { RecipesService, RecipeItemPayload } from "./recipes.service";

@Controller("recipes")
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  async getAll() {
    return this.recipesService.findAll();
  }

  @Get(":productId")
  async getByProduct(@Param("productId") productId: string) {
    return this.recipesService.findByProduct(productId);
  }

  @Post(":productId")
  async saveRecipe(
    @Param("productId") productId: string,
    @Body("items") items: RecipeItemPayload[]
  ) {
    return this.recipesService.saveRecipe(productId, items || []);
  }

  @Delete(":productId")
  async deleteRecipe(@Param("productId") productId: string) {
    return this.recipesService.deleteRecipe(productId);
  }
}
