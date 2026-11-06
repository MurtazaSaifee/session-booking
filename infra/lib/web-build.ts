import { AssetHashType, DockerImage } from "aws-cdk-lib";
import { type ISource, Source } from "aws-cdk-lib/aws-s3-deployment";
import { execSync } from "node:child_process";
import { cpSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

// Builds the web on this machine as part of a deploy. A teardown skips this, so it works from a fresh clone.
export function webBuild(): ISource {
  return Source.asset(`${REPO_ROOT}web`, {
    assetHashType: AssetHashType.OUTPUT,
    bundling: {
      // Required by the type, and only used if the local build below declines.
      image: DockerImage.fromRegistry("node:24-slim"),
      local: {
        tryBundle(outputDir) {
          execSync("npm run build -w web", { cwd: REPO_ROOT });
          cpSync(`${REPO_ROOT}web/dist`, outputDir, { recursive: true });
          return true;
        },
      },
    },
  });
}
