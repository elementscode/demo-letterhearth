import { Request, Response } from "@elements/app";
import { isWriterOrThrow } from "#app/shared/services/auth";
import { listAll } from "#app/shared/services/posts";
import html from "./template";

export default function route(req: Request, res: Response) {
  isWriterOrThrow();

  return new html({
    posts: listAll().map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      access: p.access,
      publishAt: p.publishAt,
      sentAt: p.sentAt,
      recipientCount: p.recipientCount,
    })),
    done: String(req.query.done ?? ""),
  });
}
