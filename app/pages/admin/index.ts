import { Request, Response } from "@elements/app";
import { isWriterOrThrow } from "#app/shared/services/auth";
import { subscribers } from "#app/shared/services/subscribers";
import html from "./template";

export default function route(req: Request, res: Response) {
  isWriterOrThrow();

  return new html({ subscribers: subscribers.view() });
}
