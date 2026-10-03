import { Request, Response, redirect, session } from "@elements/app";
import html from "./template";

export default function route(req: Request, res: Response) {
  if (session.isLoggedIn()) {
    redirect(session.get("role") === "writer" ? "/admin" : "/account");
    return;
  }

  return new html({ expired: req.query.expired === "1" });
}
