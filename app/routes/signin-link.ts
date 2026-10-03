import { Request, Response, redirect } from "@elements/app";
import { consumeSigninToken } from "#app/shared/services/subscribers";

/** An emailed sign-in link: signs the reader in and sends them to their account. */
export default function route(req: Request, res: Response) {
  redirect(consumeSigninToken(req.params.token) ? "/account" : "/signin?expired=1");
}
