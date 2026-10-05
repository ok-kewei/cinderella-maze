// The Top 10's storage: one DynamoDB table holding three kinds of item, told apart by the key's prefix.
//   S#<session>          a game in progress (expires after a day)
//   H#<score id>         a saved score; the ByScore index lists each board's scores, highest first
//   R#<kind>#<player>#<hour>  how many requests a player made this hour (expires soon after)
// The AWS SDK comes with the Lambda Node.js runtime, so nothing is bundled.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

export function dynamoStore(TableName, client = DynamoDBDocumentClient.from(new DynamoDBClient({}))) {
  const failedCondition = e => e?.name === 'ConditionalCheckFailedException'
    || (e?.name === 'TransactionCanceledException' && (e.CancellationReasons ?? []).some(r => r?.Code === 'ConditionalCheckFailed'));

  return {
    // Counts one request; false once the player is over the limit.
    async hit(pk, limit, ttl) {
      try {
        await client.send(new UpdateCommand({
          TableName, Key: { pk },
          UpdateExpression: 'ADD n :one SET #ttl = if_not_exists(#ttl, :ttl)',
          ConditionExpression: 'attribute_not_exists(n) OR n < :limit',
          ExpressionAttributeNames: { '#ttl': 'ttl' },
          ExpressionAttributeValues: { ':one': 1, ':limit': limit, ':ttl': ttl },
        }));
        return true;
      } catch (e) {
        if (failedCondition(e)) return false;
        throw e;
      }
    },

    async createSession(item) {
      await client.send(new PutCommand({ TableName, Item: item, ConditionExpression: 'attribute_not_exists(pk)' }));
    },

    async getSession(pk) {
      const { Item } = await client.send(new GetCommand({ TableName, Key: { pk }, ConsistentRead: true }));
      // DynamoDB deletes expired items a little late, so check the expiry too.
      return Item && Item.ttl * 1000 > Date.now() ? Item : null;
    },

    // Saves the score and marks the game as used, both or neither. False if the game was already used.
    async recordScore(sessionPk, item, submitted) {
      try {
        await client.send(new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName, Item: item, ConditionExpression: 'attribute_not_exists(pk)' } },
            {
              Update: {
                TableName, Key: { pk: sessionPk },
                UpdateExpression: 'SET submitted = :s',
                ConditionExpression: 'attribute_exists(pk) AND attribute_not_exists(submitted)',
                ExpressionAttributeValues: { ':s': submitted },
              },
            },
          ],
        }));
        return true;
      } catch (e) {
        if (failedCondition(e)) return false;
        throw e;
      }
    },

    async top(board, limit) {
      const { Items = [] } = await client.send(new QueryCommand({
        TableName, IndexName: 'ByScore',
        KeyConditionExpression: 'board = :b', ExpressionAttributeValues: { ':b': board },
        ScanIndexForward: false, Limit: limit,
      }));
      return Items;
    },

    // How many scores on a board beat this one (for "you placed #27").
    async countAbove(board, score) {
      let count = 0, ExclusiveStartKey;
      for (let page = 0; page < 20; page++) {
        const r = await client.send(new QueryCommand({
          TableName, IndexName: 'ByScore', Select: 'COUNT',
          KeyConditionExpression: 'board = :b AND score > :s', ExpressionAttributeValues: { ':b': board, ':s': score },
          ExclusiveStartKey,
        }));
        count += r.Count ?? 0;
        ExclusiveStartKey = r.LastEvaluatedKey;
        if (!ExclusiveStartKey) break;
      }
      return count;
    },
  };
}
