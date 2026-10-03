import { test, assert, equal, sql } from "@elements/app";
import { addPost, fakeRequest, fakeResponse, signInReader } from "#app/shared/testing/fixtures";
import route from "./index";

test("home page", () => {
  test("lists published posts, newest first, and no drafts", () => {
    addPost("older", "free");
    sql(`insert into posts (title, slug, body, access, publishAt) values ('Newer', 'newer', 'x', 'paid', now() - interval '1 hour')`);
    sql(`insert into posts (title, slug, body, access) values ('Draft', 'draft', 'x', 'free')`);
    sql(`insert into posts (title, slug, body, access, publishAt) values ('Soon', 'soon', 'x', 'free', now() + interval '1 day')`);

    let page = (route(fakeRequest(), fakeResponse) as any).attrs;

    equal(page.posts.map((p: any) => p.slug), ["newer", "older"]);
    equal(page.reader, null);
  });

  test("knows a signed-in reader", () => {
    signInReader("home@test.dev", "free");

    let page = (route(fakeRequest(), fakeResponse) as any).attrs;

    equal(page.reader, { email: "home@test.dev", plan: "free" });
  });
});
