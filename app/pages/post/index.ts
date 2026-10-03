import { Request, Response } from "@elements/app";
import { isWriter } from "#app/shared/services/auth";
import { getPublishedBySlug, renderMarkdown, teaserMarkdown } from "#app/shared/services/posts";
import { currentSubscriber } from "#app/shared/services/subscribers";
import html from "./template";

export default function route(req: Request, res: Response) {
  let post = getPublishedBySlug(req.params.slug);
  let subscriber = currentSubscriber();
  let locked = post.access === "paid" && subscriber?.plan !== "paid" && !isWriter();

  return new html({
    post: {
      title: post.title,
      slug: post.slug,
      access: post.access,
      publishAt: post.publishAt!,
    },
    html: renderMarkdown(locked ? teaserMarkdown(post.body) : post.body),
    locked,
    reader: subscriber ? { email: subscriber.email, plan: subscriber.plan } : null,
  });
}
