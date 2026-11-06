import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { Architecture, type ILayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SUPABASE_CA = "supabase-ca.crt";

// Copies times pool size must stay under the database's limit. The account runs 10 Lambda copies at most.
const DB_POOL_MAX = "2";

// Knex loads the driver for its database by name, so the ones this app doesn't use must stay out of the bundle.
const UNUSED_DRIVERS = [
  "better-sqlite3",
  "mariadb/callback",
  "mysql",
  "mysql2",
  "oracledb",
  "pg-native",
  "pg-query-stream",
  "sqlite3",
  "tedious",
];

export type ServerSecrets = {
  databaseUrl: string;
  jwtSecret: string;
};

type ServerFunctionProps = {
  entry: string;
  handler: string;
  secrets: ServerSecrets;
  timeout: Duration;
  environment?: Record<string, string>;
  layers?: ILayerVersion[];
};

// One bundle setup for the API and the functions beside it, so they all reach the database the same way.
export function serverFunction(scope: Construct, id: string, props: ServerFunctionProps): NodejsFunction {
  return new NodejsFunction(scope, id, {
    runtime: Runtime.NODEJS_24_X,
    architecture: Architecture.ARM_64,
    memorySize: 512,
    timeout: props.timeout,
    layers: props.layers,
    entry: `${REPO_ROOT}${props.entry}`,
    handler: props.handler,
    projectRoot: REPO_ROOT,
    depsLockFilePath: `${REPO_ROOT}package-lock.json`,
    logGroup: new LogGroup(scope, `${id}Logs`, {
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    }),
    environment: {
      NODE_ENV: "production",
      DB_POOL_MAX,
      JWT_SECRET: props.secrets.jwtSecret,
      // Supabase's certificates chain to its own root, so the connection is checked against that file.
      DATABASE_URL: `${props.secrets.databaseUrl}?sslmode=verify-full&sslrootcert=/var/task/${SUPABASE_CA}`,
      ...props.environment,
    },
    bundling: {
      format: OutputFormat.ESM,
      target: "node24",
      mainFields: ["module", "main"],
      // Knex and pg are CommonJS and call require, which a bundled ES module doesn't have on its own.
      banner: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      externalModules: UNUSED_DRIVERS,
      commandHooks: {
        beforeBundling: () => [],
        beforeInstall: () => [],
        afterBundling: (_input, output) => [
          `cp -R ${REPO_ROOT}server/src/migrations ${output}/migrations`,
          `cp ${REPO_ROOT}infra/lambda/${SUPABASE_CA} ${REPO_ROOT}infra/lambda/run.sh ${output}/`,
        ],
      },
    },
  });
}
