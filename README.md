# Pankosmia project dashboard

A lightweight, accessible, English-language dashboard for public repositories and issues in the Pankosmia organization’s GitHub Project #9.

## Use the hosted dashboard

The GitHub Pages deployment reported its URL as [https://le-rg-o.github.io/dashboard-pankosmia/](https://le-rg-o.github.io/dashboard-pankosmia/). Open it in a current browser, including on Windows. Hosted use requires no Node.js, npm, download, or installation, but does require an internet connection to load data from GitHub.

Public repositories load without a token. To load the project’s issues and status data:

1. Create a fine-grained personal access token on GitHub with **Pankosmia** as its resource owner and read-only access to the organization’s **Projects**.
2. Paste the token into the dashboard and select **Load project**.

No write permission is needed. Whether the token can read the project also depends on the token owner’s access and any organization access policy or approval. GitHub’s [personal access token guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) explains these access limits.

The dashboard sends the token as authorization for GraphQL requests to `api.github.com`; it does not save it in application storage or send it through a dashboard server. Treat the token like a password and do not use one with write access. Clearing the token field prevents it being used for later refreshes, but does not clear project data already displayed in the page.

## What the dashboard does

- Lists Pankosmia’s public repositories through GitHub’s REST API and uses `roadmap` as the default issue repository when available; otherwise it uses the first repository alphabetically.
- Reads issue items from organization Project #9 through GitHub’s GraphQL API. Project loading requires the token above.
- Shows project status (or “No status” when no `Status` value is available), unassigned issues, issues not updated in at least 30 days, issue age, last update, assignees, and Markdown checklist completion.
- Calculates overall checklist progress from the completed and total checklist tasks in the loaded issue bodies.
- Filters issues by text, status, and repository. Text search covers issue title, repository, and assignee.
- Opens GitHub’s new-issue page with title, description, assignee, and labels prefilled. Project and relationship are plain text in the draft description; they are not automatically assigned or linked.

The dashboard only reads GitHub data and prepares a draft URL; it does not create issues or modify the Pankosmia organization. Submitting the draft on GitHub is a separate action that may create an issue in the selected repository.

Only issue items are displayed, not pull requests or draft project items. The GraphQL query requests up to 100 project items per page, 20 field values per item, and 10 assignees per issue. API access, organization policies, and network availability can affect whether data loads.

## Run locally (optional)

The hosted dashboard does not need Node.js or npm. For local development, install Node.js 18 or newer, then run the built-in static server from the repository directory:

```sh
node server.js
```

Or, if npm is available:

```sh
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). The server uses only Node.js built-ins, listens on `127.0.0.1`, and uses port `4173` by default (`PORT` can override it). No `npm install` is needed.

Run the available syntax checks with:

```sh
npm run check
```

This checks the JavaScript syntax in `server.js` and `app.js`; it is not an end-to-end or GitHub API test.

## Deployment and files

The [Pages workflow](.github/workflows/pages.yml) in this repository deploys on pushes to `main` and can also be run manually. It publishes only `index.html`, `app.js`, and `styles.css`; there is no build step, application backend, or Node.js requirement for deployment. Its `contents: read`, `pages: write`, and `id-token: write` permissions are for deployment of this repository’s Pages site, not for writing to the Pankosmia organization.

- `index.html`, `app.js`, and `styles.css`: static dashboard published to Pages.
- `server.js` and `package.json`: optional local server and syntax-check scripts.
- `.github/workflows/pages.yml`: GitHub Pages deployment workflow.
