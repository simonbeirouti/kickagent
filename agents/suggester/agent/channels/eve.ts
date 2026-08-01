import { eveChannel } from "eve/channels/eve";
import { jwtHmac, localDev, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [
    jwtHmac({
      algorithm: "HS256",
      audiences: ["eve-internal"],
      issuer: "kickagent",
      secret: process.env.EVE_INTERNAL_AUTH_SECRET!,
    }),
    vercelOidc(),
    localDev(),
  ],
});
