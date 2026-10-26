![A paid newsletter with card subscriptions, built by Claude Code on Elements: a paid post showing its first two paragraphs fading into a subscribe prompt with free and $8 per month plans.](https://elements.dev/demos/01a0f455-f25d-784c-a9d9-35a5841308ce/poster?v=a22b5b3aa879)

# A paid newsletter with card subscriptions, built by Claude Code on Elements

> Letterhearth is a full-stack app built with Claude Code on Elements.

Free or $8 per month subscriptions by card, a teaser on paid posts, and markdown posts the writer schedules and emails.

[Run this app on your machine](https://elements.dev/demos/01a0f455-f25d-784c-a9d9-35a5841308ce). Use this demo as inspiration, or as the starting point for your own app. Your agent creates a new app with this one as the scaffold, and you prompt it to add whatever features you want.

## Payments

Paid subscriptions go through Stripe Checkout in subscription mode. Without a
key, payments run through the app's built-in test checkout: the paid plan
button opens an order summary with a Pay button, and paying records the
subscription through the same code a Stripe payment uses, so the paid welcome
email, the unlocked posts and the writer's live revenue all work. For real
Stripe Checkout, create a free sandbox at
[dashboard.stripe.com/register](https://dashboard.stripe.com/register) and add
its secret key as `STRIPE_SECRET_KEY` in `config/env/development.env`. Test
with card 4242 4242 4242 4242, any future date and any CVC. Production
requires the key, and the app registers its own Stripe webhook on the first
checkout.

## How it's built

Letterhearth needed free and paid subscriptions billed monthly by card, scheduled posts that go out by email, a teaser for readers who are not paying, one-click unsubscribe, and live counts for the writer. Each of those is a part of Elements, so the agent spent its 22 minutes on the newsletter itself.

- **Live counts and revenue.** Subscribers are a LiveTable, so the writer's free and paid counts and monthly revenue move the moment a reader subscribes or upgrades.

- **Monthly subscriptions.** Subscribing, upgrading and cancelling are `@rpc` calls, and paid plans go through Stripe at $8 per month. The return page and Stripe's webhook record a new subscription once. Until a Stripe key is added, a built-in test checkout takes the payment through the same code, and in production the app registers its own webhook.

- **Posts on a schedule.** A cron schedule checks every minute for posts whose time has come and queues one email job per reader, so a failed send retries alone. Paid posts go in full to paid readers and as a teaser to everyone else.

- **One-click unsubscribe.** Every email carries the headers mail clients turn into an unsubscribe button, and the app answers that button directly.

- **Data from SQL files.** Migrations define the newsletter and seed the writer, six posts (three paid), five free readers and three on complimentary paid plans.

- **Sessions for readers and the writer.** Readers are signed in when they subscribe and later by an emailed link, and every writer page shares one guard on the writer's role.

## Why Elements

Elements is an integrated full-stack app framework and a project server. The project server checks the agent's work as it builds: it type-checks the server and browser code, analyzes the program, applies migrations and runs the tests, then reports the results to the agent. A security mistake, such as calling a server-only function from the browser, is a compile error. The agent reads the report and fixes its own mistakes before it tells you a feature is done. The same checks run on every feature you ask for next.
