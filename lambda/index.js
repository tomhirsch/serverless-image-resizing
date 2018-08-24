'use strict';

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
  signatureVersion: 'v4',
});
const Sharp = require('sharp');

const BUCKET = process.env.BUCKET;
const URL = process.env.URL;
const ALLOWED_DIMENSIONS = new Set();

if (process.env.ALLOWED_DIMENSIONS) {
  const dimensions = process.env.ALLOWED_DIMENSIONS.split(/\s*,\s*/);
  dimensions.forEach((dimension) => ALLOWED_DIMENSIONS.add(dimension));
}

exports.handler = function(event, context, callback) {
  const key = event.queryStringParameters.key;

  const matchWidth = key.match(/width=(\d*)/);
  const matchHeight = key.match(/height=(\d*)/);
  const matchMode = key.match(/mode=(\S*)/);
  const matchOriginalKey = key.match(/\/((\S*).(\S*))(\??)/);

  const dimensions = `${matchWidth[1]}x${matchHeight[1]}`;
  const width = parseInt(matchWidth[1], 10);
  const height = parseInt(matchHeight[1], 10);
  const originalKey = matchOriginalKey[1];
  const mode = matchMode ? matchMode[1] : 'crop';

  if(ALLOWED_DIMENSIONS.size > 0 && !ALLOWED_DIMENSIONS.has(dimensions)) {
     callback(null, {
      statusCode: '403',
      headers: {},
      body: '',
    });
    return;
  }

  S3.getObject({Bucket: BUCKET, Key: originalKey}).promise()
    .then(data => {
        if (mode === 'resize') {
          return Sharp(data.Body).resize(width, height).max().toFormat('jpg').toBuffer()    
        } else {
          return Sharp(data.Body).resize(width, height).toFormat('jpg').toBuffer()
        }
    })
    .then(buffer => S3.putObject({
        Body: buffer,
        Bucket: BUCKET,
        ContentType: 'image/jpeg',
        Key: key,
      }).promise()
    )
    .then(() => callback(null, {
        statusCode: '301',
        headers: {'location': `${URL}/${key}`},
        body: '',
      })
    )
    .catch(err => callback(err))
}
