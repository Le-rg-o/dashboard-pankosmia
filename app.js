"use strict";

const API_ROOT = "https://api.github.com";
const GRAPHQL_URL = `${API_ROOT}/graphql`;
const ORGANIZATION = "pankosmia";
const PROJECT_NUMBER = 9;
const STALE_DAYS = 30;

const elements = {
  announcement: document.querySelector("#announcement"),
  createForm: document.querySelector("#create-form"),
  issueCount: document.querySelector("#issue-count"),
  issueRows: document.querySelector("#issue-rows"),
  metricCards: document.querySelector("#metric-cards"),
  newRepository: document.querySelector("#new-repository"),
  refreshButton: document.querySelector("#refresh-button"),
  repositoryFilter: document.querySelector("#repository-filter"),
  search: document.querySelector("#search"),
  statusFilter: document.querySelector("#status-filter"),
  statusSummary: document.querySelector("#status-summary"),
  token: document.querySelector("#token"),
  tokenForm: document.querySelector("#token-form"),
};

let repositories = [];
let projectIssues = [];

function announce(message, kind = "") {
  elements.announcement.textContent = message;
  elements.announcement.dataset.kind = kind;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", ...options.headers },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `GitHub API request failed (${response.status}).`);
  }
  return data;
}

async function loadRepositories() {
  const repos = [];
  for (let page = 1; ; page += 1) {
    const pageRepos = await fetchJson(`${API_ROOT}/orgs/${ORGANIZATION}/repos?type=public&per_page=100&page=${page}`);
    repos.push(...pageRepos);
    if (pageRepos.length < 100) break;
  }
  repositories = repos.sort((a, b) => a.name.localeCompare(b.name));
  populateRepositorySelects();
}

function populateRepositorySelects() {
  const issueSelect = elements.newRepository;
  issueSelect.replaceChildren();
  repositories.forEach((repo) => {
    const option = document.createElement("option");
    option.value = repo.name;
    option.textContent = repo.name;
    issueSelect.append(option);
  });
  issueSelect.value = repositories.some((repo) => repo.name === "roadmap") ? "roadmap" : (repositories[0]?.name || "");

  const filter = elements.repositoryFilter;
  filter.replaceChildren(new Option("All repositories", ""));
  repositories.forEach((repo) => filter.add(new Option(repo.name, repo.name)));
  filter.disabled = repositories.length === 0;
}

const PROJECT_QUERY = `
  query ProjectItems($after: String) {
    organization(login: "pankosmia") {
      projectV2(number: 9) {
        title
        items(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2SingleSelectField {
                      name
                    }
                  }
                }
              }
            }
            content {
              ... on Issue {
                number
                title
                url
                state
                body
                createdAt
                updatedAt
                assignees(first: 10) { nodes { login url } }
                repository { name }
              }
            }
          }
        }
      }
    }
  }`;

async function loadProject(token) {
  const issues = [];
  let after = null;
  let title = "Pankosmia";
  do {
    const result = await fetchJson(GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: PROJECT_QUERY, variables: { after } }),
    });
    if (result.errors?.length) throw new Error(result.errors.map((error) => error.message).join(" "));
    const project = result.data?.organization?.projectV2;
    if (!project) throw new Error("Project #9 could not be found or this token cannot read it.");
    title = project.title;
    const page = project.items;
    for (const item of page.nodes) {
      const issue = item.content;
      if (!issue) continue;
      const statusField = item.fieldValues.nodes.find((field) => field.field?.name === "Status");
      issues.push({
        ...issue,
        status: statusField?.name || "No status",
        assignees: issue.assignees.nodes,
        repositoryName: issue.repository.name,
      });
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);

  projectIssues = issues;
  renderProject(title);
}

