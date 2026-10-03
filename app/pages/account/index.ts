import { Request, Response, redirect, session } from "@elements/app";
import { accountView, currentSubscriber } from "#app/shared/services/subscribers";
import html from "./template";

export default function route(req: Request, res: Response) {
  if (session.get("role") === "writer") {
    redirect("/admin");
    return;
  }

  let subscriber = currentSubscriber();

  if (!subscriber) {
    redirect("/signin");
    return;
  }

  return new html({
    initial: accountView(subscriber),
    paidNotice: req.query.paid === "1" ? (subscriber.plan === "paid" ? "paid" : "processing") : "",
  });
}
