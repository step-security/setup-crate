import * as core from "@actions/core";
import * as setup from "@step-security/setup-crate";
import axios, { isAxiosError } from "axios";

async function validateSubscription(): Promise<void> {
  const API_URL = `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/subscription`;

  try {
    await axios.get(API_URL, { timeout: 3000 });
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 403) {
      core.error(
        "Subscription is not valid. Reach out to support@stepsecurity.io",
      );
      process.exit(1);
    } else {
      core.info("Timeout or API not reachable. Continuing to next step.");
    }
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
