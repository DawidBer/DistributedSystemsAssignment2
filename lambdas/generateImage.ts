// import { Handler } from "aws-lambda";
// import {
//   SQSClient,
//   SendMessageBatchCommand,
//   SendMessageBatchCommandInput,
//   SendMessageBatchRequestEntry,
// } from "@aws-sdk/client-sqs";
// import { v4 } from "uuid";
// import { Metadata } from "../shared/types";
// import { BadImage } from "../shared/types";
// import { strict } from "assert";
// import { stringify } from "querystring";
// import * as fs from "fs"; 
// import * as path from "path"; 
// import {
//     GetObjectCommand,
//     PutObjectCommandInput,
//     GetObjectCommandInput,
//     S3Client,
//     PutObjectCommand,
//   } from "@aws-sdk/client-s3";

// const s3 = new S3Client();
// export const handler = async () => {
//     const bucketName = "edastack-images9bf4dcd5-3dgejs7hpszw";
//     const objectKey = "image1.jpeg";
//     const imagePath = path.resolve(__dirname,"images/sunflower.jpeg");


// try {
//     const imageData = fs.readFileSync(imagePath);

//     const params: PutObjectCommandInput = { 
//         Bucket: bucketName,
//         Key: objectKey,
//         Body: imageData,
//         ContentType: "image/jpeg",
//         Metadata: {
//             processedby: "LambdaFunction",
//             timestamp: "20-20-23",
//             description: "Testing 123",
//         },
//     }

//     const response = await s3.send(new PutObjectCommand(params));

//     return {
//         statusCode: 200,
//         body: "Image qued for processing",
//       };
//     } catch (error) {
//         return {
//             statusCode: 500,
//             body: "Error uploading image.",
//         };
//     }
// }
