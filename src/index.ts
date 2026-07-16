import * as core from "@actions/core";
import * as setup from "@extractions/setup-crate";

async function validateSubscription() {
  const fs = require("fs");
  let repoPrivate;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    repoPrivate = payload?.repository?.private;
  }
  const upstream = "extractions/setup-crate";
  const action = process.env.GITHUB_ACTION_REPOSITORY;
  const docsUrl = "https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions";
  const core = require("@actions/core");
  const axios = require("axios");
  core.info("");
  core.info("StepSecurity Maintained Action");
  core.info(`Secure drop-in replacement for ${upstream}`);
  if (repoPrivate === false) core.info("✓ Free for public repositories");
  core.info(`Learn more: ${docsUrl}`);
  core.info("");
  if (repoPrivate === false) return;
  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
  const body = { action: action || "" };
  if (serverUrl !== "https://github.com") body.ghes_server = serverUrl;
  try {
    await axios.post(
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body,
      { timeout: 3000 },
    );
  } catch (error) {
    if (axios.isAxiosError?.(error) && error.response?.status === 403) {
      core.error("This action requires a StepSecurity subscription for private repositories.");
      core.error(`Learn how to enable a subscription: ${docsUrl}`);
      process.exit(1);
    }
    core.info("Timeout or API not reachable. Continuing to next step.");
  }
}


async function main() {
  await validateSubscription();
  try {
    const repoSpec = core.getInput("repo");
    let owner = core.getInput("owner");
    let name = core.getInput("name");
    const githubToken = core.getInput("github-token");
    let versionSpec = core.getInput("version");

    // Repo and owner+name are mutually exclusive
    if (repoSpec) {
      if (owner || name) {
        core.setFailed(
          "When 'repo' is supplied, 'owner' and 'name' must not be provided",
        );
        return;
      }
    } else {
      if (!owner || !name) {
        core.setFailed(
          "Both 'owner' and 'name' must be supplied when 'repo' is not provided",
        );
        return;
      }
    }

    // Parse the repo spec if it was provided
    if (repoSpec) {
      const [repo, version] = repoSpec.split("@", 2);
      if (version && versionSpec) {
        core.setFailed(
          "Both 'version' and 'repo' have a version specified, only one is allowed",
        );
        return;
      }
      versionSpec = version || versionSpec;
      [owner, name] = repo.split("/", 2);
    }

    const tool = await setup.checkOrInstallTool(
      { owner, name, versionSpec },
      { auth: githubToken },
    );
    core.addPath(tool.dir);
    core.info(`Successfully setup ${tool.name} v${tool.version}`);
  } catch (err) {
    if (err instanceof Error) {
      core.setFailed(err.message);
    }
  }
}

main();
