# Ink Wire on Cloudflare

Current target: publish the existing website and clearly labelled demonstration dashboards. Email services and real student accounts are deferred. Nothing in this deployment stores real student information in D1 or enables sign-in.

## Deploy the website

1. Open Workers & Pages → Create application → Continue with GitHub.
2. Select MatthewGilfillan / INKWIREWEB and the main branch.
3. Use application name `inkwire-education` and repository root `/`.
4. Build command: `npm test && npm run build`.
5. Deploy command: `npx wrangler deploy`.
6. Review the build-token permissions before selecting Deploy. The final approval is left to the account owner. No deployment token has been created by this setup.
7. Check the generated `workers.dev` address before connecting the domain. This static deployment can use the Workers Free plan. Email Sending and a paid plan are not needed for this phase.

The repository's `wrangler.jsonc` publishes only `dist/`. Source files, dependencies and documentation are not served. No credentials, database binding or mail service is required. Keep the existing private ChatGPT Site private; this separate Cloudflare deployment is the public website.

## Connect inkwire-education.com

The domain remains registered at GoDaddy. Changing nameservers moves DNS management, not ownership or registration.

1. Compare the imported Cloudflare DNS records with GoDaddy's current DNS list. Preserve the existing Microsoft mail records; no email cleanup is required to launch the website. Mail/service CNAME records must be DNS-only, not proxied.
2. Cloudflare has assigned `conrad.ns.cloudflare.com` and `courtney.ns.cloudflare.com` to this domain. These replace `ns23.domaincontrol.com` and `ns24.domaincontrol.com` at GoDaddy. Recheck the onboarding screen if the domain is ever removed from and re-added to Cloudflare.
3. In GoDaddy, open inkwire-education.com → DNS → Nameservers → Change nameservers → enter your own nameservers. Replace the existing nameservers with those two Cloudflare values. Check that DNSSEC is disabled at GoDaddy before changing nameservers; re-enable it with Cloudflare's instructions after activation if desired.
4. Wait until Cloudflare marks the domain Active. Keep the LearnWorlds website record until the new Cloudflare deployment has passed its checks.
5. In the `inkwire-education` Worker, open Settings → Domains & Routes → Add → Custom Domain. Add `inkwire-education.com` and `www.inkwire-education.com`.
6. If Cloudflare reports a conflicting website record, replace only the corresponding apex/www website record. The current `www` target is `inkwire.getlearnworlds.com`; replacing it switches visitors from LearnWorlds to the new site. Do not delete MX, TXT or Microsoft service records.
7. Confirm HTTPS, homepage images, navigation, contact-email draft and demo dashboards on both addresses. Verify that sign-in is still explicitly a preview.

## Later: accounts and student work

An empty D1 database has been prepared for the later application phase. Retrieve its identifiers from your Cloudflare dashboard when configuring the application; account identifiers and database IDs are intentionally omitted from this public guide. It is not bound to the static website. No student records or account tables have been added. The earlier Supabase setup and draft Cloudflare authentication work are paused.

Before Adalin uses real notebook pages or quizzes, implement and test verified accounts, server-side teacher/student/parent permissions, persistent page and quiz storage, and account recovery. The existing role switch and browser-local storage are demonstrations, not authentication or a cloud backup. If email is still deferred then, choose an explicit invitation/recovery process before enabling real accounts.

Google Workspace at `inkwire.online` remains separate from the website domain. No mail subscription, sender domain, forwarding rule or mailbox migration is part of this website deployment.
