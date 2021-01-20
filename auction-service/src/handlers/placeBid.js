import AWS from 'aws-sdk';
import createError from 'http-errors';
import validator from '@middy/validator';
import commonMiddleware from '../lib/commonMiddleware';
import { getAuctionById } from './getAuction';
import placeBidSchema from '../lib/schemas/placeBidSchema';

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function placeBid(event, context) {
	const { id } = event.pathParameters;
	const { amount } = event.body;
	const { email } = event.requestContext.authorizer;

	const auction = await getAuctionById(id);

	if (email === auction.seller) {
		throw new createError.Forbidden('You cannot bid on your own actions!');
	}

	if (email === auction.highestBid.bidder) {
		throw new createError.Forbidden('you are already the highest bidder');
	}

	if (auction.status !== 'OPEN') {
		throw new createError.Forbidden('You cannot bid on closed auctions!');
	}

	if (amount <= auction.highestBid.amount) {
		throw new createError.Forbidden(
			`Your bid must be higher than ${auction.highestBid.amount}!`,
		);
	}

	const params = {
		TableName: process.env.AUCTIONS_TABLE_NAME,
		Key: { id },
		UpdateExpression: 'set highestBid.amount = :amount, highestBid.bidder = :bidder',
		ExpressionAttributeValues: {
			':amount': amount,
			':bidder': email,
		},
		ReturnValues: 'ALL_NEW',
	};

	let updateAuction;

	try {
		const result = await dynamodb.update(params).promise();
		updateAuction = result.Attributes;
	} catch (error) {
		console.error(error);
		throw new createError.InternalServerError(error);
	}

	if (!updateAuction) {
		throw new createError.NotFound(`Auction with ID "${id}" not found`);
	}

	return {
		statusCode: 200,
		body: JSON.stringify(updateAuction),
	};
}

export const handler = commonMiddleware(placeBid).use(
	validator({
		inputSchema: placeBidSchema,
	}),
);
