import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { Request } from "express";
import {
  CurrentSession,
  PublicRoute,
  Roles,
} from "../../common/auth.decorators";
import { FanPassAuthGuard } from "../../common/fanpass-auth.guard";
import { FanPassIdParamPipe } from "../../common/route-param.pipe";
import { FanPassSession } from "../../common/session";
import { PaymentsService } from "./payments.service";

class CreatePaymentIntentDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  orderId!: string;
}

class CreateCryptoQuoteDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/)
  orderId!: string;

  @IsString()
  @Matches(/^USDC$/)
  asset!: "USDC";
}

class ConfirmCryptoPaymentDto {
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  transactionHash!: string;
}

class SponsoredCryptoPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientReference?: string;
}

class PaymentOperationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
}

@Controller("/payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("/intents")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ADMIN")
  createPaymentIntent(
    @Body() body: CreatePaymentIntentDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.payments.createPaymentIntent(
      {
        orderId: body.orderId,
        idempotencyKey,
      },
      session,
    );
  }

  @Post("/crypto-quotes")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ADMIN")
  createCryptoQuote(
    @Body() body: CreateCryptoQuoteDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.payments.createCryptoQuote(
      {
        orderId: body.orderId,
        asset: body.asset,
        idempotencyKey,
      },
      session,
    );
  }

  @Post("/crypto-quotes/:paymentId/confirm")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ADMIN")
  confirmCryptoPayment(
    @Param("paymentId", FanPassIdParamPipe) paymentId: string,
    @Body() body: ConfirmCryptoPaymentDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.payments.confirmCryptoPayment(
      {
        paymentId,
        transactionHash: body.transactionHash,
        idempotencyKey,
      },
      session,
    );
  }

  @Post("/crypto-quotes/:paymentId/send-sponsored")
  @UseGuards(FanPassAuthGuard)
  @Roles("FAN", "ADMIN")
  sendSponsoredCryptoPayment(
    @Param("paymentId", FanPassIdParamPipe) paymentId: string,
    @Body() _body: SponsoredCryptoPaymentDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.payments.sendSponsoredCryptoPayment(
      {
        paymentId,
        idempotencyKey,
      },
      session,
    );
  }

  @Post("/:paymentId/cancel-authorization")
  @UseGuards(FanPassAuthGuard)
  @Roles("ADMIN")
  cancelAuthorization(
    @Param("paymentId", FanPassIdParamPipe) paymentId: string,
    @Body() body: PaymentOperationDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.payments.requestPaymentOperation(
      {
        operation: "cancel_authorization",
        paymentId,
        reason: body.reason,
        idempotencyKey,
      },
      session,
    );
  }

  @Post("/:paymentId/refund")
  @UseGuards(FanPassAuthGuard)
  @Roles("ADMIN")
  refund(
    @Param("paymentId", FanPassIdParamPipe) paymentId: string,
    @Body() body: PaymentOperationDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.payments.requestPaymentOperation(
      {
        operation: "refund",
        paymentId,
        reason: body.reason,
        idempotencyKey,
      },
      session,
    );
  }

  @Post("/:paymentId/reconcile")
  @UseGuards(FanPassAuthGuard)
  @Roles("ADMIN")
  reconcile(
    @Param("paymentId", FanPassIdParamPipe) paymentId: string,
    @Body() body: PaymentOperationDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentSession() session: FanPassSession,
  ) {
    return this.payments.requestPaymentOperation(
      {
        operation: "reconcile",
        paymentId,
        reason: body.reason,
        idempotencyKey,
      },
      session,
    );
  }

  @Post("/webhook")
  @PublicRoute()
  webhook(
    @Req() request: Request & { body: Buffer },
    @Headers("stripe-signature") signature: string | undefined,
  ) {
    return this.payments.handleWebhook(request.body, signature);
  }
}
