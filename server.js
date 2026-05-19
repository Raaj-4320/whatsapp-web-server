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

const client = new Client({

  authStrategy: new LocalAuth(),

  webVersionCache: {
    type: "none"
  },

  puppeteer: {

    headless: false,

    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  }
})

client.on("qr", async (qr) => {

  console.log("================================")
  console.log("QR RECEIVED")
  console.log("================================")

  await QRCode.toFile("qr.png", qr)

  console.log("Open qr.png and scan it")
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

let cleanPhone = customerPhone
  .replace(/\D/g, "")

if (!cleanPhone.startsWith("91")) {
  cleanPhone = "91" + cleanPhone
}

console.log("Normalized Phone:", cleanPhone)

    const chatId =
      cleanPhone + "@c.us"

    console.log("Downloading invoice from Cloudinary...")

    const response = await axios.get(pdfUrl, {
      responseType: "arraybuffer"
    })

    console.log("Download successful")
    console.log("Content-Type:", response.headers["content-type"])

    const base64 =
      Buffer.from(response.data).toString("base64")

    const media = new MessageMedia(
      "image/png",
      base64,
      `${invoiceNo}.png`
    )

    console.log("Sending WhatsApp message...")
    console.log("Chat ID:", chatId)

console.log("Checking WhatsApp number...")

const numberId = await client.getNumberId(cleanPhone)

console.log("Number ID Result:")
console.log(numberId)

if (!numberId) {

  throw new Error(
    "Phone number is not registered on WhatsApp"
  )
}

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

app.listen(3000, async () => {

  console.log("================================")
  console.log("Server running on port 3000")
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