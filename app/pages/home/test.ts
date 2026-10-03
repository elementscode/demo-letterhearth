import { test, assert, equal, sql } from "@elements/app";
import { addPost, fakeRequest, fakeResponse, signInReader, unique } from "#app/shared/testing/fixtures";
import route from "./index";

test("home page", () => {
  test("lists published posts, newest first, and no drafts", () => {
    let older = addPost("older", "free");
    let newer = unique("newer");
    let draft = unique("draft");
    let soon = unique("soon");
    sql(`insert into posts (title, slug, body, access, publishAt) values ('Newer', ${newer}, 'x', 'paid', now() - interval '1 hour')`);
    sql(`insert into posts (title, slug, body, access) values ('Draft', ${draft}, 'x', 'free')`);
    sql(`insert into posts (title, slug, body, access, publishAt) values ('Soon', ${soon}, 'x', 'free', now() + interval '1 day')`);

    let page = (route(fakeRequest(), fakeResponse) as any).attrs;
    let mine = [older, newer, draft, soon];

    equal(page.posts.map((p: any) => p.slug).filter((s: string) => mine.includes(s)), [newer, older]);
    equal(page.reader, null);
  });

  test("knows a signed-in reader", () => {
    let sub = signInReader("home@test.dev", "free");

    let page = (route(fakeRequest(), fakeResponse) as any).attrs;

    equal(page.reader, { email: sub.email, plan: "free" });
  });
});
