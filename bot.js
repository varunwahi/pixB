const fs = require('fs')

process.env["NTBA_FIX_319"] = 1; 
process.env["NTBA_FIX_350"] = 1;  //required for removing node-telegram-bot warnings
//--
const config = require('./secrets/config.js')
const processing = require('./processing')
const TelegramBot = require('node-telegram-bot-api')
const bot = new TelegramBot(config.botToken, {polling: true});
//--

fs.stat('./secrets/gcpKey.json', (err,stats) => {
  if (err){
    if (err.code == 'ENOENT'){
      throw Error('./secrets/gcpKey.json not present. Please read README.md file')
    }
  }
});

bot.on('message', async (msg) => {

  if ("photo" in msg){
    
    bot.sendMessage(msg.chat.id,'Downloading image..')
    let start = process.hrtime()

    let file_id = msg.photo[msg.photo.length-1].file_id
    let image_url_start = process.hrtime()
    let image_url = await processing.imageUrl(file_id)
    let image_url_end = process.hrtime(image_url_start)

    let image_path_start = process.hrtime()
    let image_path = await processing.downloadImage(image_url)
    let image_path_end = process.hrtime(image_path_start)

    bot.sendMessage(msg.chat.id,'Preparing results..')
    let processing_start = process.hrtime()
    let response = await processing.processImage(image_path)
    let processing_end = process.hrtime(processing_start)

    let end = process.hrtime(start)
    let totalTime = end[0] + (end[1]/Math.pow(10,9))
    let processingTime =`Processing time : ${Math.round((totalTime + Number.EPSILON) * 100)/100}s`
    let finalResponse = `${processingTime} \n${response}`
    finalResponse = finalResponse.replace(/([<])(?:[\s]+)/g,"&lt;") //escaping html markup tokens
    finalResponse = finalResponse.replace(/(?:[\s]+)([>])/g,"&gt;")


    bot.sendMessage(msg.chat.id,finalResponse,{ parse_mode: "HTML",disable_web_page_preview : true })
    bot.sendPhoto(msg.chat.id,'./images/dominantColors.png',{filename: 'dominant-colors',contentType:'image/png'})
    console.log("results sent")
    console.log(image_url_end)
    console.log(image_path_end)
    console.log(processing_end)
  }

  else if("text" in msg){

    bot.sendMessage(msg.chat.id,'Preparing results ..')
    text = msg.text
    let start = process.hrtime()
    let response = await processing.processText(text)
    let end = process.hrtime(start)

    let totalTime = end[0] + (end[1]/Math.pow(10,9))
    let processingTime =`Processing time : ${Math.round((totalTime + Number.EPSILON) * 100)/100}s`
    let finalResponse = `${processingTime} \n\n${response}`

    bot.sendMessage(msg.chat.id,finalResponse,{ parse_mode: "HTML",disable_web_page_preview : true })
    console.log("results sent")

  }



});

