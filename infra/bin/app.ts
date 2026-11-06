import { App } from "aws-cdk-lib";
import { CertificateStack } from "../lib/certificate-stack.js";

const ZONE_NAME = "murtazasaifee.com";
const DOMAIN_NAME = `booking.${ZONE_NAME}`;

// The CDK command line fills this in from whoever is signed in, so the account isn't written in the repo.
const account = process.env.CDK_DEFAULT_ACCOUNT;

const app = new App();

// CloudFront only accepts certificates from us-east-1, whichever region the rest of the app runs in.
new CertificateStack(app, "SessionBookingCertificate", {
  env: { account, region: "us-east-1" },
  crossRegionReferences: true,
  zoneName: ZONE_NAME,
  domainName: DOMAIN_NAME,
});
