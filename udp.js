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
  appendAux } = require('./csvUtils')
const { read } = require('fs')

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
let bandPowerPort = 12346
let auxPort = 12347
let focusPort = 12348

/**
 * Create a UDP server on a particular port
 * @param {String} dataType name the type of data being proccessed
 * @param {Number} port the port at which this is being streamed
 * @param {String} color color of the comments
 * @param {Function} parseFn how the raw UDP data will be parsed into a csv
 * @param {Boolean} verbose true if you want verbose comments
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
  let thedata = jsonified.data
  appendTimeSeries([timeStamp, ...thedata])
  return thedata
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

// TODO: need to practice with real digital data not the random aux synthetic
const auxParse = (dg, timeStamp) => {
  // {“type”:”auxiliary”,“data”:[0,1,0,1,0]}\r\n
  // Three (WiFi) or Five (Dongle) digital values as 0 or 1, corresponds to D11, D12, D13, D17, and D18
  let jsonified = JSON.parse(dg.toString())
  let thedata = jsonified.data
  // TODO: Plan to use D11 and D12 as input pins. So filter out the others
  const D11PIN_SHALLOW = 0
  const D12PIN_DEEP = 1
  const filteredData = [thedata[D11PIN_SHALLOW], thedata[D12PIN_DEEP]]
  appendAux([timeStamp, ...filteredData])
  return filteredData

}

let timeSeriesServer
// let bandPowerServer
let auxServer
let focusServer

stdin.on('data', (keyPress) => {

  // close app on ctrl-c or ctrl-d
  if (keyPress === '\u0003' || keyPress === '\u0004') {
    console.log("aborting Session and closing without uploading data")
    process.exit()
  }

  else if (keyPress === "s") {
    initializeSessionCSVs()
    timeSeriesServer = createAndBind('TimeSeries', timeSeriesPort, TSCOLOR, tsParse)
    focusServer = createAndBind('Focus Estimate', focusPort, FOCUSCOLOR, verbose = true)
    // bandPowerServer = createAndBind('BandPower', bandPowerPort, BPCOLOR, bandPowerParse)
    auxServer = createAndBind('Auxillary', auxPort, AUXCOLOR, auxParse, verbose = true)
  }

  else if (keyPress === "c") {
    // close and upload data to the cloud
    try { timeSeriesServer.close() }
    catch (e) { console.log("error closing timeseries server"); console.log(e) }
    // try { bandPowerServer.close() }
    // catch (e) { console.log("error closingbandPowerServer"); console.log(e) }
    try { focusServer.close() }
    catch (e) { console.log("error closing focusServer"); console.log(e) }
    try { auxServer.close() }
    catch (e) { console.log("error closing auxServer"); console.log(e) }
    process.exit()
  }
})