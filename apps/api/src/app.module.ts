import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { DemoStore } from "./common/demo-store";
import { FanPassAuthGuard } from "./common/fanpass-auth.guard";
import { PrismaService } from "./common/prisma.service";
import { AlphaController } from "./modules/alpha/alpha.controller";
import { AlphaPersistenceService } from "./modules/alpha/alpha-persistence.service";
import { AuditService } from "./modules/audit/audit.service";
import { EventsController } from "./modules/events/events.controller";
import { EventsService } from "./modules/events/events.service";
import { TicketsController } from "./modules/tickets/tickets.controller";
import { TicketsService } from "./modules/tickets/tickets.service";
import { OrderbookGateway } from "./modules/orders/orderbook.gateway";
import { OrderbookRealtimeService } from "./modules/orders/orderbook-realtime.service";
import { OrdersController } from "./modules/orders/orders.controller";
import { OrderbookService } from "./modules/orders/orderbook.service";
import { OwnershipService } from "./modules/ownership/ownership.service";
import { PaymentsController } from "./modules/payments/payments.controller";
import { PaymentsService } from "./modules/payments/payments.service";
import { SideEffectOutboxService } from "./modules/side-effects/side-effect-outbox.service";
import { SideEffectWorkerSchedulerService } from "./modules/side-effects/side-effect-worker-scheduler.service";
import { SideEffectWorkerService } from "./modules/side-effects/side-effect-worker.service";
import { SideEffectHealthService } from "./modules/side-effects/side-effect-health.service";
import { SettlementSideEffectsService } from "./modules/side-effects/settlement-side-effects.service";
import { TicketOwnershipSideEffectsService } from "./modules/side-effects/ticket-ownership-side-effects.service";
import { FanAccessController } from "./modules/fan-access/fan-access.controller";
import { FanAccessService } from "./modules/fan-access/fan-access.service";
import { AuthController } from "./modules/auth/auth.controller";
import { AuthService } from "./modules/auth/auth.service";
import { PrivyTokenService } from "./modules/auth/privy-token.service";
import { VerificationController } from "./modules/verification/verification.controller";
import { VerificationService } from "./modules/verification/verification.service";
import { WalletController } from "./modules/wallet/wallet.controller";
import { WalletService } from "./modules/wallet/wallet.service";
import { PrivyWalletService } from "./modules/privy/privy-wallet.service";
import { validateEnvironment } from "./config/security-config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
  ],
  controllers: [
    AppController,
    EventsController,
    TicketsController,
    OrdersController,
    FanAccessController,
    AuthController,
    VerificationController,
    PaymentsController,
    WalletController,
    AlphaController,
  ],
  providers: [
    {
      provide: DemoStore,
      useFactory: () => new DemoStore({ includeMarketDepth: true }),
    },
    PrismaService,
    AlphaPersistenceService,
    AuditService,
    AuthService,
    PrivyTokenService,
    FanPassAuthGuard,
    EventsService,
    OwnershipService,
    PaymentsService,
    SideEffectOutboxService,
    SideEffectWorkerService,
    SideEffectWorkerSchedulerService,
    SideEffectHealthService,
    SettlementSideEffectsService,
    TicketOwnershipSideEffectsService,
    TicketsService,
    OrderbookGateway,
    OrderbookRealtimeService,
    OrderbookService,
    FanAccessService,
    VerificationService,
    WalletService,
    PrivyWalletService,
  ],
})
export class AppModule {}
