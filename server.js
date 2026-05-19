const express = require("express")
const cors = require("cors")
const axios = require("axios")
const QRCode = require("qrcode")

const {
  Client,
  LocalAuth,
  MessageMedia
} = require("whatsapp-web.js")

const app = express()

app.use(cors({
  origin: true
}))

app.use(express.json())

// expose qr.png publicly
app.use(express.static("."))

const PORT = process.env.PORT || 3000

// =========================
// DETECT ENVIRONMENT
// =========================

const isRender =
  !!process.env.RENDER

console.log("Running on Render:", isRender)

// =========================
// PUPPETEER CONFIG
// =========================

const puppeteerConfig = {

  headless: true,

  args: [

    "--no-sandbox",

    "--disable-setuid-sandbox",

    "--disable-dev-shm-usage",

    "--disable-accelerated-2d-canvas",

    "--disable-gpu",

    "--no-first-run",

    "--no-zygote",

    "--single-process",

    "--disable-extensions"
  ]
}

// LOCAL WINDOWS ONLY
if (!isRender) {

  puppeteerConfig.executablePath =
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
}

// =========================
// WHATSAPP CLIENT
// =========================

const client = new Client({

  authStrategy: new LocalAuth(),

  webVersionCache: {
    type: "none"
  },

  puppeteer: puppeteerConfig
})

// =========================
// EVENTS
// =========================

client.on("qr", async (qr) => {

  console.log("================================")
  console.log("QR RECEIVED")
  console.log("================================")

  await QRCode.toFile("qr.png", qr)

  console.log("Open qr.png and scan it")

  if (isRender) {

    console.log("QR URL:")
    console.log(
      `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/qr.png`
    )
  }
})

client.on("authenticated", () => {

  console.log("================================")
  console.log("Authenticated")
  console.log("================================")
})

client.once("ready", () => {

  console.log("================================")
  console.log("WhatsApp Connected Successfully")
  console.log("================================")
})

client.on("auth_failure", (msg) => {

  console.log("================================")
  console.log("AUTH FAILURE")
  console.log(msg)
  console.log("================================")
})

client.on("disconnected", (reason) => {

  console.log("================================")
  console.log("Disconnected")
  console.log(reason)
  console.log("================================")
})

// =========================
// HEALTH ROUTES
// =========================

app.get("/", (req, res) => {

  res.send("WhatsApp server running")
})

app.get("/healthz", (req, res) => {

  res.json({
    success: true,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  })
})

// =========================
// SEND INVOICE
// =========================

app.post("/send-invoice", async (req, res) => {

  try {

    console.log("================================")
    console.log("Incoming invoice request")
    console.log(req.body)
    console.log("================================")

    if (!req.body) {

      return res.status(400).json({
        success: false,
        error: "Missing request body"
      })
    }

    const {
      customerPhone,
      customerName,
      invoiceNo,
      pdfUrl
    } = req.body

    if (!customerPhone || !pdfUrl) {

      return res.status(400).json({
        success: false,
        error: "Missing customerPhone or pdfUrl"
      })
    }

    // =========================
    // NORMALIZE PHONE
    // =========================

    let cleanPhone = customerPhone
      .replace(/\D/g, "")

    if (!cleanPhone.startsWith("91")) {
      cleanPhone = "91" + cleanPhone
    }

    console.log("Normalized Phone:", cleanPhone)

    // =========================
    // CHECK NUMBER
    // =========================

    console.log("Checking WhatsApp number...")

    const numberId =
      await client.getNumberId(cleanPhone)

    console.log("Number ID Result:")
    console.log(numberId)

    if (!numberId) {

      throw new Error(
        "Phone number is not registered on WhatsApp"
      )
    }

    // =========================
    // DOWNLOAD IMAGE
    // =========================

    console.log("Downloading invoice image...")

    const response = await axios.get(pdfUrl, {

      responseType: "arraybuffer",

      timeout: 15000
    })

    console.log("Download successful")

    // =========================
    // CREATE MEDIA
    // =========================

    const base64 =
      Buffer.from(response.data)
        .toString("base64")

    const media = new MessageMedia(
      "image/png",
      base64,
      `${invoiceNo}.png`
    )

    // =========================
    // SEND MESSAGE
    // =========================

    console.log("Sending WhatsApp message...")

    await client.sendMessage(

      numberId._serialized,

      media,

      {
        caption:
`Hello ${customerName},

Your invoice ${invoiceNo} is attached.

Thank you for shopping with us.`
      }
    )

    console.log("================================")
    console.log("Invoice sent successfully")
    console.log("================================")

    res.json({
      success: true
    })

  } catch (err) {

    console.log("================================")
    console.log("SEND ERROR")
    console.log(err)
    console.log("================================")

    res.status(500).json({
      success: false,
      error: err.message
    })
  }
})

// =========================
// MEMORY LOGGING
// =========================

setInterval(() => {

  const used =
    process.memoryUsage()

  console.log("================================")
  console.log("MEMORY USAGE")

  console.log({
    rss:
      Math.round(
        used.rss / 1024 / 1024
      ) + " MB",

    heapUsed:
      Math.round(
        used.heapUsed / 1024 / 1024
      ) + " MB"
  })

  console.log("================================")

}, 1000 * 60 * 10)

// =========================
// START SERVER
// =========================

app.listen(PORT, async () => {

  console.log("================================")
  console.log(`Server running on port ${PORT}`)
  console.log("================================")

  client.initialize()

    .then(() => {

      console.log("Client initialized")
    })

    .catch((err) => {

      console.log("INITIALIZE ERROR")
      console.log(err)
    })
})