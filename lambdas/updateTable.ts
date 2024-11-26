//update table triggers when metadata is added to image
import { SQSHandler } from "aws-lambda";
import { SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION } from "../env";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import {
    DynamoDBClient,
    UpdateItemCommand,
  } from "@aws-sdk/client-dynamodb";

    const tableName = process.env.IMAGEUPLOADSDB_TABLE;
    const region = 'eu-west-1';
    const client = new SESClient({ region: SES_REGION});
    const dynamoDBClient = new DynamoDBClient({ region });

export const handler: SQSHandler = async (event: any) => {
  console.log("Event ", JSON.stringify(event));

  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);

    console.log("record Body output",recordBody);

    const snsMessage = JSON.parse(recordBody.Message);

    console.log("snsMessage output", snsMessage);

    const { id, value, date, name} = snsMessage;

    console.log("invdividual values", id, value, date, name);

    const metaDate = date.toString();
    console.log("metaDate output", metaDate);

    const metaValue = value.toString();
    console.log("metaValue output ", metaValue);

    const metaName = name.toString();
    console.log("metaName", metaName);


    if(!id || !value || !date || !name)
    {
        console.log("Missing required data in the message");
        continue;
    }
        console.log(`updating metadata for image: ${id}`);
        console.log(`name: ${name}, value: ${value}, date: ${date}`);

        try {
            const updateCommand = new UpdateItemCommand({
                TableName: tableName,
                Key: {
                 fileName: {S: id},
                },
                UpdateExpression: `SET #addcaption = :value, #addDate = :date, #addphotoName = :name`,
                ExpressionAttributeNames: {
                    "#addcaption": "Caption",
                    "#addDate": "Date",
                    "#addphotoName": "Name",
                },
                ExpressionAttributeValues: {
                    ":value": { S: metaValue },
                    ":date": { S: metaDate },
                    ":name": { S: metaName }, 
                },
            });

            const updateResponse = await dynamoDBClient.send(updateCommand);
            console.log("table item updated successfully", updateResponse);
        } catch (error) {
            console.log("Error updating table", error);
            console.log("Error updating table", {fileName: id});
        }
  }
};

//update function