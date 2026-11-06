import { App } from "aws-cdk-lib";
import { CertificateStack } from "../lib/certificate-stack.js";
import { SiteStack } from "../lib/site-stack.js";

const ZONE_NAME = "murtazasaifee.com";
const DOMAIN_NAME = `booking.${ZONE_NAME}`;

// The CDK command line fills this in from whoever is signed in, so the account isn't written in the repo.
const account = process.env.CDK_DEFAULT_ACCOUNT;

// These come from infra/.env.deploy, which git ignores.
function secret(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
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
