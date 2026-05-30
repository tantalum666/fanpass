import { Injectable } from "@nestjs/common";
import {
  IssueOwnershipInput,
  OwnershipService,
  RedeemOwnershipInput,
} from "../ownership/ownership.service";

@Injectable()
export class TicketOwnershipSideEffectsService {
  constructor(private readonly ownership: OwnershipService) {}

  issueTicket(input: IssueOwnershipInput) {
    return this.ownership.issueTicket(input);
  }

  redeemTicket(input: RedeemOwnershipInput) {
    return this.ownership.redeemTicket(input);
  }
}
