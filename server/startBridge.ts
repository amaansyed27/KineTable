import { createLocalBridge, newBridgeToken } from "./localBridge.js";

const token = newBridgeToken();
const origins = ["http://127.0.0.1:5173", "http://localhost:5173"];
if (process.env.KINETABLE_BRIDGE_ORIGIN) origins.push(new URL(process.env.KINETABLE_BRIDGE_ORIGIN).origin);
createLocalBridge({ token, origins }).listen(46837, "127.0.0.1", () => {
  process.stdout.write("Kinetable Local Bridge listening on 127.0.0.1:46837\n");
  process.stdout.write(`Bridge token (paste into provider settings): ${token}\n`);
});
