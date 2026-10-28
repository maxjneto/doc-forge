# Privacy Policy

*Last updated: October 28, 2026*

This Privacy Policy describes how DocForge ("we", "us", "our") collects, uses, and shares information when you use the Service. This policy is intended to comply with the **Lei Geral de Proteção de Dados (LGPD)** — Brazilian Federal Law No. 13,709/2018.

## 1. Data We Collect

| Category | Examples |
|---|---|
| Authentication data | Email address, user ID (provided via Clerk) |
| User content | Documents, versions, comments, images and other files you or your connected agents create |
| Agent access data | Names of the API keys you create and the calls made with them |
| Usage metadata | Timestamps, document activity, session activity |
| Billing data | Plan and subscription status (card details are handled by Stripe, never by us) |

## 2. How We Collect It

- **At registration and login** — via Clerk authentication (OAuth or email/password flow)
- **During use** — when you or an agent using one of your API keys create or change documents
- **In the browser** — product analytics run only after you accept cookies

## 3. Purpose of Processing

| Purpose | Legal Basis (LGPD Art. 7) |
|---|---|
| User authentication and account management | Execution of contract (Art. 7, V) |
| Storing, versioning and publishing documents | Execution of contract (Art. 7, V) |
| Billing for paid plans | Execution of contract (Art. 7, V) |
| Service improvement and debugging | Legitimate interest (Art. 7, IX) |
| Browser analytics | Consent (Art. 7, I) |

## 4. Data Sharing

We share data only with the providers that run parts of the Service:

| Provider | Purpose |
|---|---|
| **Clerk** | Authentication and identity management |
| **PostHog** | Product analytics (in the browser only after consent; text in the editor is masked in session recordings) |
| **Stripe** | Payment processing for paid plans |

DocForge does not send your documents to AI model providers. The AI agents you connect run on your side, under your own agreements with their providers.

Documents you publish, or share through a public link, can be read by anyone with the link.

We do not sell your personal data to third parties.

## 5. Data Storage and Retention

Documents and user data are stored in a PostgreSQL database on a virtual private server rented from Contabo. We retain your data for as long as your account is active. Upon account deletion, your data will be removed within **30 days**.

## 6. Your Rights (LGPD Art. 18)

As a data subject under the LGPD, you have the right to:

- **Access** your personal data held by us
- **Correct** incomplete or inaccurate data
- **Delete** your personal data (right to erasure)
- **Portability** of your data, where technically feasible
- **Revoke consent** at any time, where processing is consent-based
- **Information** about third parties with whom your data is shared

To exercise any of these rights, contact: **maxjneto@gmail.com**

## 7. Security

We implement reasonable technical and organisational measures to protect your data, including HTTPS transport encryption, credential management via Clerk, API keys stored only as hashes, and access-controlled database infrastructure. No method of transmission over the internet is 100% secure; we cannot guarantee absolute security.

## 8. Children's Privacy

The Service is not directed at individuals under the age of 18. We do not knowingly collect personal data from minors.

## 9. Changes to This Policy

We may update this Privacy Policy from time to time. Continued use of the Service after changes constitutes acceptance of the updated policy. We recommend reviewing this page periodically.

## 10. Contact

For privacy-related requests, data subject rights, or any questions about this policy:

**maxjneto@gmail.com**
