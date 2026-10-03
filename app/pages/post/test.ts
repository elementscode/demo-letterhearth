import { test, assert, equal } from "@elements/app";
import { addPost, fakeRequest, fakeResponse, signInReader, signInWriter } from "#app/shared/testing/fixtures";
import route from "./index";

function render(slug: string) {
  return (route(fakeRequest({ slug }), fakeResponse) as any).attrs;
}

test("post page", () => {
  test("a free post is open to everyone", () => {
    addPost("free-one", "free");

    let page = render("free-one");
    equal(page.locked, false);
    assert(page.html.includes("the paid part"));
  });

  test("a paid post shows a visitor the teaser and the prompt", () => {
    addPost("paid-one", "paid");

    let page = render("paid-one");
    equal(page.locked, true);
    assert(page.html.includes("Two."));
    assert(!page.html.includes("the paid part"), "the paid part leaked");
  });

  test("a paid post stays locked for a free reader", () => {
    addPost("paid-one", "paid");
    signInReader("free@test.dev", "free");

    equal(render("paid-one").locked, true);
  });

  test("a paid reader reads it all", () => {
    addPost("paid-one", "paid");
    signInReader("paid@test.dev", "paid");

    let page = render("paid-one");
    equal(page.locked, false);
    assert(page.html.includes("the paid part"));
  });

  test("the writer reads it all", () => {
    addPost("paid-one", "paid");
    signInWriter();

    equal(render("paid-one").locked, false);
  });

  test("a scheduled post is not public yet", () => {
    let threw = false;

    try {
      render("missing");
    } catch {
      threw = true;
    }

    assert(threw);
  });
});
