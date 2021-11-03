// copied from https://c2fo.github.io/fast-csv/docs/formatting/examples#appending-to-a-csv

const path = require('path');
const fs = require('fs');
const csv = require('@fast-csv/format');

// const initTodaysDir = () => fs.mkdirSync

const today = new Date();
const dayFormatted = `${today.getFullYear()}_${today.getMonth() + 1}_${today.getDate()}`
const todaysDir = path.join(__dirname, 'sessions_archive', dayFormatted)
const numSessions = fs.readdir(todaysDir, (err, files) => files.length)
// Structure is sessions_archive/date/Session_X/{timeSeries/bandPower/aux}.csv
const newSeshDir = path.join(todaysDir, `Session_${numSessions + 1}`)
let timeSeriesStream = fs.createWriteStream(path.join(newSeshDir, "timeSeries.csv"), { flags: 'a' })
    .on('error', (e) => { console.error("timeSeries WHOOPSIE"); console.error(e) })
let bandPowerStream = fs.createWriteStream(path.join(newSeshDir, "bandPower.csv"), { flags: 'a' })
    .on('error', (e) => { console.error("bandPower WHOOPSIE"); console.error(e) })
let auxilaryStream = fs.createWriteStream(path.join(newSeshDir, "auxilary.csv"), { flags: 'a' })
    .on('error', (e) => { console.error("aux WHOOPSIE"); console.error(e) })

const timeSeriesHeaders = (numChannels) => {
    let headers = ["time"]
    for (let i = 1; i <= numChannels; i++) {
        headers.push(`channel_${i}`)
    }
    return headers
}

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
    const bpHeaders = bandPowerHeaders(numChannels)
    writeToStream(timeSeriesStream, tsHeaders)
    writeToStream(bandPowerStream, bpHeaders)
    // TODO: Aux Headers and init
}

const appendTimeSeries = (row) => {
    writeToStream(timeSeriesStream, row)
}
const appendBandPower = (row) => {
    writeToStream(bandPowerStream, row)
}

const shutDownStreams = () => {
    timeSeriesStream.close()
    bandPowerStream.close()
    auxilaryStream.close()
}


module.exports = { shutDownStreams, appendBandPower, appendTimeSeries, initializeSessionCSVs}

class CsvFile {
    static write(filestream, rows, options) {
        return new Promise((res, rej) => {
            csv.writeToStream(filestream, rows, options)
                .on('error', err => rej(err))
                .on('finish', () => res());
        });
    }

    constructor(opts) {
        this.headers = opts.headers;
        this.path = opts.path;
        this.writeOpts = { headers: this.headers, includeEndRowDelimiter: true };
    }

    create(rows) {
        return CsvFile.write(fs.createWriteStream(this.path), rows, { ...this.writeOpts });
    }

    append(rows) {
        return CsvFile.write(fs.createWriteStream(this.path, { flags: 'a' }), rows, {
            ...this.writeOpts,
            // dont write the headers when appending
            writeHeaders: false,
        });
    }

    read() {
        return new Promise((res, rej) => {
            fs.readFile(this.path, (err, contents) => {
                if (err) {
                    return rej(err);
                }
                return res(contents);
            });
        });
    }
}

// const csvFile = new CsvFile({
//     path: path.resolve(__dirname, 'append.tmp.csv'),
//     // headers to write
//     headers: ['c', 'b', 'a'],
// });

// // 1. create the csv
// csvFile
//     .create([
//         { a: 'a1', b: 'b1', c: 'c1' },
//         { b: 'b2', a: 'a2', c: 'c2' },
//         { a: 'a3', b: 'b3', c: 'c3' },
//     ])
//     // append rows to file
//     .then(() =>
//         csvFile.append([
//             { a: 'a4', b: 'b4', c: 'c4' },
//             { a: 'a5', b: 'b5', c: 'c5' },
//         ]),
//     )
//     // append another row
//     .then(() => csvFile.append([{ a: 'a6', b: 'b6', c: 'c6' }]))
//     .then(() => csvFile.read())
//     .then(contents => {
//         console.log(`${contents}`);
//     })
//     .catch(err => {
//         console.error(err.stack);
//         process.exit(1);
//     });