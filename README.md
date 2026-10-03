![Letterhearth, a paid newsletter built with Elements: a paid post showing its first two paragraphs fading into a subscribe prompt with free and $8 a month plans.](https://elements.dev/demos/01a0f455-f25d-784c-a9d9-35a5841308ce/poster?v=a22b5b3aa879)

# Letterhearth

> A demo app built with [Elements](https://elements.dev).

Free or $8 a month subscriptions by card, a teaser on paid posts, and markdown posts the writer schedules and emails.

**Demo:** [Letterhearth](https://elements.dev/demos/01a0f455-f25d-784c-a9d9-35a5841308ce)

## Agent specs

- **Agent:** Claude Code, Opus 5.5 Medium
- **Time:** 22 min
- **Cost:** $7.74 at API rates, September 2026

## Get started

```bash
elements create letterhearth -scaffold=elementscode/demo-letterhearth
```

## Seed data and demo accounts

The seed creates the writer, Maren Holt, six published posts (three free,
three paid), five free subscribers and three paid ones. The paid subscribers
are on complimentary plans with no Stripe subscription behind them, so the
dashboard shows $24 a month before anyone pays.

| Account                  | Password        | Role       |
| ------------------------ | --------------- | ---------- |
| maren@letterhearth.com   | `hearth-writer` | the writer |

The sign-in page shows this login and a button that fills it in. Readers have
no password: they are signed in when they subscribe, and after that they sign
in with an emailed link. In development, emails are written to
`.elements/logs/job.log` instead of being sent.

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

### What Elements gave the app

- **Live counts and revenue.** Subscribers are a LiveTable, so the writer's free and paid counts and monthly revenue move the moment a reader subscribes or upgrades.

- **Monthly subscriptions.** Subscribing, upgrading and cancelling are `@rpc` calls, and paid plans go through Stripe at $8 a month. The return page and Stripe's webhook record a new subscription once. Until a Stripe key is added, a built-in test checkout takes the payment through the same code, and in production the app registers its own webhook.

- **Posts on a schedule.** A cron schedule checks every minute for posts whose time has come and queues one email job per reader, so a failed send retries alone. Paid posts go in full to paid readers and as a teaser to everyone else.

- **One-click unsubscribe.** Every email carries the headers mail clients turn into an unsubscribe button, and the app answers that button directly.

- **Data from SQL files.** Migrations define the newsletter and seed the writer, six posts (three paid), five free readers and three on complimentary paid plans.

- **Sessions for readers and the writer.** Readers are signed in when they subscribe and later by an emailed link, and every writer page shares one guard on the writer's role.

### What the project server gave the agent

The project server runs alongside the agent and answers as soon as a file is saved: it type-checks the templates, TypeScript and SQL, applies migrations and reruns the tests, so every question came back right away and the agent kept building.

### What shipped

The app type-checks with zero errors and all 57 tests pass. Every page works on desktop and phone. A real sandbox payment went through Stripe end to end.

**Demo:** [Letterhearth](https://elements.dev/demos/01a0f455-f25d-784c-a9d9-35a5841308ce)

## License

MIT. See [LICENSE](LICENSE).
