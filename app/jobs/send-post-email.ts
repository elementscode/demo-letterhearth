import { Job, email, sql } from "@elements/app";
import PostEmail from "#app/emails/post";
import { getById, renderMarkdown, teaserMarkdown } from "#app/shared/services/posts";
import { getSubscriber, unsubscribeHeaders } from "#app/shared/services/subscribers";

export interface SendPostEmailJobFields {
  postId: string;
  subscriberId: string;
}

/**
 * Sends one post to one subscriber. One job per recipient, so a failed send
 * retries alone and a retry never mails anyone twice.
 */
export class SendPostEmailJob extends Job<SendPostEmailJobFields> {
  static maxAttempts = 5;

  run() {
    let subscriber = getSubscriber(this.fields.subscriberId);

    if (!subscriber || !subscriber.emailsEnabled) {
      return;
    }

    let post = getById(this.fields.postId);
    let message = postEmailFor(post, subscriber);

    email({
      to: subscriber.email,
      subject: message.subject,
      body: message.body,
      headers: unsubscribeHeaders(subscriber),
    });
  }
}

/**
 * What a subscriber receives for a post: the whole thing, unless it is paid
 * and they are not.
 */
export function postEmailFor(
  post: { title: string; slug: string; body: string; access: "free" | "paid" },
  subscriber: { plan: "free" | "paid"; unsubscribeToken: string },
) {
  let teaser = post.access === "paid" && subscriber.plan !== "paid";
  let markdown = teaser ? teaserMarkdown(post.body) : post.body;

  return {
    teaser,
    subject: post.title,
    body: new PostEmail({
      title: post.title,
      html: renderMarkdown(markdown),
      paid: post.access === "paid",
      teaser,
      postUrl: `/p/${post.slug}`,
      unsubscribeUrl: `/unsubscribe/${subscriber.unsubscribeToken}`,
    }),
  };
}

/** Queues a post's emails to every subscriber who takes email. */
export function queuePostEmails(postId: string): number {
  let recipients = sql<{ id: string }>(`select id from subscribers where emailsEnabled`).all();

  for (let r of recipients) {
    new SendPostEmailJob({ postId, subscriberId: r.id }).schedule({
      idempotencyKey: `post:${postId}:${r.id}`,
    });
  }

  return recipients.length;
}
