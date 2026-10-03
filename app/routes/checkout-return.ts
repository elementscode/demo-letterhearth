import { Request, Response, redirect } from "@elements/app";
import { fulfillCheckout } from "#app/shared/services/subscribers";

/** Where Stripe sends a reader after checkout. */
export default async function route(req: Request, res: Response) {
  let sessionId = String(req.query.session_id ?? "");

  if (sessionId.startsWith("cs_")) {
    await fulfillCheckout(sessionId);
  }

  redirect("/account?paid=1");
}
