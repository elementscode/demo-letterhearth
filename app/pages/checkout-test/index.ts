import { NotFoundError, Request, Response, redirect, session } from "@elements/app";
import { testCheckout } from "#app/shared/stripe";
import { currentSubscriber } from "#app/shared/services/subscribers";
import html from "./template";

/**
 * Stands in for Stripe's hosted checkout in development until a key is set.
 * Gone once STRIPE_SECRET_KEY is added.
 */
export default function route(req: Request, res: Response) {
  if (!testCheckout()) {
    throw new NotFoundError();
  }

  if (session.get("role") === "writer") {
    redirect("/admin");
    return;
  }

  let subscriber = currentSubscriber();

  if (!subscriber) {
    redirect("/signin");
    return;
  }

  if (subscriber.plan === "paid") {
    redirect("/account");
    return;
  }

  return new html({ email: subscriber.email });
}
