-- The writer. Sign in at /signin with maren@letterhearth.com / hearth-writer.
insert into users (email, name, passwordHash) values
  ('maren@letterhearth.com', 'Maren Holt', crypt('hearth-writer', genSalt('bf', 12)));

-- Five free readers.
insert into subscribers (email, plan, createdAt) values
  ('ada.lindqvist@example.com', 'free', now() - interval '40 days'),
  ('tomas.reyes@example.com', 'free', now() - interval '33 days'),
  ('priya.natarajan@example.com', 'free', now() - interval '26 days'),
  ('owen.byrne@example.com', 'free', now() - interval '19 days'),
  ('hana.sato@example.com', 'free', now() - interval '12 days');

-- Three paid readers on complimentary plans: no Stripe subscription behind them,
-- so cancelling one downgrades it in the app without a Stripe call.
insert into subscribers (email, plan, subscriptionStatus, paidSince, currentPeriodEnd, createdAt) values
  ('june.okafor@example.com', 'paid', 'active', now() - interval '30 days', now() + interval '8 days', now() - interval '38 days'),
  ('felix.brandt@example.com', 'paid', 'active', now() - interval '22 days', now() + interval '16 days', now() - interval '29 days'),
  ('rosa.moretti@example.com', 'paid', 'active', now() - interval '14 days', now() + interval '24 days', now() - interval '20 days');

-- Six posts, already published and sent.
insert into posts (title, slug, access, body, publishAt, sentAt, recipientCount) values
  ('The kettle is always on', 'the-kettle-is-always-on', 'free', 'Every house I have loved had one thing in common: somebody kept the kettle on. Not as a gesture, and not for guests. It was simply warm, all day, on the back of the stove, ready for whoever came through the door with cold hands.

This newsletter is my attempt at the same thing. Once or twice a week I will write to you about the kitchen, the garden, and the slow work of keeping a home. Some letters will be recipes. Some will be about my grandmother. A few will be about nothing at all.

## What to expect

- Letters on Tuesdays, and sometimes on Fridays
- Recipes that work in a small kitchen with ordinary pans
- The occasional long essay, for paying readers

Thank you for being here. Pull up a chair.', now() - interval '42 days', now() - interval '42 days', 8);

insert into posts (title, slug, access, body, publishAt, sentAt, recipientCount) values
  ('A loaf for people who are afraid of bread', 'a-loaf-for-people-afraid-of-bread', 'free', 'I taught my neighbour to bake bread last winter. She had tried three times and failed three times, and she told me, very seriously, that she believed she had cold hands.

She did not have cold hands. She had a recipe that asked her to knead for fifteen minutes, judge the dough by feel, and wait for it to double in a kitchen that never got above sixteen degrees.

So here is the loaf I gave her instead. It needs no kneading and no feel. It needs a bowl, a spoon, and a night.

## The loaf

1. Stir 500g flour, 10g salt, and 2g yeast in a large bowl.
2. Add 380g cool water and stir until no dry flour remains.
3. Cover and leave it on the counter overnight, twelve to eighteen hours.
4. Tip it onto a floured board, fold it over itself a few times, and let it sit while the oven heats to 240C with a lidded pot inside.
5. Bake 30 minutes with the lid on, then 15 with it off.

She has made it every week since. Her hands, she reports, are fine.', now() - interval '35 days', now() - interval '35 days', 8);

insert into posts (title, slug, access, body, publishAt, sentAt, recipientCount) values
  ('What my grandmother kept in the pantry', 'what-my-grandmother-kept-in-the-pantry', 'paid', 'My grandmother''s pantry was a cupboard under the stairs, and it smelled of apples, paraffin, and brown paper. As a child I thought it held everything in the world.

It did not. It held perhaps forty things, and she could make a meal from any six of them. That, I have come to think, is the whole secret of cooking at home: not abundance, but a small set of things you know completely.

This letter is the inventory. I wrote it out from memory and then checked it against the notebook she left me, and I was wrong about only two items.

## The staples

Oats, rolled and pinhead. Dried split peas, yellow. Barley. Two kinds of flour and a tin of bicarbonate. Golden syrup, black treacle, and a jar of dripping that she replenished every Sunday.

## The preserves

Onion marmalade, which she called chutney. Damson jam, which she guarded. Pickled beetroot, which nobody but my grandfather ate.

## The unexpected

A bottle of Camp coffee essence, a tin of anchovies she used in almost everything, and a paper bag of dried mushrooms sent every autumn by a cousin in Poland.

In the rest of this letter I go through each shelf, what she made from it, and which of her habits I have kept and which I have quietly let go.', now() - interval '28 days', now() - interval '28 days', 8);

insert into posts (title, slug, access, body, publishAt, sentAt, recipientCount) values
  ('Soup, weekly', 'soup-weekly', 'free', 'On Sunday evenings I make one large pot of soup, and it feeds us, in various forms, until Wednesday.

The first night it is soup. The second night it is thickened with bread and cheese and baked. The third night it goes over rice with an egg on top. By Wednesday there is a cupful left, and it becomes the base for whatever comes next.

People ask for the recipe, and there is not one. There is a method: soften an onion, add whatever vegetables are going soft, cover with stock or water, simmer until everything gives up, and season far more than you think.

The only rule I keep is to finish it with something sharp. A squeeze of lemon, a spoon of vinegar, a handful of chopped pickles. Soup without acid tastes like a waiting room.', now() - interval '4 days', now() - interval '4 days', 8);

insert into posts (title, slug, access, body, publishAt, sentAt, recipientCount) values
  ('The long winter kitchen', 'the-long-winter-kitchen', 'paid', 'The first frost came on a Thursday this year, and by the weekend the kitchen had become the only room in the house anybody wanted to be in.

This is the season I plan for all year. The garden is done, the jars are full, and the cooking changes shape: longer, slower, and louder, with the oven on for hours and the windows running with steam.

In this letter I want to walk you through how I set up the kitchen for winter, from the practical (where the wood goes, which pans come down from the high shelf) to the sentimental (the tablecloth, the candles, the radio).

## Moving the table

Every November we drag the kitchen table eighteen inches closer to the stove. It is a small thing and it changes everything about how the room is used.

## The braise rota

Three braises, rotated weekly: beef in stout, lamb with barley, and a chickpea and squash stew for the nights nobody wants meat.

## Light

Winter cooking is mostly done in the dark. I will tell you which lamps I moved and why the overhead light stays off from October until March.', now() - interval '12 days', now() - interval '12 days', 8);

insert into posts (title, slug, access, body, publishAt, sentAt, recipientCount) values
  ('On mending things', 'on-mending-things', 'paid', 'There is a basket by my chair with three jumpers in it, each with a hole at the elbow, and I have been meaning to darn them since August.

I finally did it this week. It took an evening, a borrowed mushroom, and a great deal of swearing, and the results are lumpy, visible, and entirely wearable.

I have been thinking about why mending feels so good when it is done and so impossible before it starts. I think it is because mending asks you to admit that a thing is worth keeping, and then to spend an hour proving it.

## What I mended

A navy jumper of my husband''s, a cardigan that belonged to my mother, and a pair of wool socks I knitted badly ten years ago.

## What I learned

Use a thread slightly lighter than the garment. Work in good light. Do not try to make it invisible; make it sturdy, and let it show.

The rest of this letter is a longer essay about the things in our house that have been repaired more times than they have been replaced, and what they have taught me about keeping a home at all.', now() - interval '21 days', now() - interval '21 days', 8);

