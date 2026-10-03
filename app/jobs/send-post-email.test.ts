import { test, assert, equal, Email } from "@elements/app";
import { postEmailFor } from "#app/jobs/send-post-email";

const POST = {
  title: "The long winter kitchen",
  slug: "the-long-winter-kitchen",
  body: "Opening.\n\nSecond.\n\n## For paid readers\n\nThe secret part.",
  access: "paid" as const,
};

function render(plan: "free" | "paid", access: "free" | "paid" = "paid") {
  let message = postEmailFor({ ...POST, access }, { plan, unsubscribeToken: "tok-123" });
  let email = new Email({ to: "r@test.dev", subject: message.subject, body: message.body });

  return { message, email };
}

test("post email", () => {
  test("a paid post reaches a free reader as a teaser with a link", () => {
    let { message, email } = render("free");

    assert(message.teaser);
    assert(email.html.includes("Opening."));
    assert(!email.html.includes("The secret part."), "the teaser leaked the paid part");
    assert(email.html.includes("/p/the-long-winter-kitchen"));
  });

  test("a paid post reaches a paid reader in full", () => {
    let { message, email } = render("paid");

    assert(!message.teaser);
    assert(email.html.includes("The secret part."));
  });

  test("a free post reaches everyone in full", () => {
    let { email } = render("free", "free");

    assert(email.html.includes("The secret part."));
  });

  test("every post email has an unsubscribe link", () => {
    let { email } = render("free");

    assert(email.html.includes("/unsubscribe/tok-123"));
    equal(email.subject, POST.title);
  });
});
