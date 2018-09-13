'use strict';

const functions = require('firebase-functions');
const mkdirp = require('mkdirp-promise');
// Include a Service Account Key to use a Signed URL
const gcs = require('@google-cloud/storage')({
  keyFilename: 'service-account-credentials.json',
  projectId: 'jjong-37fd6'
});
const admin = require('firebase-admin');
admin.initializeApp();

const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');

const tinify = require('tinify');
const TINIFY_KEY = 'TF9J2wXJS1winz9kbzCHfvIrcQ2r2ok4';
const TINIFIED_IMAGE_PREFIX = 'tinified_';
const USE_TINIFY_NODE_API = false; // Spark plan doesn't allow external api call

const FIRESTORE_TRIGGER_PATH = '/notes/{key}';
const STORAGE_IMAGE_FOLDER = 'images';
const STORAGE_VIDEO_FOLDER = 'videos';
const IMAGE_MAX_HEIGHT = 800;
const IMAGE_MAX_BYTES = 500000; // resize if greater than 500kb
const RESIZED_IMAGE_PREFIX = 'resized_';

function getFilename(url) { // returns 'Sarah.jpg' or 'bunny.mp4'
  if (url) {
    const downloadUrl = url.indexOf('firebasestorage.googleapis.com'); // or signedUrl with 'storage.googleapis.com'
    const END_MATCHER = downloadUrl > -1 ? '?alt=' : '?GoogleAccessId=';
    let begin = url.indexOf(`/${STORAGE_IMAGE_FOLDER}`); // .../images%2f or .../images/
    if (begin === -1) begin = url.indexOf(`/${STORAGE_VIDEO_FOLDER}`); // .../videos%2f or .../videos/
    const end = url.indexOf(END_MATCHER);
    //console.log(`getFilename(${downloadUrl},${END_MATCHER},${begin},${end})`)
    if (begin > -1 && end > -1) {
      const skip = url[begin + 7] === '%' ? 10 : 8;
      return url.slice(begin + skip, end);
    } else {
      //return url;
      throw `getFilename() got invalid url: ${url}`;
    }
  }
  return null;
}

function getFilepath(url) { // returns 'images/Sarah.jpg' or 'videos/bunny.mp4'
  if (url) {
    const downloadUrl = url.indexOf('firebasestorage.googleapis.com'); // or signedUrl with 'storage.googleapis.com'
    const END_MATCHER = downloadUrl > -1 ? '?alt=' : '?GoogleAccessId=';
    let begin = url.indexOf(`/${STORAGE_IMAGE_FOLDER}`); // .../images%2f or .../images/
    let folder = STORAGE_IMAGE_FOLDER;
    if (begin === -1) {
      begin = url.indexOf(`/${STORAGE_VIDEO_FOLDER}`); // .../videos%2f or .../videos/
      folder = STORAGE_VIDEO_FOLDER;
    } 
    const end = url.indexOf(END_MATCHER);
    //console.log(`getFilepath(${downloadUrl},${END_MATCHER},${begin},${end})`)
    if (begin > -1 && end > -1) {
      const skip = url[begin + 7] === '%' ? 10 : 8;
      return `${folder}/${url.slice(begin + skip, end)}`;
    } else {
      //return url;
      throw `getFilepath() got invalid url: ${url}`;
    }
  }
  return null;
}

function deleteImage(url) {
  const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
  const bucketName = firebaseConfig.storageBucket;
  const bucket = gcs.bucket(bucketName);

  const filePath = getFilepath(url);
  const file = bucket.file(filePath);

  return file.delete().then(data => {
    console.log('image deleted:', filePath);
  });
}

function getSize(file) {
  return file.getMetadata().then(data => {
    const metadata = data[0];
    return metadata.size;
  });
}

