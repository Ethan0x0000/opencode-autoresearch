// @bun
// src/cli.ts
async function main(args) {
  console.log("opencode-autoresearch CLI");
  return 0;
}
if (import.meta.main) {
  const result = await main(process.argv.slice(2));
  process.exit(result);
}
export {
  main
};
