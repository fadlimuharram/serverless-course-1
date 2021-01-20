import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import createError from 'http-errors';
import { getAuctionById } from './getAuction';
import { uploadPictureToS3 } from '../lib/uploadPictureToS3';
import { setAuctonPictureUrl } from '../lib/setAuctionPictureUrl';
import uploadAuctionPictureScheme from '../lib/schemas/uploadAuctionPictureScheme';
import validator from '@middy/validator';
import cors from '@middy/http-cors';

export async function uploadAuctionPicture(event) {
	const { id } = event.pathParameters;
	const { email } = event.requestContext.authorizer;
	const auction = await getAuctionById(id);
	const base64 = event.body.replace(/^data:image\/\w+;base64,/, '');
	const buffer = Buffer.from(base64, 'base64');

	let updatedAuction;

	if (auction.seller !== email) {
		throw new createError.Forbidden(`You're not the seller of this auction!`);
	}

	try {
		const pictureUrl = await uploadPictureToS3(auction.id + '.jpg', buffer);
		updatedAuction = await setAuctonPictureUrl(auction.id, pictureUrl);
		console.log(pictureUrl);
	} catch (error) {
		console.error(error);
		throw new createError.InternalServerError(error);
	}
	return {
		statusCode: 200,
		body: JSON.stringify(updatedAuction),
	};
}

export const handler = middy(uploadAuctionPicture)
	.use(httpErrorHandler())
	.use(validator({ inputSchema: uploadAuctionPictureScheme }))
	.use(cors());
