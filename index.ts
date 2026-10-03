import { App, getEnv, redirect } from "@elements/app";
import config from "#config";
import home from "#app/pages/home";
import post from "#app/pages/post";
import signin from "#app/pages/signin";
import account from "#app/pages/account";
import unsubscribe from "#app/pages/unsubscribe";
import admin from "#app/pages/admin";
import adminPosts from "#app/pages/admin-posts";
import adminPostEdit from "#app/pages/admin-post-edit";
import checkoutTest from "#app/pages/checkout-test";
import signinLink from "#app/routes/signin-link";
import unsubscribePost from "#app/routes/unsubscribe-post";
import checkoutReturn from "#app/routes/checkout-return";
import stripeWebhook from "#app/routes/stripe-webhook";
import notFound from "#app/pages/errors/not-found";
import unhandled from "#app/pages/errors/unhandled";
import { PublishDuePostsJob } from "#app/jobs/publish-due-posts";
import { ExpireCompPlansJob } from "#app/jobs/expire-comp-plans";
import { stripeConfigured } from "#app/shared/stripe";

if (getEnv() === "production" && !stripeConfigured()) {
  throw new Error("STRIPE_SECRET_KEY is required in production.");
}

const app = new App();

// Readers
app.route("/", home);
app.route("/p/:slug", post);
app.route("/signin", signin);
app.route("/signin/:token", signinLink);
app.route("/account", account);
app.route({ method: "get", path: "/unsubscribe/:token", handler: unsubscribe });
app.route({ method: "post", path: "/unsubscribe/:token", handler: unsubscribePost });

// The writer
app.route("/admin", admin);
app.route("/admin/posts", adminPosts);
app.route("/admin/posts/:id", adminPostEdit);

// Stripe
app.route("/checkout/test", checkoutTest);
app.route("/checkout/return", checkoutReturn);
app.route({ method: "post", path: "/stripe/webhook", handler: stripeWebhook });

// Scheduled posts go out within a minute of their publish time.
app.cron("every 1m", "publish due posts", () => new PublishDuePostsJob({}).schedule());
app.cron("every day at 3am", "expire complimentary plans", () => new ExpireCompPlansJob({}).schedule());

app.error((req, res, err) => {
  switch (err.statusCode) {
    case 401:
    case 403:
      return redirect("/signin");

    case 404:
      return notFound(req, res, err);

    default:
      return unhandled(req, res, err);
  }
});

app.start(config);
