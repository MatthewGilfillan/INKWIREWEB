# Ink Wire email designs

The account sender now includes HTML and plain-text versions of each message. The HTML uses inline styles and presentation tables, public HTTPS JPEG/PNG assets, and a narrow responsive layout. The original favicon sits at the upper left; the original logo is in the footer.

- Activation: reading student photo, single-use activation link, one-hour expiry.
- Password reset: compact matching design, single-use reset link, 30-minute expiry.
- Student invitation: the boy and girl between stacks of books; supports general class links and individual roster invitations.
- Parent invitation: the same photo, selected student and inviting class, and an explanation that the parent connection follows that child across their classes.

## Teacher workflow

Open **Classes → Students → Invite students** for the general class invitation, or **Manage → Invite student / Invite parent** for a named roster entry. Enter one recipient email address and choose **Send invitation**. Copy-link, QR download, replace-code and close-invitation options remain available.

Sending uses the currently displayed invitation. Expired, changed, closed or redeemed links must be reopened before sending. The server checks class membership and Origin, constructs all message content itself, and limits invitation sending to 20 per teacher and three per recipient per 15 minutes. Invitations and account messages share the existing daily 250-message budget. Recipient addresses are not stored by this feature; rate-limit keys are hashed. The provider handles delivery.

No messages are sent merely by viewing the invitation or design gallery. A delivery error is shown in the form; because a provider timeout can be ambiguous, it asks the teacher to check before retrying.

## Preview and maintenance

`/email-preview` offers all four designs in desktop and phone layouts. Preview names, dates and codes are fictional, and sample links are inactive. `scripts/build-email-previews.mjs` builds samples from the production renderers, as part of `npm run build`.

Templates: `cloudflare/account-emails.mjs`. Delivery: `cloudflare/email-delivery.mjs`. Existing account expiry and verification semantics are unchanged. Invitation expiry is the actual existing invitation expiry, displayed in Beijing time.

Validated with 132 unit/API checks, production build, browser previews, and parent/student sends captured in a local in-memory mailbox. Actual mailbox rendering depends on the recipient's email client and image-loading settings; no live invitation was sent during validation.
