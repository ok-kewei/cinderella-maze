// Lambda entry point: wires the API to the DynamoDB table named in the function's settings.
import { makeApp } from './app.mjs';
import { dynamoStore } from './store-dynamodb.mjs';

export const handler = makeApp({ store: dynamoStore(process.env.TABLE_NAME), secret: process.env.ORIGIN_SECRET });
