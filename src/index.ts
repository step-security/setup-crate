import * as core from "@actions/core";
import * as setup from "@step-security/setup-crate";
import axios, { isAxiosError } from "axios";
import * as fs from "fs";

async function validateSubscription(): Promise<void> {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  let repoPrivate: boolean | undefined;

  if (eventPath && fs.existsSync(eventPath)) {
    const eventData = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    repoPrivate = eventData?.repository?.private;
  }

  const upstream = "extractions/setup-crate";
  const action = process.env.GITHUB_ACTION_REPOSITORY;
  const docsUrl =
    "https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions";

  core.info("");
  core.info("\u001B[1;36mStepSecurity Maintained Action\u001B[0m");
  core.info(`Secure drop-in replacement for ${upstream}`);
  if (repoPrivate === false)
    core.info("\u001B[32m✓ Free for public repositories\u001B[0m");
  core.info(`\u001B[36mLearn more:\u001B[0m ${docsUrl}`);
  core.info("");

  if (repoPrivate === false) return;

  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
  const body: Record<string, string> = { action: action || "" };
  if (serverUrl !== "https://github.com") body.ghes_server = serverUrl;
  try {
    await axios.post(
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body,
      { timeout: 3000 },
    );
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 403) {
      core.error(
        `\u001B[1;31mThis action requires a StepSecurity subscription for private repositories.\u001B[0m`,
      );
      core.error(
        `\u001B[31mLearn how to enable a subscription: ${docsUrl}\u001B[0m`,
      );
      process.exit(1);
    }
    core.info("Timeout or API not reachable. Continuing to next step.");
  }
}

async function main() {
  try {
    await validateSubscription();
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
