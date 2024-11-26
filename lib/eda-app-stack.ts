import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

// const s3Client = new S3Client({ region: "your-region" });

export class EDAAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //creating images table
    const imageUploadsTable = new dynamodb.Table(this, "ImageUploadsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "fileName", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "ImageUploadsTable",
    });

    //bucket
    const imagesBucket = new s3.Bucket(this, "images", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });
    const name = imagesBucket.bucketName
    //Queues

    //invalid image que
    const badImagesQueue = new sqs.Queue(this, "bad-img-q", {
      retentionPeriod: Duration.minutes(10),
    });

    const imageProcessQueue = new sqs.Queue(this, "img-created-queue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
      deadLetterQueue: {
        queue: badImagesQueue,
        maxReceiveCount: 1,
      },
    });

    const newImageTopic = new sns.Topic(this, "NewImageTopic", {
      displayName: "New Image topic",
    }); 

    const mailerQ = new sqs.Queue(this, "mailer-queue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
    });

    //rejection mailer queue
    const rejectionMailerQ = new sqs.Queue(this, "rejection-mailer-queue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
    })

    // Lambda functions

    const processImageFn = new lambdanode.NodejsFunction(
      this,
      "ProcessImageFn",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/processImage.ts`,
        timeout: cdk.Duration.seconds(15),
        memorySize: 128,
        environment: { IMAGEUPLOADSDB_TABLE: imageUploadsTable.tableName}
      }
    );

    // //Generate image
    // const generateImageFn = new NodejsFunction(this, "GenerateImageFn", {
    //   architecture: lambda.Architecture.ARM_64,
    //   runtime: lambda.Runtime.NODEJS_18_X,
    //   entry: `${__dirname}/../lambdas/generateImage.ts`,
    //   timeout: Duration.seconds(10),
    //   memorySize: 128,
    // });

    const badImagesFn = new NodejsFunction(this, "BadImagesFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/handleBadImages.ts`,
      timeout: Duration.seconds(10),
      memorySize: 128,
    });

    const mailerFn = new lambdanode.NodejsFunction(this, "mailer-function", {
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      entry: `${__dirname}/../lambdas/mailer.ts`,
    });

    const rejectionMailerFn = new lambdanode.NodejsFunction(this, "rejection-mailer-function", {
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      entry: `${__dirname}/../lambdas/rejectionMailer.ts`,
    });

    // S3 --> SQS
    imagesBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SnsDestination(newImageTopic)  // Changed
  );

  //que subscriptions
  newImageTopic.addSubscription(new subs.SqsSubscription(imageProcessQueue));
  newImageTopic.addSubscription(new subs.SqsSubscription(mailerQ));
  newImageTopic.addSubscription(new subs.SqsSubscription(badImagesQueue));
  newImageTopic.addSubscription(new subs.SqsSubscription(rejectionMailerQ));

   // SQS --> Lambda
    const newImageEventSource = new events.SqsEventSource(imageProcessQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    });

    const newImageMailEventSource = new events.SqsEventSource(mailerQ, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    }); 

    const BadImageEventSource = new events.SqsEventSource(badImagesQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    });

    const rejectionMailerSource = new events.SqsEventSource(rejectionMailerQ, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    });

    //Triggers
    processImageFn.addEventSource(newImageEventSource);
    badImagesFn.addEventSource(BadImageEventSource);
    mailerFn.addEventSource(newImageMailEventSource);
    rejectionMailerFn.addEventSource(rejectionMailerSource);

    // Permissions

    imagesBucket.grantReadWrite(processImageFn);
    imageUploadsTable.grantReadWriteData(processImageFn);
    imageUploadsTable.grantWriteData(processImageFn);
    // imagesBucket.grantReadWrite(generateImageFn);

    //adding role policies for mails

    mailerFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail",
        ],
        resources: ["*"],
      })
    );

    rejectionMailerFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail",
        ],
        resources: ["*"],
      })
    );

    // Output
    
    new cdk.CfnOutput(this, "bucketName", {
      value: imagesBucket.bucketName,
    });
  }
}
