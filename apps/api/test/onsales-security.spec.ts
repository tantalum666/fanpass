import { ConfigService } from "@nestjs/config";
import { OnsalesService } from "../src/modules/onsales/onsales.service";

describe("OnsalesService production security boundary", () => {
  it("fails closed before trusting a caller-chosen installation ID", async () => {
    const service = new OnsalesService(
      new ConfigService({
        FANPASS_DATA_SOURCE: "prisma",
        FANPASS_ENV: "staging",
      }),
      {} as never,
      {} as never,
    );

    await expect(
      service.joinQueue(
        "evt_security_boundary",
        "usr_security_boundary",
        "caller_rotated_installation_id",
      ),
    ).rejects.toThrow(
      "High-demand queue access is unavailable until device attestation is enabled",
    );
  });
});
