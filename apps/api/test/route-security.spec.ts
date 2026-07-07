import "reflect-metadata";
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { AppController } from "../src/app.controller";
import {
  FANPASS_PUBLIC_ROUTE_KEY,
  FANPASS_ROLES_KEY,
} from "../src/common/auth.decorators";
import { FanPassAuthGuard } from "../src/common/fanpass-auth.guard";
import { AlphaController } from "../src/modules/alpha/alpha.controller";
import { AuthController } from "../src/modules/auth/auth.controller";
import { EventsController } from "../src/modules/events/events.controller";
import { FanAccessController } from "../src/modules/fan-access/fan-access.controller";
import { OrdersController } from "../src/modules/orders/orders.controller";
import { PaymentsController } from "../src/modules/payments/payments.controller";
import { TicketsController } from "../src/modules/tickets/tickets.controller";
import { VerificationController } from "../src/modules/verification/verification.controller";
import { WalletController } from "../src/modules/wallet/wallet.controller";

const controllers = [
  AppController,
  AlphaController,
  AuthController,
  EventsController,
  FanAccessController,
  OrdersController,
  PaymentsController,
  TicketsController,
  VerificationController,
  WalletController,
];

const expectedAccessByHandler = new Map<string, "PUBLIC" | string[]>([
  ["AppController.health", "PUBLIC"],
  ["AppController.resetPrototype", ["ORGANIZER", "ADMIN"]],
  ["AlphaController.persistenceStatus", ["ORGANIZER", "ADMIN"]],
  ["AlphaController.operationsSnapshot", ["ORGANIZER", "ADMIN"]],
  ["AlphaController.sideEffectHealthStatus", ["ADMIN"]],
  ["AlphaController.createEvent", ["ORGANIZER", "ADMIN"]],
  ["AlphaController.createTicketType", ["ORGANIZER", "ADMIN"]],
  ["AlphaController.createGateAssignment", ["ORGANIZER", "ADMIN"]],
  ["AlphaController.deactivateGateAssignment", ["ORGANIZER", "ADMIN"]],
  ["AlphaController.rotateStaffInvite", ["ORGANIZER", "ADMIN"]],
  ["AuthController.register", "PUBLIC"],
  ["AuthController.login", "PUBLIC"],
  ["AuthController.demoSession", "PUBLIC"],
  ["AuthController.syncPrivyUser", "PUBLIC"],
  ["AuthController.acceptStaffInvite", "PUBLIC"],
  ["EventsController.listEvents", "PUBLIC"],
  ["EventsController.getEvent", "PUBLIC"],
  ["EventsController.createEvent", ["ORGANIZER", "ADMIN"]],
  ["EventsController.createTicketType", ["ORGANIZER", "ADMIN"]],
  ["FanAccessController.listTasks", "PUBLIC"],
  ["FanAccessController.submitTask", ["FAN", "ADMIN"]],
  ["FanAccessController.getScore", ["FAN", "ORGANIZER", "ADMIN"]],
  ["OrdersController.getOrderbook", "PUBLIC"],
  ["OrdersController.listUserOrders", ["FAN", "ADMIN"]],
  ["OrdersController.createOrder", ["FAN", "ADMIN"]],
  ["OrdersController.matchOrder", ["ADMIN"]],
  ["OrdersController.cancelOrder", ["FAN", "ADMIN"]],
  ["PaymentsController.createPaymentIntent", ["FAN", "ADMIN"]],
  ["PaymentsController.createCryptoQuote", ["FAN", "ADMIN"]],
  ["PaymentsController.confirmCryptoPayment", ["FAN", "ADMIN"]],
  ["PaymentsController.sendSponsoredCryptoPayment", ["FAN", "ADMIN"]],
  ["PaymentsController.cancelAuthorization", ["ADMIN"]],
  ["PaymentsController.refund", ["ADMIN"]],
  ["PaymentsController.reconcile", ["ADMIN"]],
  ["PaymentsController.webhook", "PUBLIC"],
  ["TicketsController.listTickets", ["ORGANIZER", "ADMIN"]],
  ["TicketsController.listOwnedTickets", ["FAN", "ORGANIZER", "ADMIN"]],
  ["TicketsController.issueTicket", ["ORGANIZER", "ADMIN"]],
  ["TicketsController.getProofHistory", ["FAN", "ORGANIZER", "ADMIN"]],
  ["TicketsController.getChainProof", ["FAN", "ORGANIZER", "ADMIN"]],
  ["TicketsController.getTicket", ["FAN", "ORGANIZER", "ADMIN"]],
  ["VerificationController.generateQr", ["FAN", "ADMIN"]],
  ["VerificationController.redeem", ["GATE_STAFF", "ADMIN"]],
  ["VerificationController.validateNfc", ["GATE_STAFF", "ADMIN"]],
  [
    "VerificationController.checkinSummary",
    ["GATE_STAFF", "ORGANIZER", "ADMIN"],
  ],
  ["VerificationController.recentCheckins", ["GATE_STAFF", "ADMIN"]],
  ["VerificationController.generateTicketQr", ["FAN", "ADMIN"]],
  ["WalletController.balances", ["FAN", "ADMIN"]],
]);

