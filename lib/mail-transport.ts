import nodemailer from "nodemailer";
import { MAIL_FROM } from "./email-templates";

export const emailConfigured = () => !!process.env.GMAIL_APP_PASSWORD;
export function createMailTransport() {
  if (!emailConfigured()) throw Error("Envoi des e-mails indisponible.");
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: MAIL_FROM, pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s/g, "") },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}
