import type { NextConfig } from "next";
import { withEve } from "eve/next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {};

export default withEve(withWorkflow(nextConfig), {
  agents: {
    main: ".",
    suggester: "./agents/suggester",
  },
});
