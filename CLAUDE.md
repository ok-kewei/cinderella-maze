# Cinderella's Midnight Maze

A free arcade maze chase game with a Cinderella story: 20 levels, story surprises, and a happily-ever-after ending. Made for family and friends; hosted publicly on AWS.

## How it's built

- **The whole game is one file:** `cinderella-maze.html` (HTML, CSS and one inline `<script>` IIFE; no build tools, no dependencies). Everything is drawn on a `<canvas>`; there are no image files.
- It has **no `<!doctype>`/`<head>`/`<body>`** on purpose: claude.ai artifacts wrap pages automatically. `scripts/build.mjs` adds the wrapper (including `[hidden]{display:none!important}`, which the overlay relies on) when building `dist/index.html` for AWS.
- `previews/` holds design preview pages. They are kept out of git (`.gitignore`) because some use the old Disney names.

## Commands

```bash
node scripts/check.mjs   # syntax-checks the inline script and required element ids; run after every change
node scripts/build.mjs   # writes dist/index.html for deployment
```

## Workflow

1. Edit `cinderella-maze.html`, run `node scripts/check.mjs`.
2. Publish to the claude.ai preview so the owner can try it: artifact https://claude.ai/artifact/793VZJ3ezmG33sFde1tvd7 (publish with that `url`; declared capabilities `db` and `user` carry forward). The owner reviews there before anything goes public.
3. Commit, open a pull request; the **Check** workflow runs. Merging to `main` runs **Deploy**, which uploads to S3 and refreshes CloudFront.

## AWS (CloudFormation stack `cinderella-maze`, us-east-1, account 374788852394)

- Site: https://djupknnfwqky.cloudfront.net (private S3 bucket behind CloudFront with Origin Access Control; HTTPS only).
- GitHub deploys through OIDC (no stored keys); the role only trusts `ok-kewei/cinderella-maze` on `main`.
- GitHub repository variables: `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `SITE_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID` (values: `aws cloudformation describe-stacks --stack-name cinderella-maze --query "Stacks[0].Outputs"`).
- A $1/month budget alert emails the owner.
- Infrastructure lives in `infra/site.yaml`; change it there and redeploy the stack rather than editing resources by hand.

## Decisions to keep

- **No Disney names or Disney-only material**, anywhere (visible text, code, comments, commits). Use: the Stepmother, Griselda, Petunia, Soot (cat), Pip and Crumb (mice), Barley (dog), "ABRACADABRA!". Traditional fairy-tale elements are fine: Cinderella, Prince Charming, the Fairy Godmother, the Grand Duke, the glass slipper, the pumpkin coach, midnight.
- **Never write "Pac-Man"** in the game, the page description, the site or commit messages.
- **Surprises stay surprises:** the How to play pop-up never mentions which level a feature starts on, and there are no "New!" hints.
- **No real Disney songs or film quotes.** All music is original; story lines follow the tale in our own words.
- **Speeds follow the classic arcade table** (`SPEEDS` in the script), with no per-pearl pause, so Cinderella is always a little faster than the family.
- **Look:** Starry night walls, the original maze, the sofa & tea room in the centre, pearls as the dots, the glass slipper as the power item, the family turns into mice. The owner has rejected per-level scene changes, rags instead of mice, and star-shaped sparkles.
- **Owner testing:** the game's owner (detected through the `user` capability on claude.ai) can start from any level; others unlock levels by reaching them.

## Working with the owner

- Show visual changes on a claude.ai preview page before changing the real game.
- Keep the page simple; the owner prefers fewer words on screen.
- Performance matters: draw expensive effects (blur, textures) once into a cached canvas, never every frame.
