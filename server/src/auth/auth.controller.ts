import { Controller, Post, Body } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Controller("api/auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("pin")
  async verifyPin(@Body() body: { pin: string }) {
    return this.authService.verifyPin(body.pin);
  }
}
