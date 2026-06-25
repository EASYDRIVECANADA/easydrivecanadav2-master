# Facebook Marketplace Assist Runner

This runner is used on the dealership computer for browser-assisted Facebook Marketplace posting.

It does not store Facebook credentials and it does not click the final Facebook Post button.

## Start Runner

```bash
node scripts/facebook-marketplace-assist-runner.mjs --port 4777
```

## Dry Run A Launch Token

```bash
node scripts/facebook-marketplace-assist-runner.mjs --token '<token json>' --dry-run
```

## Expected Workflow

1. Log into Facebook in the visible browser profile on the dealership computer.
2. Start this runner.
3. Open EasyDrive Admin > Marketplace > Facebook.
4. Pick a ready vehicle.
5. Click Assist Post.
6. Review the filled Facebook form.
7. Manually click Post in Facebook.
8. Paste the final Facebook listing URL into EasyDrive.
