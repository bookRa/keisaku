require('dotenv').config()
const fs = require('fs');

const { S3Client, ListBucketsCommand, CreateBucketCommand, BucketAlreadyOwnedByYou, PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require('path');

const region = process.env.AWS_REGION
const keisakuKredentials = {
    accessKeyId: process.env.AWS_KEISAKU_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_KEISAKU_SECRET_ACCESS_KEY
}
const client = new S3Client({ region: region, credentials: keisakuKredentials });

const listBucketsCommand = new ListBucketsCommand({})

const attemptListBuckets = async () => {
    try {
        console.log("attempting to list buckets")
        console.log("***********************************")
        const data = await client.send(listBucketsCommand);
        console.log(data.Buckets)
    } catch (error) {
        console.log("there was an error")
        console.log(error)
    } finally {
        console.log("that's all folks")
    }
}

const createKeisakuS3Bucket = async () => {
    const createBucketInput = {
        Bucket: "keisaku"
    }

    const createBucketCommand = new CreateBucketCommand(createBucketInput)
    try {
        console.log("attempting to create Keisaku Bucket")
        console.log("***********************************")
        const bucketData = await client.send(createBucketCommand)
        console.log("successfully created bucket keisaku:")
        console.log(bucketData)
    } catch (error) {
        if (error.name === 'BucketAlreadyOwnedByYou') {
            console.info("keisaku bucket already exists, start uploading")
        }
        else {
            console.error("unexpected error creating Keisaku Bucket")
            console.error(error.code + ": " + error.message)
            console.log('**** log vs error ****')
            console.log(error)
            throw error
        }
    }
}

/**
 * 
 * @param {string} sessionDir Should be in the format of <DATE>/<SESSION_NUM>
 */
const putSessionObjects = async (sessionDir) => {
    try {
        // TODO: Make this configurable for any directory structure
        const absolutePath = path.join(__dirname, 'sessions_archive', sessionDir)

        console.log("attempting to upload data CSVs from " + absolutePath)
        console.log("***********************************")

        if (!fs.existsSync(absolutePath)) {
            throw "session dirctory " + sessionDir + " not found"
        }

        const filesToUpload = fs.readdirSync(absolutePath)
        for (file of filesToUpload) {
            console.log("uploading " + file)
            let fileStream = fs.createReadStream(path.join(absolutePath, file))

            const putObjectInput = {
                Bucket: "keisaku",
                Key: sessionDir +"/"+ file,
                Body: fileStream
            }

            const putObjectCommand = new PutObjectCommand(putObjectInput)
            const objectData = await client.send(putObjectCommand)
            console.log("successfully uploaded " + file + " to keisaku bucket:")
            // console.log(objectData)

        }
    } catch (error) {
        console.error("couldn't upload to Keisaku Bucket")
        console.error(error)
        throw error
    }
}

const uploadSessionData = async (sessionDir) => {
    await createKeisakuS3Bucket()
    await putSessionObjects(sessionDir)
    console.log("All done :)")
}

module.exports = {
    uploadSessionData
}