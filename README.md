# Cinderella's Midnight Maze

A free arcade maze chase through the palace. Collect every pearl, grab a glass slipper to turn the stepfamily into mice, and reach level 20 for the happily-ever-after ending.

## Files

| Path | What it is |
|---|---|
| `cinderella-maze.html` | The whole game: one page with its own styles and script |
| `scripts/check.mjs` | Checks the game's script for errors and that required page elements exist |
| `scripts/build.mjs` | Wraps the game into a complete web page at `dist/index.html` |
| `infra/site.yaml` | AWS CloudFormation template: private S3 bucket, CloudFront (HTTPS), GitHub deploy role, cost alert |
| `.github/workflows/check.yml` | Runs the check and build on every pull request |
| `.github/workflows/deploy.yml` | Deploys to AWS when a change lands on `main` |
| `previews/` | Design preview pages (kept locally, not in git) |

## Run it locally

```bash
node scripts/check.mjs
node scripts/build.mjs
# then open dist/index.html in a browser
```

## Deploying

1. Create the AWS resources once:

   ```bash
   aws cloudformation deploy \
     --stack-name cinderella-maze \
     --template-file infra/site.yaml \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides GitHubOwner=<github-user> GitHubRepo=<repo> \
       GitHubOwnerId=<owner-id> GitHubRepoId=<repo-id> BudgetEmail=<email>
   ```

   GitHub identifies the repository by its permanent ids when deploying; find them with
   `gh api repos/<github-user>/<repo> --jq '.owner.id, .id'`.

2. In the GitHub repository, add these under **Settings → Secrets and variables → Actions → Variables**, using the stack's outputs (`aws cloudformation describe-stacks --stack-name cinderella-maze --query "Stacks[0].Outputs"`):
   `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `SITE_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`.

3. From then on, merging a pull request into `main` publishes the game automatically.

Scores are kept in each player's browser when the game runs outside claude.ai.
