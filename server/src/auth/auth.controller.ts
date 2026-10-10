import { Controller, Post, Body } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { Public } from "./decorators/public.decorator";

@Controller("api/auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post("pin")
  async verifyPin(@Body() body: { pin: string; staffId?: string }) {
    return this.authService.verifyPin(body.pin, body.staffId);
  }
}
