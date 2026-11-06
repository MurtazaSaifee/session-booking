import { Duration } from "aws-cdk-lib";
import { Schedule, ScheduleExpression } from "aws-cdk-lib/aws-scheduler";
import { LambdaInvoke } from "aws-cdk-lib/aws-scheduler-targets";
import { Trigger } from "aws-cdk-lib/triggers";
import type { Construct } from "constructs";
import { type ServerSecrets, serverFunction } from "./server-function.js";

const SETUP_TIMEOUT = Duration.minutes(1);

// Runs migrations and loads demo data during the deploy, before the API that needs them goes live. If it fails,
// the deploy fails and the running API stays as it was.
export function addDatabaseSetup(scope: Construct, secrets: ServerSecrets, api: Construct): void {
  const setup = serverFunction(scope, "Setup", {
    entry: "server/src/lambda/setup.ts",
    handler: "handler",
    timeout: SETUP_TIMEOUT,
    secrets,
    // The demo accounts have a published password, so they are only ever asked for by name.
    environment: { SEED_DEMO_DATA: "true" },
  });
  new Trigger(scope, "RunSetup", { handler: setup, timeout: SETUP_TIMEOUT, executeBefore: [api] });
}

export function addReminderSchedule(scope: Construct, secrets: ServerSecrets): void {
  const check = serverFunction(scope, "Check", {
    entry: "server/src/lambda/check.ts",
    handler: "handler",
    // Under the schedule's minute, so runs rarely overlap.
    timeout: Duration.seconds(50),
    secrets,
  });
  new Schedule(scope, "EveryMinute", {
    schedule: ScheduleExpression.rate(Duration.minutes(1)),
    // The next run a minute later picks up whatever this one missed.
    target: new LambdaInvoke(check, { retryAttempts: 0 }),
  });
}
