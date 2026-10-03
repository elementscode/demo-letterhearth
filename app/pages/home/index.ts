import { Request, Response } from "@elements/app";
import { listPublished } from "#app/shared/services/posts";
import { currentSubscriber } from "#app/shared/services/subscribers";
import html from "./template";

export default function route(req: Request, res: Response) {
  let subscriber = currentSubscriber();

  return new html({
    posts: listPublished(),
    reader: subscriber ? { email: subscriber.email, plan: subscriber.plan } : null,
  });
}
