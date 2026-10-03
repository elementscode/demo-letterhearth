import { Job, sql, tx } from "@elements/app";
import { queuePostEmails } from "#app/jobs/send-post-email";

export interface PublishDuePostsJobFields {}

/**
 * Sends every post whose publish time has come and that has not been sent.
 * Runs every minute from cron, and straight away when a post is published.
 */
export class PublishDuePostsJob extends Job<PublishDuePostsJobFields> {
  run() {
    publishDuePosts();
  }
}

export function publishDuePosts(): number {
  return tx(() => {
    let due = sql<{ id: string }>(`
      update posts set sentAt = now()
       where publishAt is not null and publishAt <= now() and sentAt is null
      returning id
    `).all();

    for (let post of due) {
      let count = queuePostEmails(post.id);
      sql(`update posts set recipientCount = ${count} where id = ${post.id}`);
    }

    return due.length;
  });
}
