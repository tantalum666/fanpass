const {
  OrderbookHarnessError,
  loadOrderbookHarnessConfig,
  runOrderbookStagingHarness,
} = require("./lib/staging-orderbook-reconnect-harness");

main().catch((error) => {
  const known = error instanceof OrderbookHarnessError;
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      code: known ? error.code : "HARNESS_UNEXPECTED_FAILURE",
      message: known
        ? error.message
        : "The orderbook staging harness failed without exposing internal details.",
      secretsRedacted: true,
    })}\n`,
  );
  process.exitCode = 1;
});

async function main() {
  const config = loadOrderbookHarnessConfig();
  const result = await runOrderbookStagingHarness(config);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
