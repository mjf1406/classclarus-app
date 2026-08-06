/**
 * Generate JWT_PRIVATE_KEY + JWKS for @convex-dev/auth (self-host bootstrap).
 * Prints JSON: { jwtPrivateKey, jwks }
 */
import { generateKeyPairSync, randomUUID } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicExponent: 0x10001,
});

const pkcs8 = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const jwk = publicKey.export({ format: "jwk" });
jwk.alg = "RS256";
jwk.use = "sig";
jwk.kid = randomUUID();

const jwtPrivateKey = pkcs8.replace(/\n/g, " ");
const jwks = JSON.stringify({ keys: [jwk] });

await Bun.write(Bun.stdout, JSON.stringify({ jwtPrivateKey, jwks }));
