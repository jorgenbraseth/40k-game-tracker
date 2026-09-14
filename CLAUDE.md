# Project memory

## Keep README.md's description current

`README.md`'s "What this is (the goal)" and "What's actually in place
right now" sections must stay accurate after every change that affects
them. When you make a change:

- If it changes or extends the intended **goal/vision** of the app (a
  new feature the app should do, a change to how the core flow is
  meant to work), update the "What this is (the goal)" section.
- If it changes what's **actually implemented** (a feature shipped, a
  caveat resolved, a new gap introduced), update "What's actually in
  place right now" to match.
- Don't let the two drift out of sync with reality: the goal section
  describes what the app is *for*, the status section describes what's
  *true today*. A reader should be able to tell the difference between
  "this is how it's supposed to work" and "this part isn't done yet"
  without digging through code or commit history.

This applies whether the change comes from this repo's own session or a
fresh one -- treat README.md as living documentation of the product, not
a one-time snapshot from when the app was first built.
