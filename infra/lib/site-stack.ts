import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import type { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  Function as CloudFrontFunction,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  OriginRequestPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { FunctionUrlOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { FunctionUrlAuthType, LayerVersion } from "aws-cdk-lib/aws-lambda";
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment } from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";
import { fileURLToPath } from "node:url";
import { type ServerSecrets, serverFunction } from "./server-function.js";
import { webBuild } from "./web-build.js";

// Published by AWS. Runs the Express app unchanged by turning Lambda events into plain HTTP requests.
const WEB_ADAPTER_ACCOUNT = "753240598075";
const WEB_ADAPTER_LAYER = "LambdaAdapterLayerArm64:30";

type SiteStackProps = StackProps & {
  zoneName: string;
  domainName: string;
  certificate: ICertificate;
  secrets: ServerSecrets;
};

export class SiteStack extends Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props);

    const api = serverFunction(this, "Api", {
      entry: "server/src/index.ts",
      handler: "run.sh",
      timeout: Duration.seconds(15),
      secrets: props.secrets,
      layers: [
        LayerVersion.fromLayerVersionArn(
          this,
          "WebAdapter",
          `arn:aws:lambda:${this.region}:${WEB_ADAPTER_ACCOUNT}:layer:${WEB_ADAPTER_LAYER}`,
        ),
      ],
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/bootstrap",
        PORT: "8080",
        API_ONLY: "true",
      },
    });
    // CloudFront's signed access to a function URL needs each POST to carry a hash of its body, which browsers
    // don't send. So the URL is open, and the app's own sign-in checks protect it as they do behind CloudFront.
    const apiUrl = api.addFunctionUrl({ authType: FunctionUrlAuthType.NONE });

    const web = new Bucket(this, "Web", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const webRoutes = new CloudFrontFunction(this, "WebRoutes", {
      runtime: FunctionRuntime.JS_2_0,
      code: FunctionCode.fromFile({
        filePath: fileURLToPath(new URL("../cloudfront/web-routes.js", import.meta.url)),
      }),
    });

    const distribution = new Distribution(this, "Distribution", {
      domainNames: [props.domainName],
      certificate: props.certificate,
      defaultRootObject: "index.html",
      // The cheapest class that still serves from edge locations in Southeast Asia.
      priceClass: PriceClass.PRICE_CLASS_200,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(web),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [{ eventType: FunctionEventType.VIEWER_REQUEST, function: webRoutes }],
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new FunctionUrlOrigin(apiUrl),
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          // Passes cookies and query strings through. A function URL rejects the site's own Host header.
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
        },
      },
    });

    new BucketDeployment(this, "WebFiles", {
      sources: [webBuild()],
      destinationBucket: web,
      distribution,
    });

    const zone = HostedZone.fromLookup(this, "Zone", { domainName: props.zoneName });
    const target = RecordTarget.fromAlias(new CloudFrontTarget(distribution));
    new ARecord(this, "Address", { zone, recordName: props.domainName, target });
    new AaaaRecord(this, "AddressIpv6", { zone, recordName: props.domainName, target });

    new CfnOutput(this, "SiteUrl", { value: `https://${props.domainName}` });
  }
}
