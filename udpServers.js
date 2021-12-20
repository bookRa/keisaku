// This Server listens on 3 ports for 3 types of data being sent from OpenBCI GUI
const { timeStamp } = require('console')
const udp = require('dgram')
const os = require('os')

// Initialize keypress listening for the node CLI app (https://stackoverflow.com/a/12506613/10167851)
const readline = require('readline')
const { stdin } = require('process')
readline.emitKeypressEvents(stdin)
stdin.setRawMode(true)
stdin.resume()
stdin.setEncoding('utf8')

const {
  initializeSessionCSVs,
  appendTimeSeries,
  appendBandPower,
  appendAux,
  appendFocus,
  dateAndSessionDir } = require('./csvUtils')

const { uploadSessionData } = require('./awsUtils')

// OpenBCI GUI is running in Windows, this app is running in WSL
let linuxIp = os.networkInterfaces().eth0[0].address
console.log('\x1b[31m%s\x1b[0m', "UDP server running on the following IP. " +
  "Copy & Paste to OpenBCI Networking Widget")
console.log('\x1b[31m%s\x1b[0m', linuxIp)
// TODO: auto-copy to clipboard so that I can just
// paste into the GUI (Or modify GUI so it sets IPs to WSL Host)


let TSCOLOR = '\x1b[32m%s\x1b[0m' //Green
let BPCOLOR = '\x1b[33m%s\x1b[0m' //Yellow
let AUXCOLOR = '\x1b[35m%s\x1b[0m' //Magenta
let FOCUSCOLOR = "\x1b[36m" //Cyan

// The following ports must correspond to the ports
// in the OpenBCI Networking Widget. 
// It is a savable setting in the GUI
let timeSeriesPort = 12345
let focusPort = 12346
let auxPort = 12347
// let bandPowerPort = 12346

/**
 * Create a UDP server on a particular port
 * @param {String} dataType name the type of data being proccessed
 * @param {Number} port the port at which this is being streamed
 * @param {String} color color of the comments
 * @param {Function} parseFn how the raw UDP data will be parsed into a csv
 * @param {Boolean} verbose true if you want verbose logs
 * @returns the UDP server
 */
const createAndBind = (
  dataType,
  port,
  color,
  parseFn = (datagram, timeStamp) => datagram.toString().slice(0, 10),
  verbose = false) => {
  let server = udp.createSocket('udp4')

  server.on('error', (err) => {
    console.log(color, `${dataType} error:`)
    console.log(color, err)
    server.close()
  })

  server.on('message', (msg, info) => {
    let rawMsg = msg.toString()
    let parsedMsg = parseFn(msg, Date.now())
    if (verbose) {
      console.log(color, `${Date.now()}:: Raw ${dataType}: ${rawMsg} Parsed:`)
      console.log(color, parsedMsg)
    }
  })

  server.on('close', () => {
    console.log(color, `${dataType} socket closed!`)
  })

  server.bind(port, linuxIp, () => {
    console.log(color, `Started ${dataType} listener`)
  })

  return server
}

const tsParse = (dg, timeStamp) => {
  // {“type”:”eeg”, “data”:[0.0,1.0,2.0,3.0]}\r\n
  // (Filtered & Unfiltered) One float for each channel
  let jsonified = JSON.parse(dg.toString())
  let theData = jsonified.data
  appendTimeSeries([timeStamp, ...theData])
  return theData
}

const bandPowerParse = (dg, timeStamp) => {
  // {“type”:"bandPower", “data”:[[ch1 bands],[ch2 bands],[etc. bands]]}\r\n
  // 5 floats representing Delta, Theta, Alpha, Beta, Gamma band power for each channel in this exact order
  let nested = JSON.parse(dg.toString()).data
  let numChannels = nested.length
  // TODO: Setup logger
  // console.log(numChannels + " channels detected")
  let flattened = nested.flat()
  appendBandPower([timeStamp, ...flattened])
  return flattened
}

const auxParse = (dg, timeStamp) => {
  // {“type”:”auxiliary”,“data”:[0,1,0,1,0]}\r\n
  // Three (WiFi) or Five (Dongle) digital values as 0 or 1, corresponds to D11, D12, D13, D17, and D18
  // Will be using Dongle for forseeable future
  const usingDongle = true // TODO: Best place to put this config?
  let jsonified = JSON.parse(dg.toString())
  let theData = jsonified.data

  // "accelerometer" and analog auxiliary dgram comes in on same port;
  // TODO: could acceleration data be useful for filtering out artifacts?
  let isDigitalReadData = (jsonified.type == "auxiliary") &&
    // analog aux data will never (🤞) have length 5, so it's an easy check if we're using the dongle
    // if we're using WiFi Shield, need exhaustive check for non 1/0 values
    // TODO: is there a corner case where all the analog values happen to be <= 1?
    ((usingDongle && theData.length === 5) || (!usingDongle && theData.every(value => value === 0 || value === 1)))

  if (isDigitalReadData) {
    // TODO: Plan to use D11 and D12 as input pins. So filter out the others
    const D11PIN_SHALLOW = 0
    const D12PIN_DEEP = 1
    const filteredData = [theData[D11PIN_SHALLOW], theData[D12PIN_DEEP]]
    appendAux([timeStamp, ...filteredData])
    return filteredData
  }
}

const focusParse = (dg, timeStamp) => {
  // {"type":"focus","data":0.0]}
  let jsonified = JSON.parse(dg.toString())
  let thedata = jsonified.data
  // data comes in as a float but signal is actually a BOOL so turn to int
  let focusMeasure = thedata | 0 // Bitwise OR is best https://stackoverflow.com/a/12837315/10167851
  appendFocus([timeStamp, focusMeasure])
  return focusMeasure
}

let timeSeriesServer
// let bandPowerServer
let auxServer
let focusServer
let sessionStarted = false

stdin.on('data', (keyPress) => {

  if (!sessionStarted && keyPress === 's') {
    console.log("starting session")
    initializeSessionCSVs()
    timeSeriesServer = createAndBind('TimeSeries', timeSeriesPort, TSCOLOR, tsParse)
    focusServer = createAndBind('Focus', focusPort, FOCUSCOLOR, focusParse)
    // bandPowerServer = createAndBind('BandPower', bandPowerPort, BPCOLOR, bandPowerParse)
    auxServer = createAndBind('Auxillary', auxPort, AUXCOLOR, auxParse)
    sessionStarted = true;

  }

  // close app on ctrl-c or ctrl-d
  else if (keyPress === '\u0003' || keyPress === '\u0004') {
    console.log("aborting Session and closing without uploading data")
    process.exit()
  }

  else if (sessionStarted && keyPress === "c") {
    console.log("shutting down servers")
    // close and upload data to the cloud
    try { timeSeriesServer.close() }
    catch (e) { console.log("error closing timeseries server"); console.log(e) }
    // try { bandPowerServer.close() }
    // catch (e) { console.log("error closingbandPowerServer"); console.log(e) }
    try { focusServer.close() }
    catch (e) { console.log("error closing focusServer"); console.log(e) }
    try { auxServer.close() }
    catch (e) { console.log("error closing auxServer"); console.log(e) }
    console.log("uploading session data to cloud...")
    // TODO
    uploadSessionData(dateAndSessionDir)
      .then(() => {
        console.log("successfully uploaded session data")
      }).catch(e => {
        console.log("error uploading session data")
        console.log(e)
      }).finally(() => process.exit())
  }
})