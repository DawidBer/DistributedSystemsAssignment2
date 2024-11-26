/* eslint-disable import/extensions, import/no-absolute-path */
import { SQSHandler } from "aws-lambda";
import {
  GetObjectCommand,
  PutObjectCommandInput,
  GetObjectCommandInput,
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { BadImage } from "shared/types";
import { DynamoDB, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { table } from "console";

const s3 = new S3Client();
const tableName = process.env.IMAGEUPLOADSDB_TABLE;
const region = 'eu-west-1';
const dynamoDBClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(dynamoDBClient);


export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));
  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);        // Parse SQS message
    const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message

    if (snsMessage.Records) {
      console.log("Record body ", JSON.stringify(snsMessage));
      for (const messageRecord of snsMessage.Records) {
        const s3e = messageRecord.s3;
        const srcBucket = s3e.bucket.name;
        // Object key may have spaces or unicode non-ASCII characters.
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
        let origimage = null;
        try {
          // Download the image from the S3 source bucket.
          const params: GetObjectCommandInput = {
            Bucket: srcBucket,
            Key: srcKey,
          };
          origimage = await s3.send(new GetObjectCommand(params));
          // Process the image ....
          const contentType = origimage.ContentType;
          const originalFileName = srcKey.split("/").pop();

          const putParams = {
            TableName: tableName,
            Item: {
              fileName: originalFileName
            },
          };

          console.log("Table Name: ", tableName);

          console.log("PutParams: ", JSON.stringify(putParams));

          if(contentType == "image/jpeg" || contentType == "image/png")
          { 
            //Log image upload in DynamoDB table
            try {
            await docClient.send(new PutCommand(putParams));
            console.log("Successfully logged image upload");
            } catch (error) {
              console.error("Error writing to dynamodb:", error);
            }
          } else {
            const BadImage = contentType as BadImage;
            console.log("Bad Image", BadImage);
            throw new Error("Bad Image");
          }
        } catch (error) {
          console.log(error);
        }
      }
    }
  }
};