exports.handleImage = functions.firestore.document(FIRESTORE_TRIGGER_PATH).onWrite((change, context) => { // actually handles videos as well
  try {
    var current = change.after.data();
  } catch (e) {
    console.log('current document null');
  }
  try {
    var previous = change.before.data();
  } catch (e) {
    console.log('previous document null');
  }
  
  if (!current) {
    if (previous && previous.imageURL) { // note with image deleted
      return deleteImage(previous.imageURL);
    } else {
      return 'current document null';
    }
  }

  if (!current.imageURL) {
    if (previous && previous.imageURL) { // note imageURL deleted
      return deleteImage(previous.imageURL);
    } else {
      return 'current imageURL null';
    }
  }

  const currentFile = getFilename(current.imageURL); // e.g. 'Sarah.jpg'

  if (currentFile.startsWith(RESIZED_IMAGE_PREFIX)) {
    return 'Already resized';
  }

  const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
  const bucketName = firebaseConfig.storageBucket;
  const bucket = gcs.bucket(bucketName);

  const filePath = getFilepath(current.imageURL); // 'videos/Jjong.mp4'
  console.log(`getFilepath, '${filePath}'`);
  
  if (filePath.startsWith(STORAGE_VIDEO_FOLDER)) {
    if (previous && previous.imageURL) { // note image changed, to delete previous image
      return deleteImage(previous.imageURL);
    } else {
      return 'video file';
    }
  }

  // got image file, resize it when possible, replace in storage and update url in database
  const fileDir = path.dirname(filePath);
  const fileName = path.basename(filePath);

  const thumbFilePath = path.normalize(path.join(fileDir, 
    `${RESIZED_IMAGE_PREFIX}${IMAGE_MAX_HEIGHT}_${fileName}`)); // 'images/resized_800_Sarah.jpg'
  const tinifiedFilePath = path.normalize(path.join(fileDir, 
    `${TINIFIED_IMAGE_PREFIX}${fileName}`)); // 'images/tinified_Sarah.jpg'
  
  const tempLocalFile = path.join(os.tmpdir(), filePath); // 'c:/temp/images/Sarah.jpg'
  const tempLocalDir = path.dirname(tempLocalFile); // 'c:/temp'
  const tempLocalThumbFile = path.join(os.tmpdir(), thumbFilePath); // 'c:/temp/images/resized_800_Sarah.jpg'
  const tempLocalTinifiedFile = path.join(os.tmpdir(), tinifiedFilePath); // 'c:/temp/images/tinified_Sarah.jpg'

  const file = bucket.file(filePath);
  const thumbFile = bucket.file(thumbFilePath);
  const tinifiedFile = USE_TINIFY_NODE_API ? bucket.file(tinifiedFilePath) : null;

  return getSize(file).then(size => {

    if (size < IMAGE_MAX_BYTES) {
      console.log(`image file small enough, ${size} bytes`);
      return 'image file small enough';
    }
    console.log(`image: ${currentFile}, ${size} bytes`);

    return mkdirp(tempLocalDir).then(() => {
      return file.download({ destination: tempLocalFile });
    }).then(() => {
      if (!USE_TINIFY_NODE_API) return 'skip Trinify';

      tinify.key = TINIFY_KEY;
      return tinify.fromFile(tempLocalFile).toFile(tempLocalTinifiedFile);
    }).then(() => {
      if (!USE_TINIFY_NODE_API) return 'skip Trinify';

      return getSize(tempLocalTinifiedFile);
    }).then((size) => {
      if (USE_TINIFY_NODE_API)
        console.log(`tinified: ${tempLocalTinifiedFile}, ${size} bytes`);

      return spawn('convert', [tempLocalFile, '-resize', `${IMAGE_MAX_HEIGHT}x${IMAGE_MAX_HEIGHT}>`, tempLocalThumbFile]);
    }).then(() => {
      return bucket.upload(tempLocalThumbFile, { destination: thumbFilePath });
    }).then(() => {
      console.log('Resized as:', thumbFilePath);
      // Once the image has been uploaded delete the local files to free up disk space.
      fs.unlinkSync(tempLocalFile);
      fs.unlinkSync(tempLocalThumbFile);
      if (USE_TINIFY_NODE_API) fs.unlinkSync(tempLocalTinifiedFile);
      // Get the Signed URL for the resized image
      const config = {
        action: 'read',
        expires: '03-01-2500'
      };
      return Promise.all([
        thumbFile.getSignedUrl(config),
      ]);
    }).then(results => {
      const thumbResult = results[0];
      const thumbFileUrl = thumbResult[0];

      return change.after.ref.set({
        imageURL: thumbFileUrl
      }, { merge: true });
    }).then(result => {
      //console.log('database.imageURL updated');
      // delete original file in storage
      return file.delete();
    }).then(result => {
      //console.log('original image deleted from storage');
      if (previous && previous.imageURL) { // note image changed, to delete previous image
        return deleteImage(previous.imageURL);
      }
    }).catch(error => console.log('Error in handleImage(): ', error));

  });
});
