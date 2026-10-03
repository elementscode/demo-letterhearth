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

const BODY = "First paragraph.\n\nSecond paragraph.\n\n## Later\n\nThird paragraph, for paid readers.";

function signInWriter() {
  let user = sql<{ id: string }>(`
    insert into users (email, name, passwordHash)
    values ('writer@test.dev', 'Test Writer', crypt('pw', genSalt('bf', 4)))
    returning id
  `).firstOrThrow();

  session.login({ userId: user.id, userName: "Test Writer", role: "writer" });
}

function addSubscriber(email: string, plan: "free" | "paid", emailsEnabled = true) {
  sql(`insert into subscribers (email, plan, emailsEnabled) values (${email}, ${plan}, ${emailsEnabled})`);
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

    let sub = sql<{ id: string }>(`insert into subscribers (email) values ('r@test.dev') returning id`).firstOrThrow();
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

    savePost(null, { title: "Draft", slug: "draft", body: BODY, access: "free" }, null);

    equal(listPublished().length, 0);
    equal(publishDuePosts(), 0);
  });

  test("publishing now sends to everyone who takes email, once", () => {
    signInWriter();
    addSubscriber("a@test.dev", "free");
    addSubscriber("b@test.dev", "paid");
    addSubscriber("c@test.dev", "free", false);

    let post = savePost(null, { title: "Now", slug: "now", body: BODY, access: "paid" }, "now");

    equal(publishDuePosts(), 1);
    equal(publishDuePosts(), 0, "a sent post is never sent again");

    let row = sql<{ recipientCount: number; sentAt: Date | null }>(
      `select recipientCount, sentAt from posts where id = ${post.id}`,
    ).firstOrThrow();

    equal(row.recipientCount, 2);
    assert(row.sentAt !== null);

    let jobs = sql<{ n: number }>(`
      select count(*)::int as n from elements.jobs
      where path like '%SendPostEmailJob' and fields->>'postId' = ${post.id}
    `).firstOrThrow();

    equal(jobs.n, 2);
    equal(listPublished().map((p) => p.slug), ["now"]);
  });

  test("a scheduled post waits for its time", () => {
    signInWriter();

    let later = new Date(Date.now() + 60 * 60 * 1000);
    let post = savePost(null, { title: "Later", slug: "later", body: BODY, access: "free" }, later);

    equal(publishDuePosts(), 0);
    equal(listPublished().length, 0);

    sql(`update posts set publishAt = now() - interval '1 minute' where id = ${post.id}`);

    equal(publishDuePosts(), 1);
    equal(listPublished().length, 1);
  });

  test("a sent post keeps its access and publish time", () => {
    signInWriter();

    let post = savePost(null, { title: "Sent", slug: "sent", body: BODY, access: "paid" }, "now");
    publishDuePosts();

    let saved = savePost(post.id, { title: "Sent, edited", slug: "sent", body: "new", access: "free" }, null);

    equal(saved.title, "Sent, edited");
    equal(saved.access, "paid");
    assert(saved.publishAt !== null);
  });

  test("two posts cannot share an address", () => {
    signInWriter();
    savePost(null, { title: "One", slug: "same", body: "", access: "free" }, null);

    try {
      savePost(null, { title: "Two", slug: "same", body: "", access: "free" }, null);
      errorf("saved a duplicate slug");
    } catch (err: any) {
      assert(err.errors?.slug, `got ${err}`);
    }
  });
});
