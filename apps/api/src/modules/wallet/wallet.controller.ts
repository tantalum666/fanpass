import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentSession, Roles } from "../../common/auth.decorators";
import { FanPassAuthGuard } from "../../common/fanpass-auth.guard";
import { FanPassSession } from "../../common/session";
import { WalletService } from "./wallet.service";

@Controller("/wallet")
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get("/balances")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ADMIN")
  balances(@CurrentSession() session: FanPassSession) {
    return this.wallet.balances(session);
  }
}
