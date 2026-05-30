import { BadRequestException } from "@nestjs/common";
import {
  FanPassIdParamPipe,
  GateCodeParamPipe,
} from "../src/common/route-param.pipe";

describe("route parameter validation pipes", () => {
  const idPipe = new FanPassIdParamPipe();
  const gatePipe = new GateCodeParamPipe();

  it("accepts bounded FanPass resource ids", () => {
    expect(idPipe.transform("evt_weekend_demo")).toBe("evt_weekend_demo");
    expect(idPipe.transform("ord-123_ABC")).toBe("ord-123_ABC");
  });

  it("rejects malformed or oversized FanPass resource ids", () => {
    expect(() => idPipe.transform("../evt_weekend_demo")).toThrow(
      BadRequestException,
    );
    expect(() => idPipe.transform("a")).toThrow(BadRequestException);
    expect(() => idPipe.transform(`evt_${"x".repeat(100)}`)).toThrow(
      BadRequestException,
    );
  });

  it("accepts bounded gate codes used by Ops scanner routes", () => {
    expect(gatePipe.transform("A1")).toBe("A1");
    expect(gatePipe.transform("North Gate")).toBe("North Gate");
  });

  it("rejects malformed gate codes without trimming attacker input", () => {
    expect(() => gatePipe.transform(" A1")).toThrow(BadRequestException);
    expect(() => gatePipe.transform("A1/../../admin")).toThrow(
      BadRequestException,
    );
    expect(() => gatePipe.transform("x".repeat(25))).toThrow(
      BadRequestException,
    );
  });
});
