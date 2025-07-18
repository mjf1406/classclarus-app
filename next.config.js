// next.config.js
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // allow any host
        port: "",
        pathname: "/**", // allow any path
      },
    ],
  },
};

export default config;
