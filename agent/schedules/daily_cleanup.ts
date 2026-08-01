import { defineSchedule } from "eve/schedules";
import { cleanupExpiredData } from "../../lib/cleanup";

export default defineSchedule({
  cron: "17 3 * * *",
  async run() {
    await cleanupExpiredData();
  },
});
