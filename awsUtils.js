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

/**
 * TODO: Because the GUI and Keisaku are two different applications, there is an
 * implied order of operations for successfully uploading both Keisaku and GUI data to Cloud.
 * This is succeptible to human error and should be fixed so that it just works automatically.
 * 
 * The (Windows) GUI stores Session data in C:\Users\<USER>\Documents\OpenBCI_GUI\Recordings
 * Every Session (from "System Control Panel" > "Start Session" to "System Control Panel" > "Stop Session")
 * is given its own directory with the nomenclature "OpenBCISession_YYYY-MM-DD_hh-mm-ss" (session start timestamp)
 * 
 * Every Data Stream within a Session (From "Start Data Stream" to "Stop Data Stream") is given its own
 * recording txt file within the Session directory.
 * Its nomenclature is "OpenBCI-RAW-YYYY-MM-DD_hh-mm-ss" (datastream start timestamp)
 * 
 * This function takes the most recent GUI Session (which should have the same Date as the Keisaku Data being uploaded)
 *  and uploads all the RAW files to S3. Ideally, there should only be one Data Stream RAW per session. However if unforseen
 * Stops and Starts happen while keisaku still running, having the RAW timestamps will be useful to filter out noisy or
 * empty Keisaku data.
 * 
 * ASSUMPTION/Order of Operations: User should "Stop Data Stream" in GUI first (Stop Session optional), AND THEN press "C" in
 * terminal to upload 
 * 
 * TODO: What happens if the function is called withle the Data Stream is still running? Will it upload a corrupted
 * (or unclosed) CSV?
 * 
 */
const uploadGUIRecording = async (bucketSessionPath = "TEST") => {

    const GUI_RECORDING_PATH = "/mnt/c/Users/omara/Documents/OpenBCI_GUI/Recordings"
    const today = new Date()
    const todayFormatted = `${today.getFullYear()}-${today.getMonth() + 1}-20` // TODO: REPLACE 20 with ${today.getDate()}`
    console.log(`todayFormat is ${todayFormatted}`)
    const sessionDirs = fs.readdirSync(GUI_RECORDING_PATH)
    const todaysSessions = sessionDirs.filter(f => f.includes(todayFormatted)).sort()
    if (!todaysSessions.length) {
        console.error('\x1b[35m%s\x1b[0m', `Unexpected Error: No GUI Session recordings were found`)
        throw "No GUI Raw data found to upload"
    }
    if (todaysSessions.length > 1) {
        console.error('\x1b[35m%s\x1b[0m', `WARNING: Multiple GUI Sessions found today, only uploading latest Data Streams`)

    }
    console.log("Today's sessions:")
    console.log(todaysSessions)
    const sessionToUploadDir = path.join(GUI_RECORDING_PATH, todaysSessions.at(-1))
    const dataStreamFiles = fs.readdirSync(sessionToUploadDir)
    console.log("session to Upload's data files")
    console.log(dataStreamFiles)

    for (file of dataStreamFiles) {
        console.log("uploading " + file)
        let fileStream = fs.createReadStream(path.join(sessionToUploadDir, file))

        const putObjectInput = {
            Bucket: "keisaku",
            Key: bucketSessionPath +"/GUI_RAW_FILES/"+ file,
            Body: fileStream
        }

        const putObjectCommand = new PutObjectCommand(putObjectInput)
        const objectData = await client.send(putObjectCommand)
        console.log("successfully uploaded " + file + " to keisaku bucket:")
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

uploadGUIRecording()