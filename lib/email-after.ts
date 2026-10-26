import { after } from "next/server";
import { runEmailWorker, emailConfigured } from "./email";
export function sendEmailsAfterResponse() {
  if (emailConfigured())
    after(async () => {
      try {
        await runEmailWorker();
      } catch {
        console.error("EMAIL_WORKER_FAILED");
      }
    });
}
