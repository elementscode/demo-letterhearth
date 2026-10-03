import { sql, tx, ValidationError, NotFoundError } from "@elements/app";
import { marked } from "marked";
import { isWriterOrThrow } from "#app/shared/services/auth";
import { PublishDuePostsJob } from "#app/jobs/publish-due-posts";

export type Access = "free" | "paid";

export interface Post {
  id: string;
  updatedAt: Date;
  title: string;
  slug: string;
  body: string;
  access: Access;
  publishAt: Date | null;
  sentAt: Date | null;
  recipientCount: number;
}

export interface PostInput {
  title: string;
  slug: string;
  body: string;
  access: Access;
}

/** What the archive shows for each post. */
export interface PostSummary {
  id: string;
  title: string;
  slug: string;
  access: Access;
  publishAt: Date;
  excerpt: string;
}

/** How many paragraphs of a paid post a reader who is not paying sees. */
export const TEASER_PARAGRAPHS = 2;


export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

/**
 * The opening of a post: every block up to and including its first
 * TEASER_PARAGRAPHS paragraphs, as markdown.
 */
export function teaserMarkdown(markdown: string, paragraphs = TEASER_PARAGRAPHS): string {
  let out = "";
  let seen = 0;

  for (let token of marked.lexer(markdown)) {
    if (seen >= paragraphs) {
      break;
    }

    out += token.raw;

    if (token.type === "paragraph") {
      seen++;
    }
  }

  return out.trim();
}

/** The first paragraph as plain text, for the archive. */
export function excerpt(markdown: string, max = 220): string {
  let first = marked.lexer(markdown).find((t) => t.type === "paragraph");
  let text = (first?.raw ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= max) {
    return text;
  }

  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 80);
}

export function listPublished(): PostSummary[] {
  let rows = sql<Post>(`
    select id, updatedAt, title, slug, body, access, publishAt, sentAt, recipientCount from posts
    where publishAt is not null and publishAt <= now()
    order by publishAt desc
  `).all();

  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    access: p.access,
    publishAt: p.publishAt!,
    excerpt: excerpt(p.body),
  }));
}

export function getPublishedBySlug(slug: string): Post {
  return sql<Post>(`
    select id, updatedAt, title, slug, body, access, publishAt, sentAt, recipientCount from posts
    where slug = ${slug} and publishAt is not null and publishAt <= now()
  `).firstOrThrow("post not found");
}

export function listAll(): Post[] {
  return sql<Post>(`
    select id, updatedAt, title, slug, body, access, publishAt, sentAt, recipientCount from posts
    order by coalesce(publishAt, updatedAt) desc
  `).all();
}

export function getById(id: string): Post {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new NotFoundError("post not found");
  }

  return sql<Post>(`select id, updatedAt, title, slug, body, access, publishAt, sentAt, recipientCount from posts where id = ${id}`).firstOrThrow("post not found");
}

function checkInput(input: PostInput) {
  if (input.title.trim() === "") {
    throw new ValidationError({ title: ["give the post a title"] });
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)) {
    throw new ValidationError({ slug: ["use lowercase letters, numbers and dashes"] });
  }

  if (input.access !== "free" && input.access !== "paid") {
    throw new ValidationError({ access: ["choose free or paid"] });
  }

  let taken = sql<{ id: string }>(`select id from posts where slug = ${input.slug}`).first();

  return taken?.id;
}

/** When a save publishes: never (a draft), right away, or at a set time. */
export type PublishWhen = null | "now" | Date;

/**
 * Saves a post. `when` null keeps it a draft; "now" publishes it on the
 * server's clock and its emails go out right away; a Date schedules it. A post
 * that has been sent keeps its publish time and access.
 *
 * @rpc
 */
export function savePost(id: string | null, input: PostInput, when: PublishWhen): Post {
  isWriterOrThrow();

  let takenBy = checkInput(input);

  if (takenBy && takenBy !== id) {
    throw new ValidationError({ slug: ["another post already uses this address"] });
  }

  if (when instanceof Date && when <= new Date()) {
    throw new ValidationError("choose a time in the future to schedule this post");
  }

  let now = when === "now";
  let at = when instanceof Date ? when : null;

  return tx(() => {
    let post: Post;

    if (id) {
      let current = getById(id);
      let sent = current.sentAt !== null;

      post = sql<Post>(`
        update posts
           set title = ${input.title.trim()}, slug = ${input.slug}, body = ${input.body},
               access = ${sent ? current.access : input.access},
               publishAt = case when ${sent} then publishAt when ${now} then now() else ${at}::timestamptz end
         where id = ${id}
        returning id, updatedAt, title, slug, body, access, publishAt, sentAt, recipientCount
      `).firstOrThrow("post not found");
    } else {
      post = sql<Post>(`
        insert into posts (title, slug, body, access, publishAt)
        values (${input.title.trim()}, ${input.slug}, ${input.body}, ${input.access},
                case when ${now} then now() else ${at}::timestamptz end)
        returning id, updatedAt, title, slug, body, access, publishAt, sentAt, recipientCount
      `).firstOrThrow();
    }

    if (now && !post.sentAt) {
      new PublishDuePostsJob({}).schedule();
    }

    return post;
  });
}

/** @rpc */
export function deletePost(id: string) {
  isWriterOrThrow();

  sql(`delete from posts where id = ${id} and sentAt is null`);
}

/** A post split where the paywall falls: the teaser, and everything after it. */
export function splitTeaser(markdown: string): { teaser: string; rest: string } {
  let tokens = marked.lexer(markdown);
  let teaser = "";
  let rest = "";
  let seen = 0;

  for (let token of tokens) {
    if (seen < TEASER_PARAGRAPHS) {
      teaser += token.raw;

      if (token.type === "paragraph") {
        seen++;
      }
    } else {
      rest += token.raw;
    }
  }

  return { teaser, rest };
}
