import { Request, Response } from "@elements/app";
import { unsubscribeByToken } from "#app/shared/services/subscribers";
import html from "./template";

/**
 * The link at the foot of every email. One click unsubscribes; the page
 * confirms it and offers to undo.
 */
export default function route(req: Request, res: Response) {
  let token = String(req.params.token);
  let result = unsubscribeByToken(token);

  return new html({
    token,
    email: result?.email ?? "",
    paid: result?.plan === "paid",
  });
}