function getChecklist(body = "") {
  const tasks = body.match(/^\s*[-*+]\s+\[(?: |x|X)\]/gm) || [];
  const completed = tasks.filter((task) => /\[[xX]\]/.test(task)).length;
  return { total: tasks.length, completed };
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function daysSince(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function renderMetrics(issues) {
  const staleCount = issues.filter((issue) => {
    const age = daysSince(issue.updatedAt);
    return age !== null && age >= STALE_DAYS;
  }).length;
  const unassigned = issues.filter((issue) => issue.assignees.length === 0).length;
  const checklists = issues.map((issue) => getChecklist(issue.body)).filter((item) => item.total > 0);
  const completed = checklists.reduce((sum, item) => sum + item.completed, 0);
  const tasks = checklists.reduce((sum, item) => sum + item.total, 0);
  const progress = tasks ? `${Math.round((completed / tasks) * 100)}%` : "No checklists";
  const values = [
    ["Project issues", String(issues.length)],
    ["Unassigned", String(unassigned)],
    [`Not updated in ${STALE_DAYS}+ days`, String(staleCount)],
    ["Checklist progress", progress],
  ];
  elements.metricCards.replaceChildren();
  values.forEach(([label, value]) => {
    const card = document.createElement("article");
    card.className = "metric-card";
    const heading = document.createElement("h3");
    heading.textContent = label;
    const metric = document.createElement("p");
    metric.className = "metric-value";
    metric.textContent = value;
    card.append(heading, metric);
    elements.metricCards.append(card);
  });
}

function renderStatuses(issues) {
  const statuses = new Map();
  issues.forEach((issue) => statuses.set(issue.status, (statuses.get(issue.status) || 0) + 1));
  const ordered = [...statuses.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  elements.statusSummary.replaceChildren();
  elements.statusFilter.replaceChildren(new Option("All statuses", ""));
  ordered.forEach(([status, count]) => {
    const card = document.createElement("article");
    card.className = "status-card";
    const heading = document.createElement("h3");
    heading.textContent = status;
    const description = document.createElement("p");
    const number = document.createElement("span");
    number.className = "status-number";
    number.textContent = String(count);
    description.append(number, document.createTextNode(count === 1 ? " issue" : " issues"));
    card.append(heading, description);
    elements.statusSummary.append(card);
    elements.statusFilter.add(new Option(status, status));
  });
  elements.statusFilter.disabled = ordered.length === 0;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function addCell(row, content, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  if (content instanceof Node) cell.append(content);
  else cell.textContent = content;
  row.append(cell);
  return cell;
}

function renderRows() {
  const query = elements.search.value.trim().toLocaleLowerCase();
  const status = elements.statusFilter.value;
  const repository = elements.repositoryFilter.value;
  const filtered = projectIssues.filter((issue) => {
    const haystack = `${issue.title} ${issue.repositoryName} ${issue.assignees.map((item) => item.login).join(" ")}`.toLocaleLowerCase();
    return (!query || haystack.includes(query))
      && (!status || issue.status === status)
      && (!repository || issue.repositoryName === repository);
  });
  elements.issueRows.replaceChildren();
  elements.issueCount.textContent = `${filtered.length} of ${projectIssues.length} ${projectIssues.length === 1 ? "issue" : "issues"}`;
  if (!filtered.length) {
    const row = document.createElement("tr");
    const cell = addCell(row, "No issues match these filters.", "table-empty");
    cell.colSpan = 6;
    elements.issueRows.append(row);
    return;
  }
  filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach((issue) => {
    const row = document.createElement("tr");
    const titleCell = document.createElement("td");
    const title = document.createElement("a");
    title.className = "issue-title";
    title.href = issue.url;
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    title.textContent = `#${issue.number} ${issue.title}`;
    const repo = document.createElement("span");
    repo.className = "issue-repository";
    repo.textContent = issue.repositoryName;
    titleCell.append(title, repo);
    row.append(titleCell);

    const statusPill = document.createElement("span");
    statusPill.className = "status-pill";
    statusPill.textContent = issue.status;
    addCell(row, statusPill);

    const assignees = issue.assignees.map((person) => person.login);
    addCell(row, assignees.length ? assignees.join(", ") : "Unassigned");

    const age = daysSince(issue.createdAt);
    addCell(row, age === null ? "Unknown" : pluralize(age, "day"), age !== null && age >= STALE_DAYS ? "stale" : "");
    addCell(row, formatDate(issue.updatedAt));

    const checklist = getChecklist(issue.body);
    if (checklist.total) {
      const cell = addCell(row, `${checklist.completed}/${checklist.total}`, "progress-cell");
      const track = document.createElement("span");
      track.className = "progress-track";
      track.setAttribute("role", "img");
      const percent = Math.round((checklist.completed / checklist.total) * 100);
      track.setAttribute("aria-label", `${percent}% complete`);
      const fill = document.createElement("span");
      fill.className = "progress-fill";
      fill.style.width = `${percent}%`;
      track.append(fill);
      cell.append(track);
    } else {
      addCell(row, "—");
    }
    elements.issueRows.append(row);
  });
}

function renderProject(title) {
  renderMetrics(projectIssues);
  renderStatuses(projectIssues);
  renderRows();
  elements.refreshButton.disabled = false;
  announce(`${title} loaded: ${pluralize(projectIssues.length, "issue")} across ${pluralize(repositories.length, "public repository", "public repositories")}.`, "success");
}

async function refreshProject() {
  const token = elements.token.value.trim();
  if (!token) {
    announce("Enter a GitHub token to load the project board.", "error");
    elements.token.focus();
    return;
  }
  elements.refreshButton.disabled = true;
  announce("Loading project issues…");
  try {
    await loadProject(token);
  } catch (error) {
    announce(`Could not load the project: ${error.message}`, "error");
  } finally {
    elements.refreshButton.disabled = false;
  }
}

function prepareIssue(event) {
  event.preventDefault();
  if (!elements.createForm.reportValidity()) return;
  const form = new FormData(elements.createForm);
  const details = form.get("description").trim();
  const project = form.get("project").trim();
  const relationship = form.get("relationship").trim();
  const bodyParts = [details];
  if (project) bodyParts.push(`Project: ${project}`);
  if (relationship) bodyParts.push(`Related issue: ${relationship}`);

  const params = new URLSearchParams({
    title: form.get("title").trim(),
    body: bodyParts.filter(Boolean).join("\n\n"),
  });
  const assignee = form.get("assignee").trim();
  const labels = form.get("labels").split(",").map((label) => label.trim()).filter(Boolean);
  if (assignee) params.set("assignees", assignee);
  if (labels.length) params.set("labels", labels.join(","));

  const repository = repositories.find((item) => item.name === form.get("repository"));
  if (!repository) {
    announce("Select a valid public repository.", "error");
    return;
  }
  window.open(`${repository.html_url}/issues/new?${params.toString()}`, "_blank", "noopener,noreferrer");
}

elements.tokenForm.addEventListener("submit", (event) => {
  event.preventDefault();
  refreshProject();
});
elements.refreshButton.addEventListener("click", refreshProject);
elements.search.addEventListener("input", renderRows);
elements.statusFilter.addEventListener("change", renderRows);
elements.repositoryFilter.addEventListener("change", renderRows);
elements.createForm.addEventListener("submit", prepareIssue);

loadRepositories()
  .then(() => {
    announce(`${pluralize(repositories.length, "public repository", "public repositories")} loaded. Enter a token to load project issues.`, "success");
  })
  .catch((error) => {
    announce(`Could not load public repositories: ${error.message}`, "error");
    elements.newRepository.replaceChildren(new Option("Could not load repositories", ""));
  });
