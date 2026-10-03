import { Request, Response } from "@elements/app";
import { isWriterOrThrow } from "#app/shared/services/auth";
import { getById, Post } from "#app/shared/services/posts";
import { audience } from "#app/shared/services/subscribers";
import html from "./template";

export default function route(req: Request, res: Response) {
  isWriterOrThrow();

  let post: Post | null = req.params.id === "new" ? null : getById(req.params.id);

  return new html({ post, audience: audience() });
}
