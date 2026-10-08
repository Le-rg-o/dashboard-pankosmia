# Pankosmia project dashboard

A lightweight, accessible, English-language dashboard for the public repositories and GitHub Project #9 in the Pankosmia organization. It runs locally and does not create or modify anything in the organization.

## Run locally

Requirements: Node.js 18 or newer.

```sh
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Stop the server with `Ctrl+C`.

The dashboard loads the public repository list without a token. GitHub requires authentication for its GraphQL API, so loading the project board’s status, assignee, checklist, and issue-age data requires a personal access token:

1. Create a **fine-grained personal access token** on GitHub.
2. Grant it read-only access to the Pankosmia organization’s **Projects**. No write permission is needed.
3. Paste the token into the dashboard and select **Load project**.

The token is kept in memory in the open browser tab only; it is not saved to disk or sent anywhere except `api.github.com`. Clear the field or close the tab to discard it. Do not use a token with write permissions.

## Dashboard features

- Lists public organization repositories and defaults the issue form to `roadmap`.
- Reads issue items and their status from Pankosmia’s organization project #9.
- Summarizes status, unassigned issues, issues not updated in 30 days, and progress derived from issue-body checklists.
- Filters by text, status, and repository; shows assignees, issue age, last update, and checklist completion.
- Prepares an issue on GitHub for any public repository. Title, description, assignee, and labels are prefilled; project and relationship are included in the draft description for review on GitHub. The user must confirm and create the issue there.

## Checks

```sh
npm run check
```