import { Controller, Get } from "@nestjs/common";
import { StaffService } from "./staff.service";

@Controller("api/staff")
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Get()
  getStaff() {
    return this.staffService.getStaff();
  }

  @Get("roles")
  getRoles() {
    return this.staffService.getRoles();
  }
}
