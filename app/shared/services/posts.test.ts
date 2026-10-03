import { test, assert, equal, errorf, session, sql, AuthError, ForbiddenError } from "@elements/app";
import {
  excerpt,
  listPublished,
  savePost,
  slugify,
  splitTeaser,
  teaserMarkdown,
} from "#app/shared/services/posts";
import { publishDuePosts } from "#app/jobs/publish-due-posts";
import { unique } from "#app/shared/testing/fixtures";

const BODY = "First paragraph.\n\nSecond paragraph.\n\n## Later\n\nThird paragraph, for paid readers.";

function signInWriter() {
  let user = sql<{ id: string }>(`
    insert into users (email, name, passwordHash)
    values (${unique("writer@test.dev")}, 'Test Writer', crypt('pw', genSalt('bf', 4)))
    returning id
  `).firstOrThrow();

  session.login({ userId: user.id, userName: "Test Writer", role: "writer" });
}

function addSubscriber(email: string, plan: "free" | "paid", emailsEnabled = true) {
  sql(`insert into subscribers (email, plan, emailsEnabled) values (${unique(email)}, ${plan}, ${emailsEnabled})`);
}

/** How many readers take email right now, before a test adds its own. */
function mailingListSize(): number {
  return sql<{ n: number }>(`select count(*)::int as n from subscribers where emailsEnabled`).firstOrThrow().n;
}

test("posts", () => {
  test("the teaser is the first two paragraphs", () => {
    let teaser = teaserMarkdown(BODY);

    assert(teaser.includes("First paragraph."), teaser);
    assert(teaser.includes("Second paragraph."), teaser);
    assert(!teaser.includes("Third paragraph"), teaser);
  });

  test("splitTeaser puts the rest after the paywall", () => {
    let parts = splitTeaser(BODY);

    assert(!parts.teaser.includes("Later"));
    assert(parts.rest.includes("## Later"));
    assert(parts.rest.includes("Third paragraph"));
  });

  test("excerpt strips markdown and shortens", () => {
    equal(excerpt("Some **bold** and [a link](https://x.dev).\n\nMore."), "Some bold and a link.");
    assert(excerpt("word ".repeat(100), 40).endsWith("…"));
  });

  test("slugify", () => {
    equal(slugify("Soup, weekly!"), "soup-weekly");
    equal(slugify("  A loaf -- for people  "), "a-loaf-for-people");
  });

  test("only the writer can save a post", () => {
    let input = { title: "T", slug: "t", body: "b", access: "free" as const };

    try {
      savePost(null, input, null);
      errorf("an anonymous caller saved a post");
    } catch (err) {
      assert(err instanceof AuthError, `got ${err}`);
    }

    let sub = sql<{ id: string }>(`insert into subscribers (email) values (${unique("r@test.dev")}) returning id`).firstOrThrow();
    session.login({ userId: sub.id, userName: "r@test.dev", role: "reader" });

    try {
      savePost(null, input, null);
      errorf("a reader saved a post");
    } catch (err) {
      assert(err instanceof ForbiddenError, `got ${err}`);
    }
  });

  test("a draft is not in the archive and is not sent", () => {
    signInWriter();
    addSubscriber("a@test.dev", "free");

    let post = savePost(null, { title: "Draft", slug: unique("draft"), body: BODY, access: "free" }, null);

    assert(!listPublished().some((p) => p.id === post.id), "a draft reached the archive");
    equal(publishDuePosts(), 0);
  });

  test("publishing now sends to everyone who takes email, once", () => {
    signInWriter();

    let list = mailingListSize();

    addSubscriber("a@test.dev", "free");
    addSubscriber("b@test.dev", "paid");
    addSubscriber("c@test.dev", "free", false);

    let post = savePost(null, { title: "Now", slug: unique("now"), body: BODY, access: "paid" }, "now");

    equal(publishDuePosts(), 1);
    equal(publishDuePosts(), 0, "a sent post is never sent again");

    let row = sql<{ recipientCount: number; sentAt: Date | null }>(
      `select recipientCount, sentAt from posts where id = ${post.id}`,
    ).firstOrThrow();

    equal(row.recipientCount, list + 2);
    assert(row.sentAt !== null);

    let jobs = sql<{ n: number }>(`
      select count(*)::int as n from elements.jobs
      where path like '%SendPostEmailJob' and fields->>'postId' = ${post.id}
    `).firstOrThrow();

    equal(jobs.n, list + 2);

    let published = listPublished();
    equal(published[0].id, post.id, "the new post leads the archive");
  });

  test("a scheduled post waits for its time", () => {
    signInWriter();

    let later = new Date(Date.now() + 60 * 60 * 1000);
    let post = savePost(null, { title: "Later", slug: unique("later"), body: BODY, access: "free" }, later);
    let archived = () => listPublished().some((p) => p.id === post.id);

    equal(publishDuePosts(), 0);
    assert(!archived(), "a scheduled post reached the archive early");

    sql(`update posts set publishAt = now() - interval '1 minute' where id = ${post.id}`);

    equal(publishDuePosts(), 1);
    assert(archived(), "the post did not reach the archive");
  });

  test("a sent post keeps its access and publish time", () => {
    signInWriter();

    let slug = unique("sent");
    let post = savePost(null, { title: "Sent", slug, body: BODY, access: "paid" }, "now");
    publishDuePosts();

    let saved = savePost(post.id, { title: "Sent, edited", slug, body: "new", access: "free" }, null);

    equal(saved.title, "Sent, edited");
    equal(saved.access, "paid");
    assert(saved.publishAt !== null);
  });

  test("two posts cannot share an address", () => {
    signInWriter();
    let slug = unique("same");
    savePost(null, { title: "One", slug, body: "", access: "free" }, null);

    try {
      savePost(null, { title: "Two", slug, body: "", access: "free" }, null);
      errorf("saved a duplicate slug");
    } catch (err: any) {
      assert(err.errors?.slug, `got ${err}`);
    }
  });
});
