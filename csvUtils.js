// inspired by https://c2fo.github.io/fast-csv/docs/formatting/examples#appending-to-a-csv

const path = require('path');
const fs = require('fs');
const csv = require('@fast-csv/format');

const today = new Date();
const dayFormatted = `${today.getFullYear()}_${today.getMonth() + 1}_${today.getDate()}`
const todaysDir = path.join(__dirname, 'sessions_archive', dayFormatted)
console.log(`todaysDir is ${todaysDir}`)
if (!fs.existsSync(todaysDir)) {
    fs.mkdirSync(todaysDir, { recursive: true })
}
const todaysSessions = fs.readdirSync(todaysDir)
const numSessions = todaysSessions.length
console.log(`numSessions is ${numSessions}`)

// Structure is sessions_archive/date/Session_X/{timeSeries/bandPower/aux/focus}.csv
const newSessioNum = `Session_${numSessions + 1}`
const newSeshDir = path.join(todaysDir, newSessioNum)
fs.mkdirSync(newSeshDir)
const dateAndSessionDir = path.join(dayFormatted, newSessioNum) // S3 dir notation
const tsPath = path.join(newSeshDir, "timeSeries.csv")
// const bpPath = path.join(newSeshDir, "bandPower.csv")
const auxPath = path.join(newSeshDir, "auxillary.csv")
const focusPath = path.join(newSeshDir, "focus.csv")

const newWriteStream = (path) => fs.createWriteStream(path, { flags: 'a' })
    .on('error', e => {
        console.error(`${path} WHOOPSIE`);
        console.error(e)
    })

const timeSeriesHeaders = (numChannels) => {
    let headers = ["time"]
    for (let i = 1; i <= numChannels; i++) {
        headers.push(`channel_${i}`)
    }
    return headers
}

// Leaving this just in case,
// but I'll probably calculate BP from Raw (or filtered) timeseries
const bandPowerHeaders = (numChannels) => {
    let headers = ["time"]
    for (let i = 1; i <= numChannels; i++) {
        headers.push(`channel_${i}_Delta`)
        headers.push(`channel_${i}_Theta`)
        headers.push(`channel_${i}_Alpha`)
        headers.push(`channel_${i}_Beta`)
        headers.push(`channel_${i}_Gamma`)
    }
    return headers

}


const initializeSessionCSVs = (numChannels = 8) => {
    const tsHeaders = timeSeriesHeaders(numChannels)
    // const bpHeaders = bandPowerHeaders(numChannels)
    const auxHeaders = ["time", "shallow", "deep"]
    const focusHeaders = ["time", "focused"]
    csv.writeToStream(newWriteStream(tsPath), [tsHeaders], { includeEndRowDelimiter: true })
    // csv.writeToStream(newWriteStream(bpPath), [bpHeaders], { includeEndRowDelimiter: true })
    csv.writeToStream(newWriteStream(auxPath), [auxHeaders], { includeEndRowDelimiter: true })
    csv.writeToStream(newWriteStream(focusPath), [focusHeaders], { includeEndRowDelimiter: true })
}

const appendTimeSeries = (row) => {
    // console.log('\x1b[32m%s\x1b[0m', `adding ${row} to TimeSeries`)
    csv.writeToStream(newWriteStream(tsPath), [row], { includeEndRowDelimiter: true })
}
const appendBandPower = (row) => {
    // console.log('\x1b[35m%s\x1b[0m', `adding ${row} to BandPower`)
    csv.writeToStream(newWriteStream(bpPath), [row], { includeEndRowDelimiter: true })
}

const appendAux = (row) => {
    csv.writeToStream(newWriteStream(auxPath), [row], { includeEndRowDelimiter: true })
}

const appendFocus = (row) => {
    csv.writeToStream(newWriteStream(focusPath), [row], { includeEndRowDelimiter: true })
}

const shutDownStreams = () => {
    timeSeriesStream.close()
    bandPowerStream.close()
    auxilaryStream.close()
}


module.exports = {
    shutDownStreams,
    appendBandPower,
    appendTimeSeries,
    appendFocus,
    appendAux,
    initializeSessionCSVs,
    dateAndSessionDir
}