describe("controller route security coverage", () => {
  it("requires every route to be explicitly public or guarded with FanPass roles", () => {
    const uncovered = controllers.flatMap((controller) => {
      return getRouteHandlers(controller).flatMap(
        ({ handlerName, handler }) => {
          const isPublic = getMetadata<boolean>(
            FANPASS_PUBLIC_ROUTE_KEY,
            handler,
            controller,
          );
          const roles =
            getMetadata<string[]>(FANPASS_ROLES_KEY, handler, controller) ?? [];
          const guards =
            getMetadata<unknown[]>(GUARDS_METADATA, handler, controller) ?? [];
          const hasFanPassGuard = guards.includes(FanPassAuthGuard);

          if (isPublic || (hasFanPassGuard && roles.length > 0)) {
            return [];
          }

          return [`${controller.name}.${handlerName}`];
        },
      );
    });

    expect(uncovered).toEqual([]);
  });

  it("keeps the explicit route role matrix from drifting", () => {
    const actualAccessByHandler = new Map<string, "PUBLIC" | string[]>();
    for (const controller of controllers) {
      for (const { handlerName, handler } of getRouteHandlers(controller)) {
        const key = `${controller.name}.${handlerName}`;
        const isPublic = getMetadata<boolean>(
          FANPASS_PUBLIC_ROUTE_KEY,
          handler,
          controller,
        );
        const roles =
          getMetadata<string[]>(FANPASS_ROLES_KEY, handler, controller) ?? [];
        actualAccessByHandler.set(key, isPublic ? "PUBLIC" : roles);
      }
    }

    expect([...actualAccessByHandler.keys()].sort()).toEqual(
      [...expectedAccessByHandler.keys()].sort(),
    );

    for (const [key, expectedAccess] of expectedAccessByHandler) {
      expect(actualAccessByHandler.get(key)).toEqual(expectedAccess);
    }
  });
});

function getRouteHandlers(controller: Function) {
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype)
    .filter((propertyName) => propertyName !== "constructor")
    .map((propertyName) => ({
      handlerName: propertyName,
      handler: prototype[propertyName],
    }))
    .filter(({ handler }) => {
      return (
        typeof handler === "function" &&
        Reflect.getMetadata(PATH_METADATA, handler) !== undefined &&
        Reflect.getMetadata(METHOD_METADATA, handler) !== undefined
      );
    });
}

function getMetadata<T>(key: string, handler: unknown, controller: Function) {
  return (
    Reflect.getMetadata(key, handler as object) ??
    Reflect.getMetadata(key, controller)
  );
}
