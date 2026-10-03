import { Request, Response } from "@elements/app";
import { unsubscribeByToken } from "#app/shared/services/subscribers";

/**
 * RFC 8058 one-click unsubscribe: the POST a mail client sends from its own
 * unsubscribe button, using the List-Unsubscribe header.
 */
export default function route(req: Request, res: Response) {
  unsubscribeByToken(String(req.params.token));

  return "ok";
}
