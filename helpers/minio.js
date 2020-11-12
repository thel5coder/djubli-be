const fs = require('fs');
const path = require('path');
const request = require('request');
const stream = require('stream');
const minio = require('minio');

const endPoint = process.env.MINIO_ENDPOINT;
const accessKey = process.env.MINIO_ACCESS_KEY_ID;
const secretKey = process.env.MINIO_SECRET_ACCESS_KEY;
const useSSL = JSON.parse(process.env.MINIO_USE_SSL);
const port = parseInt(process.env.MINIO_PORT);
const MINIO_BASE_URL = process.env.MINIO_BASE_URL;
const bucket = process.env.MINIO_DEFAULT_BUCKET;

const minioClient = new minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey
});

// If fileName exist replace the data
async function upload(fileName, fileBuffer) {
    return await minioClient.putObject(bucket, fileName, fileBuffer).then(etag => {
    	return { etag };
    }).catch(error => {
    	return { error };
    });
}

async function destroy(fileName) {
    return await minioClient.removeObject(bucket, fileName).catch(error => {
    	return { error };
    });
}

module.exports = {
	upload,
	destroy
}