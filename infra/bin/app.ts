import { App } from "aws-cdk-lib";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { CertificateStack } from "../lib/certificate-stack.js";
import { SiteStack } from "../lib/site-stack.js";

const ZONE_NAME = "murtazasaifee.com";
const DOMAIN_NAME = `booking.${ZONE_NAME}`;

// The CDK command line fills this in from whoever is signed in, so the account isn't written in the repo.
const account = process.env.CDK_DEFAULT_ACCOUNT;

// Read from the file, not the environment: a DATABASE_URL set in the shell for another project would win there,
// and go live on the Lambdas. Git ignores this file.
const deploySecrets = parseEnv(readFileSync(new URL("../.env.deploy", import.meta.url), "utf8"));

function secret(name: string): string {
  const value = deploySecrets[name];
  if (!value) throw new Error(`${name} is not set in infra/.env.deploy`);
  return value;
}

const app = new App();

// CloudFront only accepts certificates from us-east-1, whichever region the rest of the app runs in.
const { certificate } = new CertificateStack(app, "SessionBookingCertificate", {
  env: { account, region: "us-east-1" },
  crossRegionReferences: true,
  zoneName: ZONE_NAME,
  domainName: DOMAIN_NAME,
});

new SiteStack(app, "SessionBookingSite", {
  env: { account, region: "ap-southeast-1" },
  crossRegionReferences: true,
  zoneName: ZONE_NAME,
  domainName: DOMAIN_NAME,
  certificate,
  secrets: {
    databaseUrl: secret("DATABASE_URL"),
    jwtSecret: secret("JWT_SECRET"),
  },
});
