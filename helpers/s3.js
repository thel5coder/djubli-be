const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const request = require('request');
const stream = require('stream');

const BUCKET_NAME = process.env.HDRIVE_S3_BUCKET;
const USER_KEY = process.env.HDRIVE_S3_ACCESS_KEY;
const USER_SECRET = process.env.HDRIVE_S3_SECRET_KEY;
const USER_LOCATION = process.env.HDRIVE_S3_LOCATION;

function uploadFromStream(s3, filename) {
  const pass = new stream.PassThrough();
  const params = {
    Bucket: BUCKET_NAME,
    Key: filename,
    Body: pass,
    ContentType: 'image/png',
    ACL: 'public-read'
  };
  s3.upload(params, (err, data) => {
    console.log(err, data);
  });

  return pass;
}

function base64MimeType(encoded) {
  let result = null;
  if (typeof encoded !== 'string') {
    return result;
  }

  const mime = encoded.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
  if (mime && mime.length) {
    // eslint-disable-next-line prefer-destructuring
    result = mime[1];
  }

  return result;
}

module.exports = {
  checkImageExtention(fileName) {
    const ext = path.extname(fileName);
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.gif' && ext !== '.jpeg') {
      return false;
    }
    return true;
  },

  remove(fileName) {
    const paths = `./public/${fileName}`;
    if (fs.existsSync(paths)) {
      fs.unlink(paths, err => {
        if (err) throw err;
      });
    }
  },

  // Handle file input with multer
  upload(directory, imagename, imagedata, encoding = 'binary') {
    fs.writeFile(
      `./public/${directory}/${imagename}`,
      imagedata,
      encoding === 'binary' ? 'binary' : { encoding },
      err => {
        if (err) throw err;
      }
    );
    return true;
  },

  // Upload S3
  uploadToS3(file) {
    const s3bucket = new AWS.S3({
      accessKeyId: USER_KEY,
      secretAccessKey: USER_SECRET,
      Bucket: BUCKET_NAME,
      region: USER_LOCATION
    });
    s3bucket.createBucket(() => {
      const params = {
        Bucket: BUCKET_NAME,
        Key: file.name,
        Body: file.data,
        ContentType: file.mimetype,
        ACL: 'public-read'
      };
      s3bucket.upload(params, (err, data) => {
        if (err) {
          console.log('error in callback');
          console.log(err);
        }
        console.log('success');
        console.log(data);
      });
    });
  },

  // Remove S3
  removeS3(file) {
    const s3bucket = new AWS.S3({
      accessKeyId: USER_KEY,
      secretAccessKey: USER_SECRET,
      Bucket: BUCKET_NAME,
      region: USER_LOCATION
    });
    s3bucket.createBucket(() => {
      const params = {
        Bucket: BUCKET_NAME,
        Key: file
      };
      s3bucket.deleteObject(params, (err, data) => {
        if (err) {
          console.log('error in callback');
          console.log(err);
        }
        console.log('success');
        console.log(data);
      });
    });
  },

  // Upload stream S3
  uploadStreamToS3(url, filename) {
    const s3bucket = new AWS.S3({
      accessKeyId: USER_KEY,
      secretAccessKey: USER_SECRET,
      Bucket: BUCKET_NAME
    });

    request(url).pipe(uploadFromStream(s3bucket, filename));
  },

  // Convert base64 to buffer
  base64toBuffer(base64string, name) {
    const arr = base64string.split(',').map(val => val);
    const result = {};
    if (arr) {
      result.data = Buffer.from(String(arr[1]), 'base64');
      result.mimetype = base64MimeType(base64string);
      const ext = result.mimetype.substr(result.mimetype.lastIndexOf('/') + 1);
      result.name = `${name}.${ext}`;
    }

    return result;
  }
};
