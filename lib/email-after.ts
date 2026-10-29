import { after } from "next/server";
import { emailConfigured } from "./email";
import { pushConfigured } from "./push";
import { runNotificationWorker } from "./notification-worker";
export function sendEmailsAfterResponse() {
  if (emailConfigured() || pushConfigured())
    after(async () => {
      try {
        await runNotificationWorker();
      } catch {
        console.error("EMAIL_WORKER_FAILED");
      }
    });
}
