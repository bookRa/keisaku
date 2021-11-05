// Listens on 3 ports for 3 types of data being sent from OpenBCI GUI
var udp = require('dgram')
const { initializeSessionCSVs, appendTimeSeries, appendBandPower } = require('./csvUtils')

let linuxIp = '172.30.53.96'

let TSCOLOR = '\x1b[32m%s\x1b[0m'
let BPCOLOR = '\x1b[35m%s\x1b[0m'
let AUXCOLOR = '\x1b[33m%s\x1b[0m'

let timeSeriesPort = 12345
let bandPowerPort = 12346
let auxPort = 12347

const createAndBind = (dataType, port, color, parseFn = (datagram, timeStamp) => datagram.toString().slice(0, 10)) => {
  let server = udp.createSocket('udp4')

  server.on('error', (err) => {
    console.log(color, `${dataType} error:`)
    console.log(color, err)
    server.close()
  })

  server.on('message', (msg, info) => {
    let rawMsg = msg.toString()
    let parsedMsg = parseFn(msg, Date.now())
    console.log(color, `${Date.now()}:: Raw ${dataType}: ${rawMsg} Parsed:`)
    console.log(color, parsedMsg)

    // server.close()
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
  console.log(numChannels + " channels detected")
  let flattened = nested.flat()
  appendBandPower([timeStamp, ...flattened])
  return flattened
}

// TODO: need to practice with real digital data not the random aux synthetic
const auxParse = (dg) => {
  // {“type”:”auxiliary”,“data”:[0,1,0,1,0]}\r\n
  // Three (WiFi) or Five (Dongle) digital values as 0 or 1, corresponds to D11, D12, D13, D17, and D18
}

initializeSessionCSVs()
let timeSeriesServer = createAndBind('TimeSeries', timeSeriesPort, TSCOLOR, tsParse)
let bandPowerServer = createAndBind('BandPower', bandPowerPort, BPCOLOR, bandPowerParse)
let auxServer = createAndBind('Auxillary', auxPort, AUXCOLOR)

setTimeout(function () {
  timeSeriesServer.close()
  bandPowerServer.close()
  auxServer.close()
}, 20000);