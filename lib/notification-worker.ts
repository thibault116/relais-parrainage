import { processEvents, runEmailWorker } from "./email";
import { runPushWorker } from "./push";
export async function runNotificationWorker() {
  try { await processEvents(); } catch { console.error("NOTIFICATION_EVENTS_FAILED"); }
  const [email, push] = await Promise.allSettled([
    runEmailWorker(),
    runPushWorker(),
  ]);
  if (email.status === "rejected") console.error("EMAIL_WORKER_FAILED");
  if (push.status === "rejected") console.error("PUSH_WORKER_FAILED");
  return {
    email: email.status === "fulfilled" ? email.value : { error: true },
    push: push.status === "fulfilled" ? push.value : { error: true },
  };
}
